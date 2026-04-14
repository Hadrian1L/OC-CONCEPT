// Weight constants - tweak these to tune fairness

// Base weight is 10, if for some reason you want someone to have a better chance, increase their weight 
// relative to 10. If you want to decrease someone's chances, 
// decrease their weight but keep it above 1 (weights below 1 are treated as 1).
const W = {
  BOTH_SESSIONS:  10,   // available both days
  CERT_LOSER:     7,    // if you lost out on a cert boat, your weight in the general lottery is reduced by 30%
}

const DRIVER_SCARCE_THRESHOLD = 3 // if less than this = all drivers auto-assigned a boat if they don't got one

function weightedShuffle(people, weightFn) {
  const pool = []
  for (const p of people) {
    const w = Math.max(1, Math.round(weightFn(p)))
    for (let i = 0; i < w; i++) pool.push(p)
  }
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]]
  }
  const seen = new Set()
  return pool.filter(p => {
    if (seen.has(p.member.id)) return false
    seen.add(p.member.id)
    return true
  })
}

// runs a certified boat draw for a given phase pool.
function assignCertifiedBoats(phasePool, remainingRestricted, tag, assign, assignedIds, pool) {
  let i = 0
  while (i < remainingRestricted.length) {
    const boat = remainingRestricted[i]
    const eligible = phasePool.filter(
      e => (e.member.certs || []).includes(boat.id) && !assignedIds.has(e.member.id)
    )
    if (!eligible.length) { i++; continue }

    const shuffled = weightedShuffle(eligible, () => W.BOTH_SESSIONS)
    const winner = shuffled[0]
    const ok = assign(winner.member, boat.name, tag)
    if (ok) {
      remainingRestricted.splice(i, 1) // remove this boat from remaining
    } else {
      i++
    }

    for (const loser of shuffled.slice(1)) {
      const idx = pool.findIndex(e => e.member.id === loser.member.id)
      if (idx !== -1) pool[idx] = { ...pool[idx], certLoser: true }
    }
  }
}

export function runDraw({ session, members, boats, signups, overflowIds }) {
  const memberMap = Object.fromEntries(members.map(m => [m.id, m]))

  const activeBoats      = boats.filter(b => b.active)
  const singleBoats      = activeBoats.filter(b => (b.capacity || 1) === 1)
  const doubleBoats      = activeBoats.filter(b => (b.capacity || 1) === 2)
  const remainingRestricted = singleBoats.filter(b => b.restricted)
  const regularBoats     = singleBoats.filter(b => !b.restricted)

  const sessionSignups = signups.filter(s => s.sessions.includes(session))

  const assigned    = []
  const assignedIds = new Set()

  // Probationary members: only eligible for double boats, never overflow
  const probationPool = sessionSignups
    .filter(s => memberMap[s.memberId] && memberMap[s.memberId].on_probation)
    .map(s => ({ member: memberMap[s.memberId] }))

  let pool = sessionSignups
    .filter(s => memberMap[s.memberId] && !memberMap[s.memberId].on_probation)
    .map(s => ({
      member:         memberMap[s.memberId],
      sessions:       s.sessions,
      canDrive:       s.canDrive || false,
      driverCapacity: s.driverCapacity || 0,
      ownBoat:        s.ownBoat || false,
      isOverflow:     overflowIds.includes(s.memberId),
      certLoser:      false,
    }))

  // Total transport capacity: sum of (1 driver seat + passenger seats) per driver.
  const totalTransportCap = pool
    .filter(e => e.canDrive)
    .reduce((sum, e) => sum + 1 + (e.driverCapacity || 0), 0)
  let availableSeats = totalTransportCap

  function assign(member, boat, tag) {
    if (availableSeats <= 0) return false
    assigned.push({ member, boat, tag })
    assignedIds.add(member.id)
    availableSeats -= 1
    return true
  }

  for (const entry of pool) {
    if (entry.ownBoat) {
      assign(entry.member, 'Personal Boat', 'own-boat')
    }
  }
  pool = pool.filter(e => !assignedIds.has(e.member.id))

  let remainingRegular = [...regularBoats]

  // Single session peeps
  const singleSessionPool = weightedShuffle(
    pool.filter(e => e.sessions.length === 1),
    () => 1
  )
  assignCertifiedBoats(singleSessionPool, remainingRestricted, 'single-session-guarantee', assign, assignedIds, pool)
  for (const entry of singleSessionPool) {
    if (assignedIds.has(entry.member.id)) continue
    if (remainingRegular.length === 0) break
    const boat = remainingRegular.shift()
    assign(entry.member, boat.name, 'single-session-guarantee')
  }
  pool = pool.filter(e => !assignedIds.has(e.member.id))

  // Thursday overflows
  if (session === 'thursday') {
    const overflowPool = weightedShuffle(
      [
        ...pool.filter(e => e.isOverflow),
        ...probationPool.filter(p => overflowIds.includes(p.member.id)),
      ],
      () => 1
    )
    assignCertifiedBoats(overflowPool, remainingRestricted, 'overflow-guarantee', assign, assignedIds, pool)
    for (const entry of overflowPool) {
      if (assignedIds.has(entry.member.id)) continue
      const isProbation = entry.member.on_probation
      if (remainingRegular.length > 0 && !isProbation) {
        const boat = remainingRegular.shift()
        assign(entry.member, boat.name, 'overflow-guarantee')
      } else if (doubleBoats.length > 0) {
        const counts = {}
        for (const a of assigned) counts[a.boat] = (counts[a.boat] || 0) + 1
        const partialDouble = doubleBoats.find(b => (counts[b.name] || 0) < 2)
        if (partialDouble) {
          assign(entry.member, partialDouble.name, 'overflow-guarantee')
        }
      }
    }
  }

  // Drivers, thank you for driving us C:
  const drivers    = pool.filter(e => e.canDrive)
  const nonDrivers = pool.filter(e => !e.canDrive)

  let driverWinners = []
  let driverLosers  = []

  if (drivers.length > 0 && drivers.length < DRIVER_SCARCE_THRESHOLD) {
    driverWinners = drivers
  } else if (drivers.length >= DRIVER_SCARCE_THRESHOLD) {
    const shuffled = weightedShuffle(drivers, () => 1)
    driverWinners  = shuffled.slice(0, remainingRegular.length)
    driverLosers   = shuffled.slice(remainingRegular.length)
  }

  assignCertifiedBoats(driverWinners, remainingRestricted, 'driver', assign, assignedIds, pool)
  for (const entry of driverWinners) {
    if (assignedIds.has(entry.member.id)) continue
    if (remainingRegular.length === 0 || availableSeats <= 0) break
    const boat = remainingRegular.shift()
    const ok = assign(entry.member, boat.name, 'driver')
    if (!ok) {
      remainingRegular.unshift(boat)
      break
    }
  }

  pool = [
    ...nonDrivers.filter(e => !assignedIds.has(e.member.id)),
    ...driverLosers.filter(e => !assignedIds.has(e.member.id)),
  ]

  // General lottery for certified boats if they are still available
  assignCertifiedBoats(pool, remainingRestricted, 'certified', assign, assignedIds, pool)

  pool = pool.filter(e => !assignedIds.has(e.member.id))

  // Regular lottey for regular boats
  const generalShuffled = weightedShuffle(pool, e => {
    if (e.certLoser) return W.CERT_LOSER
    return W.BOTH_SESSIONS
  })

  for (const boat of remainingRegular) {
    if (!generalShuffled.length) break
    const winner = generalShuffled.shift()
    if (!assignedIds.has(winner.member.id)) {
      assign(winner.member, boat.name, 'lottery')
    }
  }

  pool = pool.filter(e => !assignedIds.has(e.member.id))

  const oc2Pool = [
    ...pool,
    ...probationPool.filter(p => !assignedIds.has(p.member.id)),
  ]

  const counts = {}
  for (const a of assigned) counts[a.boat] = (counts[a.boat] || 0) + 1

  if (doubleBoats.length > 0 && oc2Pool.length >= 1) {
    const pairingShuffled = weightedShuffle(oc2Pool, e => {
      if (e.certLoser) return W.CERT_LOSER
      return W.BOTH_SESSIONS
    })

    let boatIdx = 0
    while (boatIdx < doubleBoats.length && pairingShuffled.length >= 1) {
      const boat = doubleBoats[boatIdx]
      const seatsNeeded = 2 - (counts[boat.name] || 0)

      if (seatsNeeded <= 0) { boatIdx++; continue }
      if (pairingShuffled.length < seatsNeeded) { boatIdx++; continue }

      for (let s = 0; s < seatsNeeded; s++) {
        const person = pairingShuffled.shift()
        const ok = assign(person.member, boat.name, 'paired')
        if (!ok) break
      }
      boatIdx++
    }
  }

  const overflowEntries = oc2Pool.filter(e => !assignedIds.has(e.member.id))

  return {
    assigned,
    overflow: overflowEntries.map(e => ({ member: e.member })),
    newOverflowIds: overflowEntries.map(e => e.member.id),
  }
}
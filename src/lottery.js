// Weight constants - tweak these to tune fairness

// Base weight is 10, if for some reason you want someone to have a better chance, increase their weight 
// relative to 10. If you want to decrease someone's chances, 
// decrease their weight but keep it above 1 (weights below 1 are treated as 1).
const W = {
  BOTH_SESSIONS:       10,  // available both days
  CERT_LOSER:          7,   // if you lost out on a cert boat, your chances in the general lottery are halved for fairness
  ATTENDANCE_BONUS:    8,   // max extra weight someone can get for low attendance (so max weight = 10 + 8 = 18)
  ATTENDANCE_CURVE:    2,   // curve power: 1 = linear, 2 = quadratic (gentle boost, only bottom few get meaningful bump)
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

// Ranks everyone in the pool by sessions_attended and returns a weight map by member id.
// People above or at the median get base weight. People below get a curve-scaled bonus.
// Only applies to people borrowing boats (called right before general lottery).
function buildAttendanceWeights(pool) {
  const weights = {}
  const n = pool.length
  if (n <= 1) {
    pool.forEach(e => { weights[e.member.id] = W.BOTH_SESSIONS })
    return weights
  }

  const sorted = [...pool].sort((a, b) =>
    (a.member.sessions_attended || 0) - (b.member.sessions_attended || 0)
  )

  sorted.forEach((entry, i) => {
    const rank = i + 1
    const normalizedPosition = (rank - 1) / (n - 1) // 0 = least attended, 1 = most attended
    const bonus = W.ATTENDANCE_BONUS * Math.pow(1 - normalizedPosition, W.ATTENDANCE_CURVE)
    weights[entry.member.id] = Math.round(W.BOTH_SESSIONS + bonus)
  })

  return weights
}

export function runDraw({ session, members, boats, signups, overflowIds }) {
  const memberMap = Object.fromEntries(members.map(m => [m.id, m]))

  const activeBoats      = boats.filter(b => b.active)
  const singleBoats      = activeBoats.filter(b => (b.capacity || 1) === 1)
  const doubleBoats      = activeBoats.filter(b => (b.capacity || 1) === 2)
  const restrictedBoats  = singleBoats.filter(b => b.restricted)
  const regularBoats     = singleBoats.filter(b => !b.restricted)

  const sessionSignups = signups.filter(s => s.sessions.includes(session))

  const assigned    = []
  const assignedIds = new Set()
  let availableSeats = 0

  function assign(member, boat, tag) {
    if (availableSeats <= 0) return false // Out of seats
    assigned.push({ member, boat, tag })
    assignedIds.add(member.id)
    availableSeats -= 1
    return true
  }

  let pool = sessionSignups
    .filter(s => memberMap[s.memberId])
    .map(s => ({
      member:     memberMap[s.memberId],
      sessions:   s.sessions,
      canDrive:   s.canDrive || false,
      driverCapacity: s.driverCapacity || 0,
      ownBoat:    s.ownBoat || false,
      isOverflow: overflowIds.includes(s.memberId),
      certLoser:  false,
    }))

  for (const entry of pool) {
    if (entry.canDrive) {
      availableSeats += 1 + entry.driverCapacity
    }
  }

  for (const entry of pool) {
    if (entry.ownBoat) {
      assign(entry.member, 'Personal Boat', 'own-boat')
    }
  }
  pool = pool.filter(e => !assignedIds.has(e.member.id))

  let remainingRegular = [...regularBoats]

  // guaranteed single session folks
  const singleSession = weightedShuffle(
    pool.filter(e => e.sessions.length === 1),
    () => 1
  )
  for (const entry of singleSession) {
    if (remainingRegular.length === 0) break
    const boat = remainingRegular.shift()
    assign(entry.member, boat.name, 'single-session-guarantee')
  }
  pool = pool.filter(e => !assignedIds.has(e.member.id))

  if (session === 'thursday') {
    const guaranteed = weightedShuffle(
      pool.filter(e => e.isOverflow),
      () => 1
    )
    for (const entry of guaranteed) {
      if (remainingRegular.length === 0) break
      const boat = remainingRegular.shift()
      assign(entry.member, boat.name, 'overflow-guarantee')
    }
    pool = pool.filter(e => !assignedIds.has(e.member.id))
  }

  const drivers    = pool.filter(e => e.canDrive)
  const nonDrivers = pool.filter(e => !e.canDrive)

  let driverWinners = []
  let driverLosers  = []

  if (drivers.length > 0 && drivers.length < DRIVER_SCARCE_THRESHOLD) {
    driverWinners = drivers
  } else if (drivers.length >= DRIVER_SCARCE_THRESHOLD) {
    // Surplus: randomize among drivers
    const shuffled = weightedShuffle(drivers, () => 1)
    driverWinners  = shuffled.slice(0, remainingRegular.length)
    driverLosers   = shuffled.slice(remainingRegular.length)
  }

  for (const entry of driverWinners) {
    if (remainingRegular.length === 0 || availableSeats <= 0) break
    const boat = remainingRegular.shift()
    const driverAssigned = assign(entry.member, boat.name, 'driver')
    
    if (!driverAssigned) {
      remainingRegular.unshift(boat) // Put boat back
      break
    }

    const capacity = entry.driverCapacity || 0
    const availablePassengers = [
      ...nonDrivers.filter(e => !assignedIds.has(e.member.id)),
      ...driverLosers.filter(e => !assignedIds.has(e.member.id)),
    ]
    
    for (let i = 0; i < capacity && availablePassengers.length > 0; i++) {
      if (remainingRegular.length === 0 || availableSeats <= 0) break // No more boats for passengers
      const passengerBoat = remainingRegular.shift()
      const passenger = availablePassengers.shift()
      const passengerAssigned = assign(passenger.member, passengerBoat.name, 'passenger')
      if (!passengerAssigned) {
        remainingRegular.unshift(passengerBoat) // Put boat back
        break
      }
    }
  }

  pool = [
    ...nonDrivers.filter(e => !assignedIds.has(e.member.id)),
    ...driverLosers.filter(e => !assignedIds.has(e.member.id)),
  ]

  for (const boat of restrictedBoats) {
    const eligible = pool.filter(
      e => (e.member.certs || []).includes(boat.id) && !assignedIds.has(e.member.id)
    )
    if (!eligible.length) continue

    const shuffled = weightedShuffle(eligible, () => W.BOTH_SESSIONS)

    assign(shuffled[0].member, boat.name, 'certified')

    for (const loser of shuffled.slice(1)) {
      const idx = pool.findIndex(e => e.member.id === loser.member.id)
      if (idx !== -1) pool[idx] = { ...pool[idx], certLoser: true }
    }
  }

  pool = pool.filter(e => !assignedIds.has(e.member.id))

  // Build attendance weights fresh from whoever is left in the general pool
  const attendanceWeights = buildAttendanceWeights(pool)

  const generalShuffled = weightedShuffle(pool, e => {
    if (e.certLoser) return W.CERT_LOSER
    return attendanceWeights[e.member.id] ?? W.BOTH_SESSIONS
  })

  for (const boat of remainingRegular) {
    if (!generalShuffled.length) break
    const winner = generalShuffled.shift()
    if (!assignedIds.has(winner.member.id)) {
      assign(winner.member, boat.name, 'lottery')
    }
  }

  pool = pool.filter(e => !assignedIds.has(e.member.id))

  if (doubleBoats.length > 0 && pool.length >= 2) {
    const doubleAttendanceWeights = buildAttendanceWeights(pool)
    const pairingShuffled = weightedShuffle(pool, e => {
      if (e.certLoser) return W.CERT_LOSER
      return doubleAttendanceWeights[e.member.id] ?? W.BOTH_SESSIONS
    })

    let boatIdx = 0
    while (pairingShuffled.length >= 2 && boatIdx < doubleBoats.length) {
      const boat = doubleBoats[boatIdx]
      const person1 = pairingShuffled.shift()
      const person2 = pairingShuffled.shift()

      const person1Assigned = assign(person1.member, boat.name, 'paired')
      const person2Assigned = assign(person2.member, boat.name, 'paired')
      
      if (!person1Assigned || !person2Assigned) break // Out of seats
      boatIdx++
    }
  }

  const overflowEntries = pool.filter(e => !assignedIds.has(e.member.id))

  return {
    assigned,
    overflow:       overflowEntries.map(e => ({ member: e.member })),
    newOverflowIds: overflowEntries.map(e => e.member.id),
  }
}

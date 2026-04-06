// Weight constants - tweak these to tune fairness
const W = {
  SINGLE_SESSION: 3,   // can only make this one day
  BOTH_SESSIONS:  1,   // available both days, normal weight
  OVERFLOW_BONUS: 2,   // carried over from Tuesday overflow
  CERT_LOSER:     0.5, // lost a restricted boat draw, reduced general pool weight
}

const DRIVER_SCARCE_THRESHOLD = 3 // fewer than this = all drivers auto-assigned

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

export function runDraw({ session, members, boats, signups, overflowIds }) {
  const memberMap = Object.fromEntries(members.map(m => [m.id, m]))

  const activeBoats     = boats.filter(b => b.active)
  const restrictedBoats = activeBoats.filter(b => b.restricted)
  const regularBoats    = activeBoats.filter(b => !b.restricted)

  const sessionSignups = signups.filter(s => s.sessions.includes(session))

  const assigned    = []
  const assignedIds = new Set()

  function assign(member, boat, tag) {
    assigned.push({ member, boat, tag })
    assignedIds.add(member.id)
  }

  // Build pool - canDrive comes from the signup (weekly), not the member profile
  let pool = sessionSignups
    .filter(s => memberMap[s.memberId])
    .map(s => ({
      member:     memberMap[s.memberId],
      sessions:   s.sessions,
      canDrive:   s.canDrive || false,
      isOverflow: overflowIds.includes(s.memberId),
      certLoser:  false,
    }))

  // ── Step 1: Own boat owners ──────────────────────────────────────────────
  for (const entry of pool) {
    if (entry.member.ownBoat) {
      assign(entry.member, entry.member.ownBoatName || 'Personal Boat', 'own-boat')
    }
  }
  pool = pool.filter(e => !assignedIds.has(e.member.id))

  // ── Step 2: Thursday overflow guarantee ──────────────────────────────────
  let remainingRegular = [...regularBoats]

  if (session === 'thursday') {
    const guaranteed = pool.filter(e => e.isOverflow)
    for (const entry of guaranteed) {
      if (remainingRegular.length === 0) break
      const boat = remainingRegular.shift()
      assign(entry.member, boat.name, 'overflow-guarantee')
    }
    pool = pool.filter(e => !assignedIds.has(e.member.id))
  }

  // ── Step 3: Drivers ───────────────────────────────────────────────────────
  // canDrive is weekly - set by the member at sign-up time
  const drivers    = pool.filter(e => e.canDrive)
  const nonDrivers = pool.filter(e => !e.canDrive)

  let driverWinners = []
  let driverLosers  = []

  if (drivers.length > 0 && drivers.length < DRIVER_SCARCE_THRESHOLD) {
    // Scarce: auto-assign all drivers
    driverWinners = drivers
  } else if (drivers.length >= DRIVER_SCARCE_THRESHOLD) {
    // Surplus: randomize among drivers
    const shuffled = weightedShuffle(drivers, () => 1)
    driverWinners  = shuffled.slice(0, remainingRegular.length)
    driverLosers   = shuffled.slice(remainingRegular.length)
  }

  for (const entry of driverWinners) {
    if (remainingRegular.length === 0) break
    const boat = remainingRegular.shift()
    assign(entry.member, boat.name, 'driver')
  }

  pool = [
    ...nonDrivers.filter(e => !assignedIds.has(e.member.id)),
    ...driverLosers.filter(e => !assignedIds.has(e.member.id)),
  ]

  // ── Step 4: Restricted boat draws ────────────────────────────────────────
  // Each restricted boat has its own certified list - like a hashmap boat -> [certified members]
  for (const boat of restrictedBoats) {
    const eligible = pool.filter(
      e => (e.member.certs || []).includes(boat.id) && !assignedIds.has(e.member.id)
    )
    if (!eligible.length) continue

    const shuffled = weightedShuffle(eligible, e => {
      let w = e.sessions.length === 1 ? W.SINGLE_SESSION : W.BOTH_SESSIONS
      if (e.isOverflow) w += W.OVERFLOW_BONUS
      return w
    })

    assign(shuffled[0].member, boat.name, 'certified')

    // Losers get reduced weight in the general pool
    for (const loser of shuffled.slice(1)) {
      const idx = pool.findIndex(e => e.member.id === loser.member.id)
      if (idx !== -1) pool[idx] = { ...pool[idx], certLoser: true }
    }
  }

  pool = pool.filter(e => !assignedIds.has(e.member.id))

  // ── Step 5: General lottery ───────────────────────────────────────────────
  const generalShuffled = weightedShuffle(pool, e => {
    let w = e.sessions.length === 1 ? W.SINGLE_SESSION : W.BOTH_SESSIONS
    if (e.isOverflow) w += W.OVERFLOW_BONUS
    if (e.certLoser)  w  = Math.max(1, Math.round(w * W.CERT_LOSER))
    return w
  })

  for (const boat of remainingRegular) {
    if (!generalShuffled.length) break
    const winner = generalShuffled.shift()
    if (!assignedIds.has(winner.member.id)) {
      assign(winner.member, boat.name, 'lottery')
    }
  }

  // ── Step 6: Overflow ──────────────────────────────────────────────────────
  const overflowEntries = pool.filter(e => !assignedIds.has(e.member.id))

  return {
    assigned,
    overflow:       overflowEntries.map(e => ({ member: e.member })),
    newOverflowIds: overflowEntries.map(e => e.member.id),
  }
}

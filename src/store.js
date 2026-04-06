const KEYS = {
  MEMBERS:  'og_members',
  BOATS:    'og_boats',
  SIGNUPS:  'og_signups',
  OVERFLOW: 'og_overflow',
  RESULTS:  'og_results',
}

function load(key, fallback) {
  try { return JSON.parse(localStorage.getItem(key)) ?? fallback }
  catch { return fallback }
}

function save(key, value) {
  localStorage.setItem(key, JSON.stringify(value))
}

// ── Members ───────────────────────────────────────────────────────────────────
// Profile: { id, name, ownBoat, ownBoatName, certs[] }
// canDrive is NOT stored here - it's asked weekly at sign-up
export function getMembers()         { return load(KEYS.MEMBERS, []) }
export function saveMembers(members) { save(KEYS.MEMBERS, members) }

export function addMember(member) {
  const members = getMembers()
  const newMember = { ...member, id: crypto.randomUUID() }
  members.push(newMember)
  saveMembers(members)
  return newMember
}

export function updateMember(id, updates) {
  saveMembers(getMembers().map(m => m.id === id ? { ...m, ...updates } : m))
}

export function deleteMember(id) {
  saveMembers(getMembers().filter(m => m.id !== id))
  saveSignups(getSignups().filter(s => s.memberId !== id))
}

// ── Boats ─────────────────────────────────────────────────────────────────────
export function getBoats()       { return load(KEYS.BOATS, []) }
export function saveBoats(boats) { save(KEYS.BOATS, boats) }

export function addBoat(boat) {
  const boats = getBoats()
  const newBoat = { ...boat, id: crypto.randomUUID() }
  boats.push(newBoat)
  saveBoats(boats)
  return newBoat
}

export function updateBoat(id, updates) {
  saveBoats(getBoats().map(b => b.id === id ? { ...b, ...updates } : b))
}

export function deleteBoat(id) {
  saveBoats(getBoats().filter(b => b.id !== id))
}

// ── Signups ───────────────────────────────────────────────────────────────────
// { memberId, sessions[], canDrive }  - canDrive is weekly, stored per signup
export function getSignups()         { return load(KEYS.SIGNUPS, []) }
export function saveSignups(signups) { save(KEYS.SIGNUPS, signups) }

export function addSignup(memberId, sessions, canDrive = false) {
  const signups = getSignups()
  if (signups.find(s => s.memberId === memberId)) return false
  signups.push({ memberId, sessions, canDrive })
  saveSignups(signups)
  return true
}

export function getSignedUpIds() {
  return getSignups().map(s => s.memberId)
}

// ── Overflow ──────────────────────────────────────────────────────────────────
export function getOverflow()     { return load(KEYS.OVERFLOW, []) }
export function saveOverflow(ids) { save(KEYS.OVERFLOW, ids) }

// ── Results ───────────────────────────────────────────────────────────────────
export function getResults()          { return load(KEYS.RESULTS, { tuesday: null, thursday: null }) }
export function saveResults(results)  { save(KEYS.RESULTS, results) }

// ── Weekly reset ──────────────────────────────────────────────────────────────
export function weeklyReset() {
  save(KEYS.SIGNUPS,  [])
  save(KEYS.OVERFLOW, [])
  save(KEYS.RESULTS,  { tuesday: null, thursday: null })
}

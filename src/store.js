import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
)

// people
export async function getMembers() {
  const { data, error } = await supabase.from('members').select('*').order('name')
  if (error) { console.error(error); return [] }
  return data
}

export async function addMember(member) {
  const { data, error } = await supabase.from('members').insert([member]).select().single()
  if (error) { console.error(error); return null }
  return data
}

export async function updateMember(id, updates) {
  const { error } = await supabase.from('members').update(updates).eq('id', id)
  if (error) console.error(error)
}

export async function deleteMember(id) {
  const { error } = await supabase.from('members').delete().eq('id', id)
  if (error) console.error(error)
}

// boat fleet 
export async function getBoats() {
  const { data, error } = await supabase.from('boats').select('*').order('name')
  if (error) { console.error(error); return [] }
  return data
}

export async function addBoat(boat) {
  const { data, error } = await supabase.from('boats').insert([boat]).select().single()
  if (error) { console.error(error); return null }
  return data
}

export async function updateBoat(id, updates) {
  const { error } = await supabase.from('boats').update(updates).eq('id', id)
  if (error) console.error(error)
}

export async function deleteBoat(id) {
  const { error } = await supabase.from('boats').delete().eq('id', id)
  if (error) console.error(error)
}

// signups
export async function getSignups() {
  const { data, error } = await supabase.from('signups').select('*')
  if (error) { console.error(error); return [] }
  return data.map(s => ({
    memberId: s.member_id,
    sessions: s.sessions,
    canDrive: s.can_drive,
    ownBoat: s.own_boat,
    driverCapacity: s.driver_capacity || 0,
  }))
}

export async function addSignup(memberId, sessions, canDrive = false, ownBoat = false, driverCapacity = 0) {
  // dupe check
  const { data: existing } = await supabase
    .from('signups')
    .select('id')
    .eq('member_id', memberId)
    .single()
  if (existing) return false

  const { error } = await supabase.from('signups').insert([{
    member_id: memberId,
    sessions,
    can_drive: canDrive,
    own_boat: ownBoat,
    driver_capacity: canDrive ? driverCapacity : 0,
  }])
  if (error) { console.error(error); return false }
  return true
}

export async function getSignedUpIds() {
  const { data, error } = await supabase.from('signups').select('member_id')
  if (error) { console.error(error); return [] }
  return data.map(s => s.member_id)
}

export async function deleteSignup(memberId) {
  const { error } = await supabase.from('signups').delete().eq('member_id', memberId)
  if (error) console.error(error)
}

// overflow 
export async function getOverflow() {
  const { data, error } = await supabase.from('overflow').select('member_id')
  if (error) { console.error(error); return [] }
  return data.map(o => o.member_id)
}

export async function saveOverflow(memberIds) {
  await supabase.from('overflow').delete().neq('member_id', '00000000-0000-0000-0000-000000000000')
  if (!memberIds.length) return
  const { error } = await supabase.from('overflow').insert(memberIds.map(id => ({ member_id: id })))
  if (error) console.error(error)
}

// getting the results
export async function getResults() {
  const { data, error } = await supabase.from('results').select('*')
  if (error) { console.error(error); return { tuesday: null, thursday: null } }
  const results = { tuesday: null, thursday: null }
  for (const row of data) {
    results[row.id] = row.data
  }
  return results
}

export async function saveResults(session, sessionData) {
  const { error } = await supabase.from('results').upsert({ id: session, data: sessionData })
  if (error) console.error(error)
}

// reset weekly idk who wants to do this
export async function weeklyReset() {
  await supabase.from('signups').delete().neq('id', '00000000-0000-0000-0000-000000000000')
  await supabase.from('overflow').delete().neq('member_id', '00000000-0000-0000-0000-000000000000')
  await supabase.from('results').delete().neq('id', 'placeholder')
}

export async function adjustAttendance(memberId, delta) {
  const { data: member, error: fetchError } = await supabase
    .from('members')
    .select('sessions_attended')
    .eq('id', memberId)
    .single()
  if (fetchError) { console.error(fetchError); return }

  const updated = Math.max(0, (member.sessions_attended || 0) + delta)
  const { error } = await supabase
    .from('members')
    .update({ sessions_attended: updated })
    .eq('id', memberId)
  if (error) console.error(error)
}

export async function markSessionAttendance(memberIds) {
  if (!memberIds.length) return
  for (const id of memberIds) {
    await adjustAttendance(id, 1)
  }
}

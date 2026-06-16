import { createClient } from '@supabase/supabase-js'
import { runDraw } from '../src/lottery.js'

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
)

async function getMembers() {
  const { data, error } = await supabase.from('members').select('*').order('name')
  if (error) { console.error(error); return [] }
  return data
}

async function getBoats() {
  const { data, error } = await supabase.from('boats').select('*').order('name')
  if (error) { console.error(error); return [] }
  return data
}

async function getSignups() {
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

async function getOverflow() {
  const { data, error } = await supabase.from('overflow').select('member_id')
  if (error) { console.error(error); return [] }
  return data.map(o => o.member_id)
}

async function saveResults(session, sessionData) {
  const { error } = await supabase.from('results').upsert({ id: session, data: sessionData })
  if (error) console.error(error)
}

async function saveOverflow(memberIds) {
  await supabase.from('overflow').delete().neq('member_id', '00000000-0000-0000-0000-000000000000')
  if (!memberIds.length) return
  const { error } = await supabase.from('overflow').insert(memberIds.map(id => ({ member_id: id })))
  if (error) console.error(error)
}

async function main() {
  let session = process.env.DRAW_SESSION

  if (!session) {
    const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']
    const today = days[new Date().getUTCDay()]
    if (today === 'monday') session = 'tuesday'
    else if (today === 'wednesday') session = 'thursday'
    else {
      console.log(`No draw scheduled for ${today}, skipping.`)
      process.exit(0)
    }
  }

  console.log(`Running ${session} draw...`)

  const [members, boats, signups, overflowIds] = await Promise.all([
    getMembers(), getBoats(), getSignups(), getOverflow()
  ])

  const sessionSignups = signups.filter(s => s.sessions.includes(session))
  if (!sessionSignups.length) {
    console.log(`No sign-ups for ${session}, skipping.`)
    process.exit(0)
  }

  const { assigned, overflow, newOverflowIds } = runDraw({
    session, members, boats, signups, overflowIds,
  })

  await saveResults(session, { assigned, overflow })
  if (session === 'tuesday') await saveOverflow(newOverflowIds)

  console.log(`${session} draw complete. ${assigned.length} assigned, ${overflow.length} overflow.`)
}

main().catch(e => { console.error(e); process.exit(1) })
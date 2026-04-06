import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  getMembers, addMember, updateMember, deleteMember,
  getBoats, addBoat, updateBoat, deleteBoat,
  getSignups, getOverflow, saveOverflow, getResults, saveResults, weeklyReset,
} from '../store'
import { runDraw } from '../lottery'
import { useToast } from '../useToast'

function MemberForm({ boats, onSave, initial, onCancel }) {
  const [name,        setName]        = useState(initial?.name || '')
  const [ownBoat,     setOwnBoat]     = useState(initial?.own_boat || false)
  const [ownBoatName, setOwnBoatName] = useState(initial?.own_boat_name || '')
  const [certs,       setCerts]       = useState(initial?.certs || [])

  const restrictedBoats = boats.filter(b => b.restricted)

  function toggleCert(id) {
    setCerts(prev => prev.includes(id) ? prev.filter(c => c !== id) : [...prev, id])
  }

  function handleSave() {
    if (!name.trim()) return
    onSave({
      name: name.trim(),
      own_boat: ownBoat,
      own_boat_name: ownBoat ? ownBoatName.trim() : '',
      certs,
    })
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div className="field" style={{ marginBottom: 0 }}>
        <label className="field-label">Name</label>
        <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="Full name" />
      </div>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <span>
          <input type="checkbox" className="toggle-pill" id="f-own"
            checked={ownBoat} onChange={e => setOwnBoat(e.target.checked)} />
          <label htmlFor="f-own">⛵ Owns a Boat</label>
        </span>
      </div>

      {ownBoat && (
        <div className="field" style={{ marginBottom: 0 }}>
          <label className="field-label">Boat Name</label>
          <input type="text" value={ownBoatName} onChange={e => setOwnBoatName(e.target.value)} placeholder="e.g. Blue Arrow" />
        </div>
      )}

      {restrictedBoats.length > 0 && (
        <div>
          <label className="field-label">Certifications</label>
          <div className="toggle-group">
            {restrictedBoats.map(b => (
              <span key={b.id}>
                <input type="checkbox" className="toggle-pill" id={`cert-${b.id}`}
                  checked={certs.includes(b.id)} onChange={() => toggleCert(b.id)} />
                <label htmlFor={`cert-${b.id}`}>🏅 {b.name}</label>
              </span>
            ))}
          </div>
          <p style={{ color: 'var(--muted)', fontSize: 11, marginTop: 8 }}>
            Driving availability is asked weekly at sign-up, not stored here.
          </p>
        </div>
      )}

      <div className="grid-2">
        <button className="btn-sm btn-success" style={{ padding: '10px 0' }} onClick={handleSave}>Save</button>
        {onCancel && (
          <button className="btn-sm btn-ghost"
            style={{ padding: '10px 0', border: '1px solid rgba(122,155,181,0.2)' }}
            onClick={onCancel}>Cancel</button>
        )}
      </div>
    </div>
  )
}

export default function Admin() {
  const navigate = useNavigate()
  const toast    = useToast()

  const [members,  setMembers]  = useState([])
  const [boats,    setBoats]    = useState([])
  const [signups,  setSignups]  = useState([])
  const [tab, setTab]           = useState('roster')
  const [loading,  setLoading]  = useState(true)

  const [addingMember,      setAddingMember]      = useState(false)
  const [editingId,         setEditingId]          = useState(null)
  const [addingBoat,        setAddingBoat]         = useState(false)
  const [newBoatName,       setNewBoatName]        = useState('')
  const [newBoatRestricted, setNewBoatRestricted]  = useState(false)
  const [newBoatCapacity,   setNewBoatCapacity]    = useState(1)

  async function refresh() {
    setLoading(true)
    const [m, b, s] = await Promise.all([getMembers(), getBoats(), getSignups()])
    setMembers(m)
    setBoats(b)
    setSignups(s)
    setLoading(false)
  }

  useEffect(() => { refresh() }, [])

  async function handleAddMember(data) {
    await addMember(data)
    setAddingMember(false)
    await refresh()
    toast(`${data.name} added`)
  }

  async function handleUpdateMember(id, data) {
    await updateMember(id, data)
    setEditingId(null)
    await refresh()
    toast('Member updated')
  }

  async function handleDeleteMember(id, name) {
    if (!confirm(`Remove ${name}?`)) return
    await deleteMember(id)
    await refresh()
    toast(`${name} removed`)
  }

  async function handleAddBoat() {
    if (!newBoatName.trim()) return
    await addBoat({ name: newBoatName.trim(), restricted: newBoatRestricted, active: true, capacity: newBoatCapacity })
    setNewBoatName('')
    setNewBoatRestricted(false)
    setNewBoatCapacity(1)
    setAddingBoat(false)
    await refresh()
    toast('Boat added')
  }

  async function toggleBoatActive(id) {
    const boat = boats.find(b => b.id === id)
    await updateBoat(id, { active: !boat.active })
    await refresh()
    toast(boat.active ? 'Boat marked out of commission' : 'Boat marked active')
  }

  async function handleDeleteBoat(id, name) {
    if (!confirm(`Delete ${name}?`)) return
    await deleteBoat(id)
    await refresh()
    toast(`${name} deleted`)
  }

  async function handleRunDraw(session) {
    const [allSignups, overflowIds] = await Promise.all([getSignups(), getOverflow()])
    const sessionSignups = allSignups.filter(s => s.sessions.includes(session))
    if (!sessionSignups.length) { toast('No sign-ups for this session!'); return }

    const { assigned, overflow, newOverflowIds } = runDraw({
      session, members, boats, signups: allSignups, overflowIds,
    })

    await saveResults(session, { assigned, overflow })
    if (session === 'tuesday') await saveOverflow(newOverflowIds)

    toast(`${session.charAt(0).toUpperCase() + session.slice(1)} draw done!`)
    navigate('/results')
  }

  async function handleReset() {
    if (!confirm('Reset all sign-ups for the new week? Roster and boats are kept.')) return
    await weeklyReset()
    await refresh()
    toast('Week reset. Sign-ups are open.')
  }

  const tabStyle = (t) => ({
    flex: 1, padding: '12px 0',
    background: 'transparent', border: 'none',
    borderBottom: tab === t ? '2px solid var(--mint)' : '2px solid transparent',
    color: tab === t ? 'var(--mint)' : 'var(--muted)',
    fontFamily: "'DM Mono', monospace", fontSize: 12,
    cursor: 'pointer', letterSpacing: '1.5px',
    textTransform: 'uppercase', transition: 'all 0.15s',
  })

  if (loading) return (
    <div className="page" style={{ textAlign: 'center', paddingTop: 80 }}>
      <p style={{ color: 'var(--muted)', fontSize: 13 }}>Loading...</p>
    </div>
  )

  return (
    <div className="page">
      <div className="page-header">
        <h1>Admin Panel</h1>
        <p className="subtitle">Outrigger Lottery</p>
      </div>

      <div style={{ display: 'flex', borderBottom: '1px solid rgba(122,155,181,0.15)', marginBottom: 20 }}>
        <button style={tabStyle('roster')}  onClick={() => setTab('roster')}>Roster</button>
        <button style={tabStyle('boats')}   onClick={() => setTab('boats')}>Boats</button>
        <button style={tabStyle('signups')} onClick={() => setTab('signups')}>Sign-Ups</button>
        <button style={tabStyle('draw')}    onClick={() => setTab('draw')}>Draw</button>
      </div>

      {/* Roster tab */}
      {tab === 'roster' && (
        <div className="card">
          <div className="card-label">Members ({members.length})</div>
          {members.length === 0 && !addingMember && (
            <p style={{ color: 'var(--muted)', fontSize: 13, marginBottom: 16 }}>No members yet.</p>
          )}
          {members.length > 0 && (
            <table className="roster-table" style={{ marginBottom: 16 }}>
              <thead>
                <tr><th>Name</th><th>Profile</th><th></th></tr>
              </thead>
              <tbody>
                {members.map(m => (
                  editingId === m.id ? (
                    <tr key={m.id}>
                      <td colSpan={3}>
                        <MemberForm boats={boats} initial={m}
                          onSave={data => handleUpdateMember(m.id, data)}
                          onCancel={() => setEditingId(null)} />
                      </td>
                    </tr>
                  ) : (
                    <tr key={m.id}>
                      <td>{m.name}</td>
                      <td>
                        {m.own_boat          && <span className="pill pill-mint">⛵</span>}
                        {m.certs?.length > 0 && <span className="pill pill-muted">🏅×{m.certs.length}</span>}
                      </td>
                      <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                        <button className="btn-sm btn-success" style={{ marginRight: 6 }}
                          onClick={() => setEditingId(m.id)}>Edit</button>
                        <button className="btn-sm btn-danger"
                          onClick={() => handleDeleteMember(m.id, m.name)}>Remove</button>
                      </td>
                    </tr>
                  )
                ))}
              </tbody>
            </table>
          )}
          {addingMember ? (
            <MemberForm boats={boats} onSave={handleAddMember} onCancel={() => setAddingMember(false)} />
          ) : (
            <button className="btn-ghost" onClick={() => setAddingMember(true)}>+ Add Member</button>
          )}
        </div>
      )}

      {/* Boats tab */}
      {tab === 'boats' && (
        <div className="card">
          <div className="card-label">Club Boats</div>
          {boats.length === 0 && !addingBoat && (
            <p style={{ color: 'var(--muted)', fontSize: 13, marginBottom: 16 }}>No boats added yet.</p>
          )}
          {boats.map(b => (
            <div key={b.id} className="result-row">
              <div>
                <span style={{ color: 'var(--foam)' }}>{b.name}</span>
                {b.restricted && <span className="pill pill-sun" style={{ marginLeft: 8 }}>Restricted</span>}
                <span className="pill pill-muted" style={{ marginLeft: 8 }}>{b.capacity || 1}p</span>
              </div>
              <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                <button className={`btn-sm ${b.active ? 'btn-success' : 'btn-danger'}`}
                  onClick={() => toggleBoatActive(b.id)}>
                  {b.active ? 'Active' : 'Out'}
                </button>
                <button className="btn-sm btn-danger" onClick={() => handleDeleteBoat(b.id, b.name)}>Delete</button>
              </div>
            </div>
          ))}
          {addingBoat ? (
            <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
              <input type="text" value={newBoatName} onChange={e => setNewBoatName(e.target.value)}
                placeholder="Boat name (e.g. Pegasus)" />
              <div style={{ display: 'flex', gap: 12 }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--muted)', fontSize: 13 }}>
                  <span>Capacity:</span>
                  <select value={newBoatCapacity} onChange={e => setNewBoatCapacity(parseInt(e.target.value))}
                    style={{ padding: '6px 8px', borderRadius: 4, border: '1px solid rgba(122,155,181,0.3)', background: 'var(--bg)', color: 'var(--text)', fontFamily: 'inherit' }}>
                    <option value={1}>1 Person</option>
                    <option value={2}>2 People</option>
                  </select>
                </label>
              </div>
              <span>
                <input type="checkbox" className="toggle-pill" id="new-restricted"
                  checked={newBoatRestricted} onChange={e => setNewBoatRestricted(e.target.checked)} />
                <label htmlFor="new-restricted">🏅 Restricted boat</label>
              </span>
              <div className="grid-2">
                <button className="btn-sm btn-success" style={{ padding: '10px 0' }} onClick={handleAddBoat}>Add Boat</button>
                <button className="btn-sm btn-ghost" style={{ padding: '10px 0', border: '1px solid rgba(122,155,181,0.2)' }}
                  onClick={() => setAddingBoat(false)}>Cancel</button>
              </div>
            </div>
          ) : (
            <button className="btn-ghost" style={{ marginTop: boats.length ? 16 : 0 }}
              onClick={() => setAddingBoat(true)}>+ Add Boat</button>
          )}
        </div>
      )}

      {/* Sign-ups tab */}
      {tab === 'signups' && (
        <div className="card">
          <div className="card-label">This Week's Sign-Ups ({signups.length})</div>
          {signups.length === 0 ? (
            <p style={{ color: 'var(--muted)', fontSize: 13 }}>No sign-ups yet this week.</p>
          ) : (
            <table className="roster-table">
              <thead>
                <tr><th>Name</th><th>Sessions</th><th>Drive</th></tr>
              </thead>
              <tbody>
                {signups.map((s, i) => {
                  const member = members.find(m => m.id === s.memberId)
                  return (
                    <tr key={i}>
                      <td>{member?.name || 'Unknown'}</td>
                      <td>
                        {s.sessions.map(sess => (
                          <span key={sess} className="pill pill-muted" style={{ marginRight: 4 }}>
                            {sess.charAt(0).toUpperCase() + sess.slice(1)}
                          </span>
                        ))}
                      </td>
                      <td>{s.canDrive ? <span className="pill pill-sun">🚗 Yes</span> : <span style={{ color: 'var(--muted)', fontSize: 12 }}>No</span>}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Draw tab */}
      {tab === 'draw' && (
        <>
          <div className="card">
            <div className="card-label">Run the Draw</div>
            <p style={{ color: 'var(--muted)', fontSize: 12, marginBottom: 20, lineHeight: 1.7 }}>
              Make sure sign-ups are in and boats are correctly toggled before running.
            </p>
            <div className="grid-2">
              <button className="btn-secondary" onClick={() => handleRunDraw('tuesday')}>Run Tuesday</button>
              <button className="btn-secondary" onClick={() => handleRunDraw('thursday')}>Run Thursday</button>
            </div>
            <button className="btn-ghost" style={{ marginTop: 10 }} onClick={() => navigate('/results')}>
              View Results
            </button>
          </div>
          <div className="card">
            <div className="card-label">Weekly Reset</div>
            <p style={{ color: 'var(--muted)', fontSize: 12, marginBottom: 16, lineHeight: 1.7 }}>
              Clears sign-ups and results for the new week. Roster and boats are not affected.
            </p>
            <button className="btn-secondary" onClick={handleReset}>Reset Week</button>
          </div>
        </>
      )}
    </div>
  )
}

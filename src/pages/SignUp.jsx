import { useState, useEffect } from 'react'
import { getMembers, getSignedUpIds, addMember, addSignup } from '../store'
import { useToast } from '../useToast'
import { useNavigate } from 'react-router-dom'

function MemberForm({ onSave, onCancel }) {
  const [name, setName] = useState('')

  function handleSave() {
    if (!name.trim()) return
    onSave({ name: name.trim(), certs: [], on_probation: false })
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div className="field" style={{ marginBottom: 0 }}>
        <label className="field-label">Name</label>
        <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="Full name" />
      </div>
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

export default function SignUp() {
  const toast = useToast()
  const navigate = useNavigate()
  const [members,       setMembers]       = useState([])
  const [signedUpIds,   setSignedUpIds]   = useState([])
  const [selectedId,    setSelectedId]    = useState('')
  const [tab,           setTab]           = useState('signup')
  const [sessions,      setSessions]      = useState([])
  const [canDrive,      setCanDrive]      = useState(false)
  const [driverCapacity, setDriverCapacity] = useState(0)
  const [ownBoat,       setOwnBoat]       = useState(false)
  const [submitted,     setSubmitted]     = useState(false)
  const [loading,       setLoading]       = useState(true)
  const [addingMember,  setAddingMember]  = useState(false)

  async function load() {
    setLoading(true)
    const [m, ids] = await Promise.all([getMembers(), getSignedUpIds()])
    setMembers(m)
    setSignedUpIds(ids)
    setLoading(false)
  }

  async function handleAddMember(data) {
    await addMember(data)
    setAddingMember(false)
    await load()
    toast(`${data.name} added`)
  }

  useEffect(() => { load() }, [])

  const available = members.filter(m => !signedUpIds.includes(m.id))

  function toggleSession(s) {
    setSessions(prev => prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s])
  }

  async function handleSubmit() {
    if (!selectedId)      { toast('Pick your name!'); return }
    if (!sessions.length) { toast('Pick at least one session!'); return }

    const ok = await addSignup(selectedId, sessions, canDrive, ownBoat, driverCapacity)
    if (!ok) { toast('Already signed up!'); return }

    setSubmitted(true)
    toast('Signed up!')
  }

  if (loading) {
    return (
      <div className="page" style={{ textAlign: 'center', paddingTop: 80 }}>
        <p style={{ color: 'var(--muted)', fontSize: 13 }}>Loading...</p>
      </div>
    )
  }

  if (submitted) {
    const member = members.find(m => m.id === selectedId)
    return (
      <div className="page">
        <div className="page-header">
          <span className="wave-icon">🚣</span>
          <h1>You're in!</h1>
          <p className="subtitle">See you on the water</p>
        </div>
        <div className="card" style={{ textAlign: 'center' }}>
          <p style={{ fontSize: 32, marginBottom: 12 }}>🌊</p>
          <p style={{ color: 'var(--foam)', fontSize: 16, marginBottom: 6 }}>{member?.name}</p>
          <p style={{ color: 'var(--muted)', fontSize: 13 }}>
            {sessions.map(s => s.charAt(0).toUpperCase() + s.slice(1)).join(' & ')}
          </p>
          {canDrive && (
            <p style={{ color: 'var(--sun)', fontSize: 12, marginTop: 8 }}>🚗 Driving this week</p>
          )}
          {ownBoat && (
            <p style={{ color: 'var(--foam)', fontSize: 12, marginTop: 8 }}>⛵ Bringing your boat</p>
          )}
          <button
            className="btn-ghost"
            style={{ marginTop: 20 }}
            onClick={() => {
              setSubmitted(false)
              setSelectedId('')
              setSessions([])
              setCanDrive(false)
              setDriverCapacity(0)
              setOwnBoat(false)
              load()
            }}
          >
            Sign up another person
          </button>
        </div>
      </div>
    )
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

  return (
    <div className="page">
      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, marginBottom: 6 }}>
          <span className="wave-icon">🚣</span>
          <h1>Goey Moey Moeington</h1>
          <span className="wave-icon" style={{ animationDelay: '1s' }}>🌊</span>
        </div>
        <p className="subtitle">Weekly Boat Sign-Up</p>
      </div>

      <div style={{ display: 'flex', borderBottom: '1px solid rgba(122,155,181,0.15)', marginBottom: 20 }}>
        <button style={tabStyle('signup')} onClick={() => setTab('signup')}>Sign Up</button>
        <button style={tabStyle('first')} onClick={() => setTab('first')}>First time?</button>
        <button style={tabStyle('results')} onClick={() => setTab('results')}>Results</button>
      </div>

      {tab === 'signup' && (
        <div className="card">
          <div className="card-label">Sign Up</div>

          <div className="field">
            <label className="field-label">Your Name</label>
            {available.length === 0 ? (
              <p style={{ color: 'var(--muted)', fontSize: 13 }}>
                Everyone has signed up this week!
              </p>
            ) : (
              <select value={selectedId} onChange={e => setSelectedId(e.target.value)}>
                <option value="">Select your name...</option>
                {available.map(m => (
                  <option key={m.id} value={m.id}>{m.name}</option>
                ))}
              </select>
            )}
          </div>

          <div className="field">
            <label className="field-label">Can you drive this week?</label>
            <div className="toggle-group">
              <span>
                <input type="checkbox" className="toggle-pill" id="can-drive"
                  checked={canDrive} onChange={e => setCanDrive(e.target.checked)} />
                <label htmlFor="can-drive">🚗 Yes, I can drive</label>
              </span>
            </div>
          </div>

          {canDrive && (
            <div className="field">
              <label className="field-label">How many passengers can you bring?</label>
              <input
                type="number" min="0" max="10"
                value={driverCapacity}
                onChange={e => setDriverCapacity(parseInt(e.target.value) || 0)}
                placeholder="e.g. 2"
                style={{ padding: '10px', borderRadius: 4, border: '1px solid rgba(122,155,181,0.3)', background: 'var(--bg)', color: 'var(--text)', fontFamily: 'inherit' }}
              />
            </div>
          )}

          <div className="field">
            <label className="field-label">Do you have your own boat?</label>
            <div className="toggle-group">
              <span>
                <input type="checkbox" className="toggle-pill" id="own-boat"
                  checked={ownBoat} onChange={e => setOwnBoat(e.target.checked)} />
                <label htmlFor="own-boat">⛵ Yes, I'm bringing my boat</label>
              </span>
            </div>
          </div>

          <div className="field">
            <label className="field-label">Sessions you can make</label>
            <div className="toggle-group">
              {['tuesday', 'thursday'].map(s => (
                <span key={s}>
                  <input type="checkbox" className="toggle-pill" id={`sess-${s}`}
                    checked={sessions.includes(s)} onChange={() => toggleSession(s)} />
                  <label htmlFor={`sess-${s}`}>
                    {s === 'tuesday' ? '📅 Tuesday' : '📅 Thursday'}
                  </label>
                </span>
              ))}
            </div>
          </div>

          <button className="btn-primary" onClick={handleSubmit} disabled={available.length === 0}>
            Submit Sign-Up
          </button>
        </div>
      )}

      {tab === 'first' && (
        
        <div className="card">
          <p style={{ color: 'var(--muted)', fontSize: 13, lineHeight: 1.6, marginBottom: 14 }}>
            Hello! Once you add yourself to the Moey website, tell the current water coaches or whoever is running Moey to give you certifications.
          </p>
          {addingMember ? (
            <MemberForm onSave={handleAddMember} onCancel={() => setAddingMember(false)} />
          ) : (
            <button className="btn-ghost" onClick={() => setAddingMember(true)}>+ Add Yourself</button>
          )}
        </div>
      )}

      {tab === 'results' && (
        <div className="results">
          <button className="btn-ghost" style={{ marginTop: 10 }} onClick={() => navigate('/results')}>
            View Results
          </button>
          </div>
      )}

      {signedUpIds.length > 0 && (
        <p style={{ textAlign: 'center', color: 'var(--muted)', fontSize: 11, marginTop: 8 }}>
          {signedUpIds.length} signed up this week
        </p>
      )}
    </div>
  )
}
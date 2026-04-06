import { useState, useEffect } from 'react'
import { getMembers, getSignedUpIds, addSignup } from '../store'
import { useToast } from '../useToast'

export default function SignUp() {
  const toast = useToast()
  const [members, setMembers]         = useState([])
  const [signedUpIds, setSignedUpIds] = useState([])
  const [selectedId, setSelectedId]   = useState('')
  const [sessions, setSessions]       = useState([])
  const [canDrive, setCanDrive]       = useState(false)
  const [driverCapacity, setDriverCapacity] = useState(0)
  const [ownBoat, setOwnBoat]         = useState(false)
  const [submitted, setSubmitted]     = useState(false)
  const [loading, setLoading]         = useState(true)

  async function load() {
    setLoading(true)
    const [m, ids] = await Promise.all([getMembers(), getSignedUpIds()])
    setMembers(m)
    setSignedUpIds(ids)
    setLoading(false)
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

  return (
    <div className="page">
      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, marginBottom: 6 }}>
          <span className="wave-icon">🚣</span>
          <h1>Outrigger Lottery</h1>
          <span className="wave-icon" style={{ animationDelay: '1s' }}>🌊</span>
        </div>
        <p className="subtitle">Weekly Boat Sign-Up</p>
      </div>

      <div className="card">
        <div className="card-label">Sign Up</div>

        <div className="field">
          <label className="field-label">Your Name</label>
          {members.length === 0 ? (
            <p style={{ color: 'var(--muted)', fontSize: 13 }}>
              No members yet. Ask your admin to set up the roster.
            </p>
          ) : available.length === 0 ? (
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
              <input
                type="checkbox"
                className="toggle-pill"
                id="can-drive"
                checked={canDrive}
                onChange={e => setCanDrive(e.target.checked)}
              />
              <label htmlFor="can-drive">🚗 Yes, I can drive</label>
            </span>
          </div>
        </div>

        {canDrive && (
          <div className="field">
            <label className="field-label">How many passengers can you bring?</label>
            <input
              type="number"
              min="0"
              max="10"
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
              <input
                type="checkbox"
                className="toggle-pill"
                id="own-boat"
                checked={ownBoat}
                onChange={e => setOwnBoat(e.target.checked)}
              />
              <label htmlFor="own-boat">⛵ Yes, I'm bringing my boat</label>
            </span>
          </div>
        </div>

        <div className="field">
          <label className="field-label">Sessions you can make</label>
          <div className="toggle-group">
            {['tuesday', 'thursday'].map(s => (
              <span key={s}>
                <input
                  type="checkbox"
                  className="toggle-pill"
                  id={`sess-${s}`}
                  checked={sessions.includes(s)}
                  onChange={() => toggleSession(s)}
                />
                <label htmlFor={`sess-${s}`}>
                  {s === 'tuesday' ? '📅 Tuesday' : '📅 Thursday'}
                </label>
              </span>
            ))}
          </div>
        </div>

        {selectedId && (() => {
          const m = members.find(x => x.id === selectedId)
          if (!m) return null
          const flags = []
          if (m.certs?.length) flags.push({ label: `🏅 Certified x${m.certs.length}`, cls: 'pill-muted' })
          if (!flags.length) return null
          return (
            <div className="field">
              <label className="field-label">Your profile</label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {flags.map(f => (
                  <span key={f.label} className={`pill ${f.cls}`}>{f.label}</span>
                ))}
              </div>
            </div>
          )
        })()}

        <button
          className="btn-primary"
          onClick={handleSubmit}
          disabled={available.length === 0}
        >
          Submit Sign-Up
        </button>
      </div>

      {signedUpIds.length > 0 && (
        <p style={{ textAlign: 'center', color: 'var(--muted)', fontSize: 11, marginTop: 8 }}>
          {signedUpIds.length} signed up this week
        </p>
      )}
    </div>
  )
}

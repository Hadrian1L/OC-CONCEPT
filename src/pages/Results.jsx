import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { getResults } from '../store'

const TAG_META = {
  'own-boat':           { label: '⛵ Own Boat',   cls: 'tag-mint' },
  'overflow-guarantee': { label: '⭐ Guaranteed', cls: 'tag-sun'  },
  'driver':             { label: '🚗 Driver',     cls: 'tag-sun'  },
  'certified':          { label: '🏅 Certified',  cls: 'tag-mint' },
  'lottery':            { label: '🎲 Lottery',    cls: 'tag-mint' },
}

function SessionResults({ data, session }) {
  if (!data) return (
    <p style={{ color: 'var(--muted)', fontSize: 13 }}>No draw run yet for {session}.</p>
  )

  const { assigned, overflow } = data

  return (
    <>
      {assigned?.length > 0 && (
        <div className="result-group">
          <div className="result-group-title">Assigned</div>
          {assigned.map((r, i) => (
            <div key={i} className="result-row">
              <span className="result-name">{r.member.name}</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ color: 'var(--muted)', fontSize: 12 }}>{r.boat}</span>
                <span className={`tag ${TAG_META[r.tag]?.cls || 'tag-mint'}`}>
                  {TAG_META[r.tag]?.label || r.tag}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {overflow?.length > 0 && (
        <div className="result-group">
          <div className="result-group-title">Overflow</div>
          {overflow.map((r, i) => (
            <div key={i} className="result-row">
              <span className="result-name">{r.member.name}</span>
              <span className="tag tag-coral">Overflow</span>
            </div>
          ))}
          {session === 'tuesday' && (
            <p style={{ color: 'var(--sun)', fontSize: 11, marginTop: 10 }}>
              ★ Overflow paddlers are guaranteed a Thursday spot.
            </p>
          )}
        </div>
      )}

      {!assigned?.length && !overflow?.length && (
        <p style={{ color: 'var(--muted)', fontSize: 13 }}>No results yet.</p>
      )}
    </>
  )
}

export default function Results() {
  const navigate = useNavigate()
  const [results, setResults] = useState({ tuesday: null, thursday: null })
  const [session, setSession] = useState('tuesday')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getResults().then(r => { setResults(r); setLoading(false) })
  }, [])

  const tabStyle = (s) => ({
    flex: 1, padding: '12px 0',
    background: 'transparent', border: 'none',
    borderBottom: session === s ? '2px solid var(--mint)' : '2px solid transparent',
    color: session === s ? 'var(--mint)' : 'var(--muted)',
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
        <h1>Draw Results</h1>
        <p className="subtitle">This Week</p>
      </div>

      <div style={{ display: 'flex', borderBottom: '1px solid rgba(122,155,181,0.15)', marginBottom: 20 }}>
        <button style={tabStyle('tuesday')}  onClick={() => setSession('tuesday')}>Tuesday</button>
        <button style={tabStyle('thursday')} onClick={() => setSession('thursday')}>Thursday</button>
      </div>

      <div className="card">
        <div className="card-label">{session.charAt(0).toUpperCase() + session.slice(1)}</div>
        <SessionResults data={results[session]} session={session} />
      </div>

      <button className="btn-ghost" onClick={() => navigate('/admin')}>Back to Admin</button>
    </div>
  )
}

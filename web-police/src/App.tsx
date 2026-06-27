import React, { useState, useEffect, useRef } from 'react';
import './App.css';
import io from 'socket.io-client';

const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:5000';

interface Stats {
  total_cases: number;
  active_cases: number;
  resolved_cases: number;
  false_alarms: number;
  total_users: number;
  total_stations: number;
  total_hotspots: number;
  false_alarm_rate: number;
}

interface CaseRecord {
  case_id: string;
  status: string;
  trigger_type: string;
  start_time: string;
  ai_classification?: string;
  confidence_score?: number;
  user_id: number;
}

interface Hotspot {
  id: number;
  lat: number;
  lng: number;
  risk_score: number;
  district: string;
  incident_count: number;
  crime_types: string[];
}

interface Recommendation {
  hotspot_id: number;
  district: string;
  location: { lat: number; lng: number };
  risk_score: number;
  recommendation: string;
  priority: string;
}

function App() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [cases, setCases] = useState<CaseRecord[]>([]);
  const [hotspots, setHotspots] = useState<Hotspot[]>([]);
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [selectedCase, setSelectedCase] = useState<CaseRecord | null>(null);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'cases' | 'hotspots' | 'recommendations'>('dashboard');
  const [loading, setLoading] = useState(true);
  const [token, setToken] = useState('');
  const [loginPhone, setLoginPhone] = useState('');
  const [loginPass, setLoginPass] = useState('');
  const [loggedIn, setLoggedIn] = useState(false);
  const [liveSOS, setLiveSOS] = useState<any[]>([]);
  const [statusFilter, setStatusFilter] = useState('all');
  const socketRef = useRef<any>(null);

  const authHeaders = { Authorization: `Bearer ${token}` };

  useEffect(() => {
    const savedToken = localStorage.getItem('police_token');
    if (savedToken) { setToken(savedToken); setLoggedIn(true); }
  }, []);

  useEffect(() => {
    if (!loggedIn || !token) return;
    fetchDashboard();
    socketRef.current = io(API_BASE, { transports: ['websocket', 'polling'] });
    socketRef.current.on('connect', () => socketRef.current.emit('join_police'));
    socketRef.current.on('sos_received', (data: any) => {
      setLiveSOS(prev => [data, ...prev].slice(0, 20));
      fetchDashboard();
    });
    const interval = setInterval(fetchDashboard, 30000);
    return () => { clearInterval(interval); socketRef.current?.disconnect(); };
  }, [loggedIn, token]);

  const fetchDashboard = async () => {
    try {
      const [dashRes, casesRes, recsRes] = await Promise.all([
        fetch(`${API_BASE}/api/admin/dashboard`, { headers: authHeaders }),
        fetch(`${API_BASE}/api/admin/cases?per_page=50`, { headers: authHeaders }),
        fetch(`${API_BASE}/api/admin/hotspots/recommendations`, { headers: authHeaders }),
      ]);
      if (dashRes.ok) { const d = await dashRes.json(); setStats(d.stats); setHotspots(d.hotspots || []); }
      if (casesRes.ok) { const d = await casesRes.json(); setCases(d.cases || []); }
      if (recsRes.ok) { const d = await recsRes.json(); setRecommendations(d.recommendations || []); }
      setLoading(false);
    } catch (e) { console.error(e); setLoading(false); }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch(`${API_BASE}/api/auth/login`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: loginPhone, password: loginPass }),
      });
      if (res.ok) {
        const data = await res.json();
        setToken(data.access_token);
        localStorage.setItem('police_token', data.access_token);
        setLoggedIn(true);
      } else { alert('Invalid credentials'); }
    } catch { alert('Connection failed'); }
  };

  const handleLogout = () => { setToken(''); setLoggedIn(false); localStorage.removeItem('police_token'); };
  const formatTime = (iso: string) => { try { return new Date(iso).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }); } catch { return iso; } };
  const statusColor = (s: string) => ({ active: '#f87171', resolved: '#4ade80', false_alarm: '#fbbf24' }[s] || '#94a3b8');
  const riskColor = (score: number) => score >= 0.7 ? '#f87171' : score >= 0.4 ? '#fbbf24' : '#4ade80';
  const filteredCases = cases.filter(c => statusFilter === 'all' || c.status === statusFilter);

  if (!loggedIn) {
    return (
      <div className="login-screen">
        <div className="login-card">
          <div className="login-logo">
            <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
              <circle cx="24" cy="24" r="24" fill="#4f46e5" />
              <path d="M24 8L30 20H38L26 30L30 42L24 36L18 42L22 30L10 20H18L24 8Z" fill="white" />
            </svg>
            <h1>SafeStep</h1>
            <p>Police Admin Dashboard</p>
          </div>
          <form onSubmit={handleLogin} className="login-form">
            <div className="form-group">
              <label>Phone Number</label>
              <input type="tel" value={loginPhone} onChange={e => setLoginPhone(e.target.value)} placeholder="+91XXXXXXXXXX" required />
            </div>
            <div className="form-group">
              <label>Password</label>
              <input type="password" value={loginPass} onChange={e => setLoginPass(e.target.value)} placeholder="••••••••" required />
            </div>
            <button type="submit" className="btn btn-primary full-width">Login to Police Portal</button>
          </form>
          <p className="login-hint">Andhra Pradesh Police — SafeStep Command Center</p>
        </div>
      </div>
    );
  }

  return (
    <div className="app">
      <nav className="nav-sidebar">
        <div className="nav-logo">
          <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
            <circle cx="16" cy="16" r="16" fill="#4f46e5" />
            <path d="M16 6L20 14H24L17 20L19 28L16 24L13 28L15 20L8 14H12L16 6Z" fill="white" />
          </svg>
          <div><div className="nav-title">SafeStep</div><div className="nav-sub">Police Portal</div></div>
        </div>
        <div className="nav-items">
          {[{ id: 'dashboard', label: 'Dashboard', icon: '📊' }, { id: 'cases', label: 'Incidents', icon: '🚨' },
            { id: 'hotspots', label: 'Hotspots', icon: '🗺️' }, { id: 'recommendations', label: 'AI Patrol', icon: '🤖' }
          ].map(item => (
            <button key={item.id} className={`nav-item ${activeTab === item.id ? 'active' : ''}`}
              onClick={() => setActiveTab(item.id as any)}>
              <span>{item.icon}</span><span>{item.label}</span>
              {item.id === 'cases' && cases.filter(c => c.status === 'active').length > 0 && (
                <span className="badge danger">{cases.filter(c => c.status === 'active').length}</span>
              )}
            </button>
          ))}
        </div>
        {liveSOS.length > 0 && (
          <div className="live-feed">
            <div className="live-feed-title"><span className="live-dot" />LIVE SOS FEED</div>
            {liveSOS.slice(0, 3).map((s, i) => (
              <div key={i} className="live-item"><div className="live-name">{s.user_name}</div><div className="live-case">{s.case_id}</div></div>
            ))}
          </div>
        )}
        <div className="nav-footer"><button onClick={handleLogout} className="btn-logout">🚪 Logout</button></div>
      </nav>

      <main className="main-content">
        <div className="page-header">
          <div>
            <h1>{activeTab === 'dashboard' ? 'Command Center' : activeTab === 'cases' ? 'Incident Management' : activeTab === 'hotspots' ? 'Crime Hotspot Map' : 'AI Patrol Recommendations'}</h1>
            <p className="page-sub">Y4 Prakasam Police Hackathon 2026 — SafeStep</p>
          </div>
          <div className="header-actions">
            <button onClick={fetchDashboard} className="btn btn-outline">🔄 Refresh</button>
            <a href={`${API_BASE}/api/admin/report/${new Date().toISOString().slice(0, 7)}`}
              className="btn btn-primary" target="_blank" rel="noopener noreferrer">📄 Monthly Report</a>
          </div>
        </div>

        {loading ? (
          <div className="loading-state"><div className="spinner" /><p>Loading command center...</p></div>
        ) : (
          <>
            {activeTab === 'dashboard' && (
              <div className="tab-content">
                <div className="stats-grid">
                  {[
                    { label: 'Total Incidents', value: stats?.total_cases || 0, icon: '📋', color: '#4f46e5' },
                    { label: 'Active SOS', value: stats?.active_cases || 0, icon: '🚨', color: '#dc2626', urgent: (stats?.active_cases || 0) > 0 },
                    { label: 'Resolved', value: stats?.resolved_cases || 0, icon: '✅', color: '#16a34a' },
                    { label: 'False Alarms', value: stats?.false_alarms || 0, icon: '⚠️', color: '#d97706' },
                    { label: 'Users', value: stats?.total_users || 0, icon: '👤', color: '#7c3aed' },
                    { label: 'Stations', value: stats?.total_stations || 0, icon: '🚔', color: '#0891b2' },
                    { label: 'Hotspots', value: stats?.total_hotspots || 0, icon: '🔥', color: '#ea580c' },
                    { label: 'False Alarm Rate', value: `${stats?.false_alarm_rate || 0}%`, icon: '📉', color: '#94a3b8' },
                  ].map((s, i) => (
                    <div key={i} className={`stat-card ${(s as any).urgent ? 'urgent' : ''}`} style={{ '--accent': s.color } as any}>
                      <div className="stat-icon">{s.icon}</div>
                      <div className="stat-body"><div className="stat-value">{s.value}</div><div className="stat-label">{s.label}</div></div>
                      {(s as any).urgent && <div className="urgent-pulse" />}
                    </div>
                  ))}
                </div>
                <div className="section">
                  <h2 className="section-title">Recent Incidents</h2>
                  <div className="table-container">
                    <table className="data-table">
                      <thead><tr><th>Case ID</th><th>Status</th><th>Trigger</th><th>AI Class</th><th>Started</th><th>Actions</th></tr></thead>
                      <tbody>
                        {cases.slice(0, 10).map(c => (
                          <tr key={c.case_id} onClick={() => setSelectedCase(c)} className="clickable-row">
                            <td><code className="case-code">{c.case_id}</code></td>
                            <td><span className="status-chip" style={{ background: `${statusColor(c.status)}22`, color: statusColor(c.status) }}>{c.status.toUpperCase()}</span></td>
                            <td>{c.trigger_type?.replace('_', ' ') || 'Manual'}</td>
                            <td>{c.ai_classification || '—'}</td>
                            <td>{formatTime(c.start_time)}</td>
                            <td><a href={`${API_BASE}/api/sos/case/${c.case_id}`} className="action-link" onClick={e => e.stopPropagation()} target="_blank" rel="noopener noreferrer">View</a></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'cases' && (
              <div className="tab-content">
                <div className="filter-bar">
                  {['all', 'active', 'resolved', 'false_alarm'].map(s => (
                    <button key={s} className={`filter-btn ${statusFilter === s ? 'active' : ''}`} onClick={() => setStatusFilter(s)}>
                      {s === 'all' ? 'All' : s.replace('_', ' ').toUpperCase()}
                      <span className="filter-count">{s === 'all' ? cases.length : cases.filter(c => c.status === s).length}</span>
                    </button>
                  ))}
                </div>
                <div className="table-container">
                  <table className="data-table">
                    <thead><tr><th>Case ID</th><th>Status</th><th>Trigger</th><th>AI Class</th><th>Confidence</th><th>Started</th><th>FIR</th></tr></thead>
                    <tbody>
                      {filteredCases.map(c => (
                        <tr key={c.case_id} className="clickable-row" onClick={() => setSelectedCase(c)}>
                          <td><code className="case-code">{c.case_id}</code></td>
                          <td><span className="status-chip" style={{ background: `${statusColor(c.status)}22`, color: statusColor(c.status) }}>{c.status.toUpperCase()}</span></td>
                          <td>{c.trigger_type?.replace('_', ' ') || 'Manual'}</td>
                          <td>{c.ai_classification || '—'}</td>
                          <td>{c.confidence_score ? `${(c.confidence_score * 100).toFixed(0)}%` : '—'}</td>
                          <td>{formatTime(c.start_time)}</td>
                          <td><a href={`${API_BASE}/uploads/fir/FIR_${c.case_id}.pdf`} target="_blank" rel="noopener noreferrer" className="action-link" onClick={e => e.stopPropagation()}>📄</a></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {activeTab === 'hotspots' && (
              <div className="tab-content">
                <div className="hotspot-layout">
                  <div className="hotspot-map-placeholder">
                    <div className="map-grid-bg" />
                    <div className="map-center-content">
                      <h2>🗺️ Crime Heatmap — Andhra Pradesh</h2>
                      <p>Showing {hotspots.length} active hotspot clusters</p>
                      <div className="legend">
                        <div className="legend-item"><span className="legend-dot high" />High Risk (≥0.7)</div>
                        <div className="legend-item"><span className="legend-dot medium" />Medium (0.4–0.7)</div>
                        <div className="legend-item"><span className="legend-dot low" />Low (&lt;0.4)</div>
                      </div>
                    </div>
                    {hotspots.slice(0, 20).map((h) => {
                      const x = ((h.lng - 76) / (84 - 76)) * 100;
                      const y = ((17 - h.lat) / (17 - 12)) * 100;
                      return (
                        <div key={h.id} className="hotspot-dot"
                          style={{ left: `${Math.max(2, Math.min(98, x))}%`, top: `${Math.max(2, Math.min(98, y))}%`, background: riskColor(h.risk_score), width: `${20 + h.incident_count * 2}px`, height: `${20 + h.incident_count * 2}px` }}
                          title={`${h.district}: Risk ${h.risk_score.toFixed(2)}, ${h.incident_count} incidents`} />
                      );
                    })}
                  </div>
                  <div className="hotspot-list">
                    <h3>Top Risk Zones</h3>
                    {hotspots.slice(0, 15).map((h, i) => (
                      <div key={h.id} className="hotspot-item">
                        <div className="hotspot-rank">#{i + 1}</div>
                        <div className="hotspot-body">
                          <div className="hotspot-district">{h.district || 'Unknown'}</div>
                          <div className="hotspot-coords">{h.lat.toFixed(4)}, {h.lng.toFixed(4)}</div>
                          {h.crime_types?.length > 0 && (
                            <div className="crime-tags">{h.crime_types.slice(0, 2).map(t => <span key={t} className="crime-tag">{t}</span>)}</div>
                          )}
                        </div>
                        <div className="hotspot-score" style={{ color: riskColor(h.risk_score) }}>{(h.risk_score * 100).toFixed(0)}<span>risk</span></div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'recommendations' && (
              <div className="tab-content">
                <div className="recs-header">
                  <div className="ai-badge">🤖 AI-Generated Patrol Recommendations</div>
                  <p>Based on DBSCAN clustering of last 30 days of incidents</p>
                </div>
                <div className="recs-grid">
                  {recommendations.map(r => (
                    <div key={r.hotspot_id} className={`rec-card ${r.priority.toLowerCase()}`}>
                      <div className="rec-header">
                        <span className={`priority-badge ${r.priority.toLowerCase()}`}>{r.priority}</span>
                        <span className="rec-district">{r.district}</span>
                      </div>
                      <p className="rec-text">{r.recommendation}</p>
                      <div className="rec-footer">
                        <span>📍 {r.location.lat.toFixed(4)}, {r.location.lng.toFixed(4)}</span>
                        <span className="risk-badge">Risk: {(r.risk_score * 100).toFixed(0)}%</span>
                      </div>
                    </div>
                  ))}
                  {recommendations.length === 0 && <div className="empty-state"><p>🤖 No AI recommendations yet. The nightly DBSCAN job will generate these automatically.</p></div>}
                </div>
              </div>
            )}
          </>
        )}
      </main>

      {selectedCase && (
        <div className="modal-overlay" onClick={() => setSelectedCase(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header"><h2>Case Detail</h2><button onClick={() => setSelectedCase(null)} className="modal-close">✕</button></div>
            <div className="modal-body">
              {[['Case ID', selectedCase.case_id], ['Status', selectedCase.status.toUpperCase()],
                ['Trigger', selectedCase.trigger_type], ['AI Class', selectedCase.ai_classification || 'N/A'],
                ['Confidence', selectedCase.confidence_score ? `${(selectedCase.confidence_score * 100).toFixed(1)}%` : 'N/A'],
                ['Started', formatTime(selectedCase.start_time)]
              ].map(([k, v]) => (
                <div key={String(k)} className="detail-row"><span>{k}</span><span>{v}</span></div>
              ))}
            </div>
            <div className="modal-actions">
              <a href={`${API_BASE}/uploads/fir/FIR_${selectedCase.case_id}.pdf`} target="_blank" rel="noopener noreferrer" className="btn btn-primary">📄 FIR PDF</a>
              <a href={`/track/${selectedCase.case_id}`} target="_blank" rel="noopener noreferrer" className="btn btn-outline">🗺️ Live Track</a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;

import React, { useState, useEffect, useRef, useCallback } from 'react';
import './App.css';
import io from 'socket.io-client';

const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:5000';
const GMAPS_KEY = process.env.REACT_APP_GMAPS_KEY || '';

declare global { interface Window { google: any; } }

interface Stats { total_cases:number; active_cases:number; resolved_cases:number; false_alarms:number; total_users:number; total_stations:number; total_hotspots:number; false_alarm_rate:number; }
interface CaseRecord { case_id:string; status:string; trigger_type:string; start_time:string; ai_classification?:string; confidence_score?:number; user_id:number; }
interface Hotspot { id:number; lat:number; lng:number; risk_score:number; district:string; incident_count:number; crime_types:string[]; }
interface Recommendation { hotspot_id:number; district:string; location:{lat:number;lng:number}; risk_score:number; recommendation:string; priority:string; }

function loadGoogleMaps(key:string):Promise<void> {
  return new Promise((resolve,reject)=>{
    if(window.google?.maps){resolve();return;}
    if(document.getElementById('gmaps-script')){document.getElementById('gmaps-script')!.addEventListener('load',()=>resolve());return;}
    const s=document.createElement('script');
    s.id='gmaps-script';
    s.src=`https://maps.googleapis.com/maps/api/js?key=${key}&libraries=visualization`;
    s.async=true; s.defer=true;
    s.onload=()=>resolve(); s.onerror=()=>reject();
    document.head.appendChild(s);
  });
}

function App() {
  const [stats,setStats]=useState<Stats|null>(null);
  const [cases,setCases]=useState<CaseRecord[]>([]);
  const [hotspots,setHotspots]=useState<Hotspot[]>([]);
  const [recommendations,setRecommendations]=useState<Recommendation[]>([]);
  const [selectedCase,setSelectedCase]=useState<CaseRecord|null>(null);
  const [activeTab,setActiveTab]=useState<'dashboard'|'cases'|'hotspots'|'recommendations'>('dashboard');
  const [loading,setLoading]=useState(true);
  const [token,setToken]=useState('');
  const [loginPhone,setLoginPhone]=useState('');
  const [loginPass,setLoginPass]=useState('');
  const [loggedIn,setLoggedIn]=useState(false);
  const [liveSOS,setLiveSOS]=useState<any[]>([]);
  const [statusFilter,setStatusFilter]=useState('all');
  const [mapsReady,setMapsReady]=useState(false);
  const socketRef=useRef<any>(null);
  const mapRef=useRef<any>(null);
  const heatmapRef=useRef<any>(null);
  const markersRef=useRef<any[]>([]);
  const mapDivRef=useRef<HTMLDivElement>(null);

  // authHeaders unused — fetchDashboard reads token directly from localStorage for interval safety

  useEffect(()=>{
    const saved=localStorage.getItem('police_token');
    if(saved){setToken(saved);setLoggedIn(true);}
  },[]);

  useEffect(()=>{
    if(!loggedIn||!token)return;
    fetchDashboard();
    socketRef.current=io(API_BASE,{transports:['websocket','polling']});
    socketRef.current.on('connect',()=>socketRef.current.emit('join_police'));
    socketRef.current.on('sos_received',(data:any)=>{
      setLiveSOS(prev=>[data,...prev].slice(0,20));
      fetchDashboard();
    });
    // Fast polling every 5 seconds for real-time incident management updates
    const interval=setInterval(fetchDashboard,5000);
    return ()=>{clearInterval(interval);socketRef.current?.disconnect();};
  },[loggedIn,token]); // eslint-disable-line

  useEffect(()=>{
    if(loggedIn&&GMAPS_KEY){
      loadGoogleMaps(GMAPS_KEY).then(()=>setMapsReady(true)).catch(console.error);
    }
  },[loggedIn]);

  const initHotspotMap=useCallback(()=>{
    if(!mapDivRef.current||!window.google||!hotspots.length)return;
    if(!mapRef.current){
      mapRef.current=new window.google.maps.Map(mapDivRef.current,{
        center:{lat:15.9129,lng:79.74},zoom:7,
        styles:darkStyle,mapTypeControl:false,streetViewControl:false,
      });
    }
    // Clear old markers
    markersRef.current.forEach(m=>m.setMap(null));
    markersRef.current=[];

    // Heatmap layer
    const heatData=hotspots.map(h=>({
      location:new window.google.maps.LatLng(h.lat,h.lng),
      weight:h.risk_score*h.incident_count,
    }));
    if(heatmapRef.current){heatmapRef.current.setMap(null);}
    heatmapRef.current=new window.google.maps.visualization.HeatmapLayer({
      data:heatData,map:mapRef.current,
      radius:40,opacity:0.7,
      gradient:['rgba(0,0,0,0)','rgba(74,222,128,0.5)','rgba(251,191,36,0.8)','rgba(248,113,113,1)'],
    });

    // Marker for each hotspot
    hotspots.forEach(h=>{
      const color=h.risk_score>=0.7?'#f87171':h.risk_score>=0.4?'#fbbf24':'#4ade80';
      const marker=new window.google.maps.Marker({
        position:{lat:h.lat,lng:h.lng},map:mapRef.current,
        icon:{path:window.google.maps.SymbolPath.CIRCLE,scale:8+h.incident_count,
          fillColor:color,fillOpacity:0.85,strokeColor:'#fff',strokeWeight:1.5},
        title:`${h.district} — Risk: ${(h.risk_score*100).toFixed(0)}%`,
      });
      const iw=new window.google.maps.InfoWindow({
        content:`<div style="background:#111827;color:#f1f5f9;padding:12px;border-radius:8px;font-family:Inter,sans-serif;min-width:180px">
          <div style="font-weight:700;font-size:14px;margin-bottom:6px">${h.district||'Unknown'}</div>
          <div style="font-size:12px;color:#9ca3af">Risk Score: <span style="color:${color};font-weight:700">${(h.risk_score*100).toFixed(0)}%</span></div>
          <div style="font-size:12px;color:#9ca3af">Incidents: ${h.incident_count}</div>
          ${h.crime_types?.length?`<div style="font-size:11px;color:#6b7280;margin-top:4px">${h.crime_types.slice(0,3).join(' · ')}</div>`:''}
        </div>`
      });
      marker.addListener('click',()=>iw.open(mapRef.current,marker));
      markersRef.current.push(marker);
    });
  },[hotspots]);

  useEffect(()=>{
    if(activeTab==='hotspots'&&mapsReady&&hotspots.length){
      setTimeout(initHotspotMap,120);
    }
  },[activeTab,mapsReady,hotspots,initHotspotMap]);

  const fetchDashboard=async()=>{
    const hdrs={Authorization:`Bearer ${localStorage.getItem('police_token')||''}`};
    try{
      const [dR,cR,rR]=await Promise.all([
        fetch(`${API_BASE}/api/admin/dashboard`,{headers:hdrs}),
        fetch(`${API_BASE}/api/admin/cases?per_page=50`,{headers:hdrs}),
        fetch(`${API_BASE}/api/admin/hotspots/recommendations`,{headers:hdrs}),
      ]);
      if(dR.ok){const d=await dR.json();setStats(d.stats);setHotspots(d.hotspots||[]);}
      if(cR.ok){const d=await cR.json();setCases(d.cases||[]);}
      if(rR.ok){const d=await rR.json();setRecommendations(d.recommendations||[]);}
      setLoading(false);
    }catch{setLoading(false);}
  };

  const handleLogin=async(e:React.FormEvent)=>{
    e.preventDefault();
    try{
      const res=await fetch(`${API_BASE}/api/auth/login`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({phone:loginPhone,password:loginPass})});
      if(res.ok){const d=await res.json();setToken(d.access_token);localStorage.setItem('police_token',d.access_token);setLoggedIn(true);}
      else alert('Invalid credentials');
    }catch{alert('Connection failed');}
  };

  const handleLogout=()=>{setToken('');setLoggedIn(false);localStorage.removeItem('police_token');};
  const fmt=(iso:string)=>{try{return new Date(iso).toLocaleString('en-IN',{timeZone:'Asia/Kolkata'});}catch{return iso;}};
  const statusColor=(s:string)=>({active:'#f87171',resolved:'#4ade80',false_alarm:'#fbbf24'}[s]||'#94a3b8');
  const riskColor=(n:number)=>n>=0.7?'#f87171':n>=0.4?'#fbbf24':'#4ade80';
  const filteredCases=cases.filter(c=>statusFilter==='all'||c.status===statusFilter);

  if(!loggedIn) return (
    <div className="login-screen">
      <div className="login-card">
        <div className="login-logo">
          <svg width="52" height="52" viewBox="0 0 52 52" fill="none">
            <rect width="52" height="52" rx="14" fill="rgba(79,70,229,0.15)"/>
            <circle cx="26" cy="26" r="18" stroke="#4f46e5" strokeWidth="1.5"/>
            <path d="M26 10L31 21H41L27 30L31 42L26 37L21 42L25 30L11 21H21L26 10Z" fill="#818cf8"/>
          </svg>
          <h1>SafeStep</h1><p>Police Command Center — Andhra Pradesh</p>
        </div>
        <form onSubmit={handleLogin} className="login-form">
          <div className="form-group"><label>Phone Number</label><input type="tel" value={loginPhone} onChange={e=>setLoginPhone(e.target.value)} placeholder="+91XXXXXXXXXX" required/></div>
          <div className="form-group"><label>Password</label><input type="password" value={loginPass} onChange={e=>setLoginPass(e.target.value)} placeholder="••••••••" required/></div>
          <button type="submit" className="btn btn-primary full-width">Login to Police Portal</button>
        </form>
        <p className="login-hint">Y4 Prakasam Police Hackathon 2026</p>
      </div>
    </div>
  );

  return (
    <div className="app">
      <nav className="nav-sidebar">
        <div className="nav-logo">
          <svg width="36" height="36" viewBox="0 0 36 36" fill="none"><rect width="36" height="36" rx="10" fill="rgba(79,70,229,0.15)"/><path d="M18 5L22 14H30L19 21L22 30L18 26L14 30L17 21L6 14H14L18 5Z" fill="#818cf8"/></svg>
          <div><div className="nav-title">SafeStep</div><div className="nav-sub">Police Portal</div></div>
        </div>
        <div className="nav-items">
          {[{id:'dashboard',label:'Dashboard',icon:'📊'},{id:'cases',label:'Incidents',icon:'🚨'},{id:'hotspots',label:'Hotspots Map',icon:'🗺️'},{id:'recommendations',label:'AI Patrol',icon:'🤖'}].map(item=>(
            <button key={item.id} className={`nav-item ${activeTab===item.id?'active':''}`} onClick={()=>setActiveTab(item.id as any)}>
              <span>{item.icon}</span><span>{item.label}</span>
              {item.id==='cases'&&cases.filter(c=>c.status==='active').length>0&&(
                <span className="badge danger">{cases.filter(c=>c.status==='active').length}</span>
              )}
            </button>
          ))}
        </div>
        {liveSOS.length>0&&(
          <div className="live-feed">
            <div className="live-feed-title"><span className="live-dot"/>LIVE SOS</div>
            {liveSOS.slice(0,3).map((s,i)=>(
              <div key={i} className="live-item"><div className="live-name">{s.user_name}</div><div className="live-case">{s.case_id}</div></div>
            ))}
          </div>
        )}
        <div className="nav-footer"><button onClick={handleLogout} className="btn-logout">🚪 Logout</button></div>
      </nav>

      <main className="main-content">
        <div className="page-header">
          <div>
            <h1>{activeTab==='dashboard'?'Command Center':activeTab==='cases'?'Incident Management':activeTab==='hotspots'?'Crime Hotspot Map':'AI Patrol Recommendations'}</h1>
            <p className="page-sub">Y4 Prakasam Police Hackathon 2026 — SafeStep AI</p>
          </div>
          <div className="header-actions">
            <button onClick={fetchDashboard} className="btn btn-outline">🔄 Refresh</button>
            <a href={`${API_BASE}/api/admin/report/${new Date().toISOString().slice(0,7)}`} className="btn btn-primary" target="_blank" rel="noopener noreferrer">📄 Monthly Report</a>
          </div>
        </div>

        {loading?(
          <div className="loading-state"><div className="spinner"/><p>Loading command center…</p></div>
        ):(
          <>
            {/* ── DASHBOARD ── */}
            {activeTab==='dashboard'&&(
              <div className="tab-content">
                <div className="stats-grid">
                  {[
                    {label:'Total Incidents',value:stats?.total_cases||0,icon:'📋',color:'#4f46e5'},
                    {label:'Active SOS',value:stats?.active_cases||0,icon:'🚨',color:'#dc2626',urgent:(stats?.active_cases||0)>0},
                    {label:'Resolved',value:stats?.resolved_cases||0,icon:'✅',color:'#16a34a'},
                    {label:'False Alarms',value:stats?.false_alarms||0,icon:'⚠️',color:'#d97706'},
                    {label:'Users',value:stats?.total_users||0,icon:'👤',color:'#7c3aed'},
                    {label:'Stations',value:stats?.total_stations||0,icon:'🚔',color:'#0891b2'},
                    {label:'Hotspots',value:stats?.total_hotspots||0,icon:'🔥',color:'#ea580c'},
                    {label:'False Alarm Rate',value:`${stats?.false_alarm_rate||0}%`,icon:'📉',color:'#94a3b8'},
                  ].map((s,i)=>(
                    <div key={i} className={`stat-card ${(s as any).urgent?'urgent':''}`} style={{'--accent':s.color} as any}>
                      <div className="stat-icon">{s.icon}</div>
                      <div className="stat-body"><div className="stat-value">{s.value}</div><div className="stat-label">{s.label}</div></div>
                      {(s as any).urgent&&<div className="urgent-pulse"/>}
                    </div>
                  ))}
                </div>
                <div className="section">
                  <h2 className="section-title">Recent Incidents</h2>
                  <div className="table-container">
                    <table className="data-table">
                      <thead><tr><th>Case ID</th><th>Status</th><th>Trigger</th><th>AI Class</th><th>Started</th><th>Actions</th></tr></thead>
                      <tbody>
                        {cases.slice(0,10).map(c=>(
                          <tr key={c.case_id} onClick={()=>setSelectedCase(c)} className="clickable-row">
                            <td><code className="case-code">{c.case_id}</code></td>
                            <td><span className="status-chip" style={{background:`${statusColor(c.status)}22`,color:statusColor(c.status)}}>{c.status.toUpperCase()}</span></td>
                            <td>{c.trigger_type?.replace('_',' ')||'Manual'}</td>
                            <td>{c.ai_classification||'—'}</td>
                            <td>{fmt(c.start_time)}</td>
                            <td><button className="btn btn-outline" style={{padding:'4px 8px', fontSize:'11px'}} onClick={(e)=>{e.stopPropagation(); setSelectedCase(c);}}>View Details</button></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {/* ── CASES ── */}
            {activeTab==='cases'&&(
              <div className="tab-content">
                <div className="filter-bar">
                  {['all','active','resolved','false_alarm'].map(s=>(
                    <button key={s} className={`filter-btn ${statusFilter===s?'active':''}`} onClick={()=>setStatusFilter(s)}>
                      {s==='all'?'All':s.replace('_',' ').toUpperCase()}
                      <span className="filter-count">{s==='all'?cases.length:cases.filter(c=>c.status===s).length}</span>
                    </button>
                  ))}
                </div>
                <div className="table-container">
                  <table className="data-table">
                    <thead><tr><th>Case ID</th><th>Status</th><th>Trigger</th><th>AI Class</th><th>Confidence</th><th>Started</th><th>FIR</th></tr></thead>
                    <tbody>
                      {filteredCases.map(c=>(
                        <tr key={c.case_id} className="clickable-row" onClick={()=>setSelectedCase(c)}>
                          <td><code className="case-code">{c.case_id}</code></td>
                          <td><span className="status-chip" style={{background:`${statusColor(c.status)}22`,color:statusColor(c.status)}}>{c.status.toUpperCase()}</span></td>
                          <td>{c.trigger_type?.replace('_',' ')||'Manual'}</td>
                          <td>{c.ai_classification||'—'}</td>
                          <td>{c.confidence_score?`${(c.confidence_score*100).toFixed(0)}%`:'—'}</td>
                          <td>{fmt(c.start_time)}</td>
                          <td><button className="btn btn-outline" style={{padding:'4px 8px', fontSize:'11px'}} onClick={(e)=>{e.stopPropagation(); setSelectedCase(c);}}>Details</button></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* ── HOTSPOTS with Google Maps ── */}
            {activeTab==='hotspots'&&(
              <div className="tab-content hotspot-tab">
                <div className="hotspot-layout">
                  <div className="hotspot-map-container">
                    {mapsReady?(
                      <div ref={mapDivRef} id="police-map" style={{width:'100%',height:'100%',borderRadius:'12px'}}/>
                    ):(
                      <div className="map-fallback">
                        <div className="map-grid-bg"/>
                        <div className="map-center-content">
                          <h2>🗺️ Crime Heatmap — Andhra Pradesh</h2>
                          <p>{hotspots.length} active hotspot clusters</p>
                          <div className="legend">
                            <div className="legend-item"><span className="legend-dot high"/>High Risk (≥70)</div>
                            <div className="legend-item"><span className="legend-dot medium"/>Medium (40–70)</div>
                            <div className="legend-item"><span className="legend-dot low"/>Low (&lt;40)</div>
                          </div>
                          {hotspots.slice(0,25).map(h=>{
                            const x=((h.lng-76)/(84-76))*100;
                            const y=((17-h.lat)/(17-12))*100;
                            return(<div key={h.id} className="hotspot-dot"
                              style={{left:`${Math.max(2,Math.min(98,x))}%`,top:`${Math.max(2,Math.min(98,y))}%`,
                                background:riskColor(h.risk_score),width:`${18+h.incident_count*2}px`,height:`${18+h.incident_count*2}px`}}
                              title={`${h.district}: ${(h.risk_score*100).toFixed(0)}% risk`}/>);
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                  <div className="hotspot-list">
                    <h3>Top Risk Zones</h3>
                    {hotspots.slice(0,15).map((h,i)=>(
                      <div key={h.id} className="hotspot-item">
                        <div className="hotspot-rank">#{i+1}</div>
                        <div className="hotspot-body">
                          <div className="hotspot-district">{h.district||'Unknown'}</div>
                          <div className="hotspot-coords">{h.lat.toFixed(4)}, {h.lng.toFixed(4)}</div>
                          {h.crime_types?.length>0&&(<div className="crime-tags">{h.crime_types.slice(0,2).map(t=><span key={t} className="crime-tag">{t}</span>)}</div>)}
                        </div>
                        <div className="hotspot-score" style={{color:riskColor(h.risk_score)}}>{(h.risk_score*100).toFixed(0)}<span>risk</span></div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* ── AI RECOMMENDATIONS ── */}
            {activeTab==='recommendations'&&(
              <div className="tab-content">
                <div className="recs-header">
                  <div className="ai-badge">🤖 AI-Generated Patrol Recommendations</div>
                  <p>Based on DBSCAN clustering of last 30 days of incidents</p>
                </div>
                <div className="recs-grid">
                  {recommendations.map(r=>(
                    <div key={r.hotspot_id} className={`rec-card ${r.priority.toLowerCase()}`}>
                      <div className="rec-header">
                        <span className={`priority-badge ${r.priority.toLowerCase()}`}>{r.priority}</span>
                        <span className="rec-district">{r.district}</span>
                      </div>
                      <p className="rec-text">{r.recommendation}</p>
                      <div className="rec-footer">
                        <span>📍 {r.location.lat.toFixed(4)}, {r.location.lng.toFixed(4)}</span>
                        <span className="risk-badge">Risk: {(r.risk_score*100).toFixed(0)}%</span>
                      </div>
                    </div>
                  ))}
                  {recommendations.length===0&&<div className="empty-state"><p>🤖 No AI recommendations yet. Nightly DBSCAN job generates these automatically.</p></div>}
                </div>
              </div>
            )}
          </>
        )}
      </main>

      {selectedCase&&(
        <div className="modal-overlay" onClick={()=>setSelectedCase(null)}>
          <div className="modal" onClick={e=>e.stopPropagation()}>
            <div className="modal-header"><h2>Case Detail: {selectedCase.case_id}</h2><button onClick={()=>setSelectedCase(null)} className="modal-close">✕</button></div>
            <div className="modal-body">
              {[['Status',selectedCase.status.toUpperCase()],
                ['Trigger',selectedCase.trigger_type.replace('_',' ').toUpperCase()],
                ['AI Class',selectedCase.ai_classification||'Manual Trigger'],
                ['Confidence',selectedCase.confidence_score?`${(selectedCase.confidence_score*100).toFixed(1)}%`:'—'],
                ['Started',fmt(selectedCase.start_time)]
              ].map(([k,v])=>(<div key={String(k)} className="detail-row"><span>{k}</span><span style={{fontWeight:600}}>{v}</span></div>))}
            </div>
            
            <div className="modal-actions" style={{display:'flex', flexDirection:'column', gap:'10px', marginTop:'20px'}}>
              <h3 style={{fontSize:'12px', color:'#9ca3af', textTransform:'uppercase'}}>Actions</h3>
              <div style={{display:'flex', gap:'10px'}}>
                <a href={`${API_BASE}/uploads/fir/FIR_${selectedCase.case_id}.pdf`} target="_blank" rel="noopener noreferrer" className="btn btn-primary" style={{flex:1}}>📄 Download FIR</a>
                <button 
                  onClick={async () => {
                    try {
                      const res = await fetch(`${API_BASE}/api/sos/case/${selectedCase.case_id}`);
                      const data = await res.json();
                      if (data.gps_trail && data.gps_trail.length > 0) {
                        const latest = data.gps_trail[data.gps_trail.length - 1];
                        window.open(`https://www.google.com/maps/search/?api=1&query=${latest.lat},${latest.lng}`, '_blank');
                      } else {
                        alert('No GPS coordinates found for this case yet.');
                      }
                    } catch {
                      alert('Failed to fetch latest location');
                    }
                  }} 
                  className="btn btn-outline" style={{flex:1}}
                >
                  📍 Open in G-Maps
                </button>
              </div>
              
              <div style={{fontSize:'12px', color:'#6b7280', marginTop:'10px', textAlign:'center', background:'rgba(255,255,255,0.05)', padding:'10px', borderRadius:'8px'}}>
                For continuous live tracking, open the <strong>Guardian Dashboard</strong> and search for Case ID <code>{selectedCase.case_id}</code>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const darkStyle=[
  {elementType:'geometry',stylers:[{color:'#0b0d14'}]},
  {elementType:'labels.text.stroke',stylers:[{color:'#0b0d14'}]},
  {elementType:'labels.text.fill',stylers:[{color:'#6b7280'}]},
  {featureType:'road',elementType:'geometry',stylers:[{color:'#1f2937'}]},
  {featureType:'road.highway',elementType:'geometry',stylers:[{color:'#374151'}]},
  {featureType:'water',elementType:'geometry',stylers:[{color:'#0f172a'}]},
  {featureType:'poi',elementType:'labels',stylers:[{visibility:'off'}]},
];

export default App;

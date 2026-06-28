import React, { useState, useEffect, useRef, useCallback } from 'react';
import './App.css';
import io from 'socket.io-client';
import { Shield, MapPin, AlertCircle, Phone, Clock, Battery, Navigation, User, RefreshCw, LogOut } from 'lucide-react';

const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:5000';
const GMAPS_KEY = process.env.REACT_APP_GMAPS_KEY || '';

declare global {
  interface Window {
    google: any;
    initGuardianMap: () => void;
  }
}

interface LiveLocation {
  lat: number;
  lng: number;
  timestamp: string;
  battery?: number;
}

interface TrackedCase {
  case_id: string;
  status: string;
  start_time: string;
  trigger_type: string;
  user_id: number;
  user_name?: string;
  user_phone?: string;
  user_belongings?: {
    vehicle?: string;
    blood_group?: string;
    medical_notes?: string;
  };
  nearest_station?: any;
  fir_pdf_url?: string;
  liveLocation?: LiveLocation;
  trail: LiveLocation[];
}

// Load Google Maps script dynamically
function loadGoogleMaps(key: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (window.google && window.google.maps) { resolve(); return; }
    const existing = document.getElementById('gmaps-script');
    if (existing) { existing.addEventListener('load', () => resolve()); return; }
    const script = document.createElement('script');
    script.id = 'gmaps-script';
    script.src = `https://maps.googleapis.com/maps/api/js?key=${key}&libraries=visualization,geometry`;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Google Maps failed to load'));
    document.head.appendChild(script);
  });
}

function App() {
  const [token, setToken] = useState('');
  const [loginPhone, setLoginPhone] = useState('');
  const [loginPass, setLoginPass] = useState('');
  const [loggedIn, setLoggedIn] = useState(false);
  const [trackingCaseId, setTrackingCaseId] = useState('');
  const [activeCase, setActiveCase] = useState<TrackedCase | null>(null);
  const [error, setError] = useState('');
  const [mapsReady, setMapsReady] = useState(false);
  const [locationCount, setLocationCount] = useState(0);

  const socketRef = useRef<any>(null);
  const mapRef = useRef<any>(null);
  const markerRef = useRef<any>(null);
  const polylineRef = useRef<any>(null);
  const mapDivRef = useRef<HTMLDivElement>(null);
  const trailRef = useRef<LiveLocation[]>([]);

  // Persist login
  useEffect(() => {
    const saved = localStorage.getItem('guardian_token');
    if (saved) { setToken(saved); setLoggedIn(true); }
  }, []);

  // Load Google Maps after login
  useEffect(() => {
    if (!loggedIn || !GMAPS_KEY) return;
    loadGoogleMaps(GMAPS_KEY)
      .then(() => setMapsReady(true))
      .catch(err => console.error('Maps load error:', err));
  }, [loggedIn]);

  const initMap = useCallback(() => {
    if (!mapDivRef.current || !window.google || mapRef.current) return;
    
    // Default to AP, or use victim's first known location
    const center = trailRef.current.length 
      ? { lat: trailRef.current[trailRef.current.length - 1].lat, lng: trailRef.current[trailRef.current.length - 1].lng }
      : { lat: 15.9129, lng: 79.7400 };

    mapRef.current = new window.google.maps.Map(mapDivRef.current, {
      center,
      zoom: 15,
      mapTypeId: 'roadmap',
      styles: darkMapStyle,
      disableDefaultUI: false,
      zoomControl: true,
      mapTypeControl: false,
      streetViewControl: false,
      fullscreenControl: true,
    });
    
    // Force a redraw of the trail now that map exists
    setLocationCount(c => c + 1);
  }, []);

  // Init map when mapsReady and activeCase panel is shown
  useEffect(() => {
    if (mapsReady && activeCase && mapDivRef.current) {
      initMap();
    }
  }, [mapsReady, activeCase, initMap]);

  // Update map when trail changes
  useEffect(() => {
    if (!mapRef.current || !window.google) return;
    const trail = trailRef.current;
    if (!trail.length) return;

    const latLngs = trail.map(p => new window.google.maps.LatLng(p.lat, p.lng));
    const latest = latLngs[latLngs.length - 1];

    // Update polyline trail
    if (!polylineRef.current) {
      polylineRef.current = new window.google.maps.Polyline({
        path: latLngs,
        geodesic: true,
        strokeColor: '#818cf8',
        strokeOpacity: 0.9,
        strokeWeight: 3,
        map: mapRef.current,
      });
    } else {
      polylineRef.current.setPath(latLngs);
    }

    // Update main marker
    if (!markerRef.current) {
      markerRef.current = new window.google.maps.Marker({
        position: latest,
        map: mapRef.current,
        icon: {
          path: window.google.maps.SymbolPath.CIRCLE,
          scale: 10,
          fillColor: '#f87171',
          fillOpacity: 1,
          strokeColor: '#fff',
          strokeWeight: 2,
        },
        title: 'Live Location',
        zIndex: 10,
      });
    } else {
      markerRef.current.setPosition(latest);
    }

    // Pan to latest location
    mapRef.current.panTo(latest);
    if (mapRef.current.getZoom() < 14) mapRef.current.setZoom(15);

  }, [locationCount]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch(`${API_BASE}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: loginPhone, password: loginPass })
      });
      const data = await res.json();
      if (res.ok && data.access_token) {
        setToken(data.access_token);
        localStorage.setItem('guardian_token', data.access_token);
        setLoggedIn(true);
        initSocket(data.access_token);
      } else {
        setError(data.error || 'Login failed');
      }
    } catch {
      setError('Network error');
    }
  };

  const initSocket = (authToken: string) => {
    if (socketRef.current) socketRef.current.disconnect();
    const socket = io(API_BASE, {
      extraHeaders: { Authorization: `Bearer ${authToken}` }
    });
    socket.on('connect', () => console.log('Guardian Socket Connected'));
    socket.on('location_update', (data: any) => {
      const newLoc: LiveLocation = { lat: data.lat, lng: data.lng, timestamp: data.timestamp, battery: data.battery };
      trailRef.current = [...trailRef.current, newLoc];
      setActiveCase(prev => {
        if (!prev || prev.case_id !== data.case_id) return prev;
        return { ...prev, liveLocation: newLoc, trail: trailRef.current };
      });
      setLocationCount(c => c + 1);
    });
    socketRef.current = socket;
  };

  const trackCase = async () => {
    if (!trackingCaseId) return;
    setError('');
    try {
      const res = await fetch(`${API_BASE}/api/sos/case/${trackingCaseId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok) {
        const trail: LiveLocation[] = data.gps_trail || [];
        trailRef.current = trail;
        const liveLocation = trail.length ? trail[trail.length - 1] : undefined;
        setActiveCase({
          case_id: data.case_id,
          status: data.status,
          start_time: data.start_time || new Date().toISOString(),
          trigger_type: data.trigger_type || 'manual',
          user_id: 0,
          user_name: data.user_name,
          user_phone: data.user_phone,
          user_belongings: data.user_belongings,
          nearest_station: data.nearest_station,
          fir_pdf_url: data.fir_pdf_url,
          trail,
          liveLocation,
        });
        setLocationCount(c => c + 1);
        // Join socket room
        if (socketRef.current) {
          socketRef.current.emit('join', { room: `case_${data.case_id}` });
        }
      } else {
        setError(data.error || 'Case not found or access denied');
      }
    } catch {
      setError('Network error');
    }
  };

  const handleLogout = () => {
    setToken('');
    setLoggedIn(false);
    setActiveCase(null);
    localStorage.removeItem('guardian_token');
    if (socketRef.current) socketRef.current.disconnect();
  };

  const timeSince = (iso: string) => {
    try {
      const secs = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
      if (secs < 60) return `${secs}s ago`;
      if (secs < 3600) return `${Math.floor(secs / 60)}m ago`;
      return `${Math.floor(secs / 3600)}h ago`;
    } catch { return '—'; }
  };

  if (!loggedIn) {
    return (
      <div className="login-container">
        <div className="login-card">
          <div className="logo-header">
            <div className="logo-icon-wrap">
              <Shield size={36} color="#818cf8" />
            </div>
            <h1>Guardian Portal</h1>
            <p>Track your loved ones during emergencies</p>
          </div>
          <form onSubmit={handleLogin}>
            <div className="input-group">
              <Phone size={16} color="#6b7280" className="input-icon" />
              <input
                type="text"
                placeholder="Phone Number"
                value={loginPhone}
                onChange={e => setLoginPhone(e.target.value)}
                className="dark-input"
              />
            </div>
            <div className="input-group">
              <Shield size={16} color="#6b7280" className="input-icon" />
              <input
                type="password"
                placeholder="Password"
                value={loginPass}
                onChange={e => setLoginPass(e.target.value)}
                className="dark-input"
              />
            </div>
            {error && <div className="error-msg">⚠ {error}</div>}
            <button type="submit" className="primary-btn">
              <Shield size={18} /> Sign In Securely
            </button>
          </form>
          <p className="login-footer">SafeStep — Powered by AI Guardian</p>
        </div>
      </div>
    );
  }

  return (
    <div className="dashboard-layout">
      <nav className="sidebar">
        <div className="sidebar-header">
          <div className="sidebar-logo">
            <Shield size={28} color="#818cf8" />
          </div>
          <div>
            <div className="sidebar-title">SafeStep</div>
            <div className="sidebar-sub">Guardian Portal</div>
          </div>
        </div>

        <div className="nav-items">
          <div className="nav-item active">
            <MapPin size={18} />
            <span>Live Tracking</span>
          </div>
        </div>

        {/* Case Status Panel in Sidebar */}
        {activeCase && (
          <div className="sidebar-case-panel">
            <div className="sidebar-case-header">
              <div className="pulse-dot" />
              <span>LIVE</span>
            </div>
            <div className="sidebar-case-id">{activeCase.case_id}</div>
            <div className={`status-badge-sm ${activeCase.status}`}>
              {activeCase.status.replace('_', ' ').toUpperCase()}
            </div>

            <div className="sidebar-stats">
              <div className="sidebar-stat">
                <MapPin size={14} color="#818cf8" />
                <div>
                  <div className="sidebar-stat-label">Coordinates</div>
                  <div className="sidebar-stat-value mono">
                    {activeCase.liveLocation
                      ? `${activeCase.liveLocation.lat.toFixed(5)}, ${activeCase.liveLocation.lng.toFixed(5)}`
                      : 'Waiting…'}
                  </div>
                </div>
              </div>

              <div className="sidebar-stat">
                <Battery size={14} color="#34d399" />
                <div>
                  <div className="sidebar-stat-label">Battery</div>
                  <div className="sidebar-stat-value">
                    {activeCase.liveLocation?.battery ? `${activeCase.liveLocation.battery}%` : '—'}
                  </div>
                </div>
              </div>

              <div className="sidebar-stat">
                <Clock size={14} color="#fbbf24" />
                <div>
                  <div className="sidebar-stat-label">Last Ping</div>
                  <div className="sidebar-stat-value">
                    {activeCase.liveLocation ? timeSince(activeCase.liveLocation.timestamp) : '—'}
                  </div>
                </div>
              </div>

              <div className="sidebar-stat">
                <Navigation size={14} color="#a78bfa" />
                <div>
                  <div className="sidebar-stat-label">Trail Points</div>
                  <div className="sidebar-stat-value">{activeCase.trail.length}</div>
                </div>
              </div>

              {activeCase.nearest_station && (
                <div className="sidebar-stat">
                  <Phone size={14} color="#f87171" />
                  <div>
                    <div className="sidebar-stat-label">Nearest Station</div>
                    <div className="sidebar-stat-value">{activeCase.nearest_station.name}</div>
                  </div>
                </div>
              )}
            </div>

            {activeCase.user_name && (
              <div className="sidebar-user" style={{padding:'12px', background:'rgba(255,255,255,0.05)', borderRadius:'12px', marginTop:'12px'}}>
                <div style={{display:'flex', alignItems:'center', gap:'8px', marginBottom:'8px'}}>
                  <User size={16} color="#818cf8" />
                  <span style={{fontWeight:600, color:'#f1f5f9'}}>{activeCase.user_name}</span>
                </div>
                {activeCase.user_phone && <div style={{fontSize:'12px', color:'#9ca3af', marginBottom:'4px'}}>📞 {activeCase.user_phone}</div>}
                
                {activeCase.user_belongings && (
                  <div style={{marginTop:'8px', borderTop:'1px solid rgba(255,255,255,0.1)', paddingTop:'8px'}}>
                    {activeCase.user_belongings.vehicle && <div style={{fontSize:'12px', color:'#cbd5e1'}}>🚗 <b>Vehicle:</b> {activeCase.user_belongings.vehicle}</div>}
                    {activeCase.user_belongings.blood_group && <div style={{fontSize:'12px', color:'#ef4444', marginTop:'4px'}}>🩸 <b>Blood Group:</b> {activeCase.user_belongings.blood_group}</div>}
                    {activeCase.user_belongings.medical_notes && <div style={{fontSize:'12px', color:'#fbbf24', marginTop:'4px'}}>⚕️ <b>Medical:</b> {activeCase.user_belongings.medical_notes}</div>}
                  </div>
                )}
              </div>
            )}

            <div style={{display:'flex', flexDirection:'column', gap:'8px', marginTop:'16px'}}>
              {activeCase.liveLocation && (
                <button
                  onClick={() => window.open(`https://www.google.com/maps/search/?api=1&query=${activeCase.liveLocation!.lat},${activeCase.liveLocation!.lng}`, '_blank')}
                  className="primary-btn"
                  style={{width:'100%', justifyContent:'center'}}
                >
                  📍 Open in G-Maps
                </button>
              )}

              {activeCase.fir_pdf_url && (
                <a
                  href={`${API_BASE}${activeCase.fir_pdf_url}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="fir-btn"
                >
                  📄 Download FIR
                </a>
              )}
            </div>
          </div>
        )}

        <div className="sidebar-footer">
          <button className="logout-btn" onClick={handleLogout}>
            <LogOut size={16} /> Logout
          </button>
        </div>
      </nav>

      <main className="main-content">
        <header className="top-header">
          <div className="header-left">
            <h2>Live Emergency Tracker</h2>
            <span className="header-sub">Real-time GPS tracking via Socket.io</span>
          </div>
          <div className="search-bar">
            <MapPin size={16} color="#6b7280" />
            <input
              type="text"
              placeholder="Enter Case ID  (e.g. SS-2026-06-28-123456)"
              value={trackingCaseId}
              onChange={e => setTrackingCaseId(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && trackCase()}
            />
            <button onClick={trackCase} className="track-btn">
              <Navigation size={16} /> Track
            </button>
            {activeCase && (
              <button onClick={() => { window.location.reload(); }} className="reset-btn" title="Clear tracking">
                <RefreshCw size={16} />
              </button>
            )}
          </div>
        </header>

        {error && <div className="error-banner">⚠ {error}</div>}

        <div className="map-area">
          {activeCase ? (
            <div className="map-wrapper" ref={mapDivRef} id="guardian-map">
              {!mapsReady && (
                <div className="map-loading">
                  <div className="spinner" />
                  <p>Initializing maps…</p>
                </div>
              )}
            </div>
          ) : (
            <div className="empty-state">
              <div className="empty-icon">
                <Shield size={64} color="#1f2937" />
                <div className="radar-ring r1" />
                <div className="radar-ring r2" />
                <div className="radar-ring r3" />
              </div>
              <h2>No Active Tracking Session</h2>
              <p>Enter an SOS Case ID in the search bar above to begin live location tracking</p>
              <div className="empty-hint">
                <AlertCircle size={14} color="#4f46e5" />
                <span>Case IDs follow the format: SS-YYYY-MM-DD-XXXXXX</span>
              </div>
            </div>
          )}
        </div>

        {/* Bottom strip: trail timeline */}
        {activeCase && activeCase.trail.length > 0 && (
          <div className="trail-strip">
            <div className="trail-label">
              <Navigation size={14} color="#818cf8" /> GPS Trail — {activeCase.trail.length} points
            </div>
            <div className="trail-timeline">
              {activeCase.trail.slice(-8).map((p, i) => (
                <div key={i} className="trail-point">
                  <div className="trail-dot" style={{ opacity: 0.4 + i * 0.08 }} />
                  <div className="trail-time">{new Date(p.timestamp).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</div>
                  <div className="trail-coords">{p.lat.toFixed(4)}, {p.lng.toFixed(4)}</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

// Dark map style (matching app theme)
const darkMapStyle = [
  { elementType: 'geometry', stylers: [{ color: '#0b0d14' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#0b0d14' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#6b7280' }] },
  { featureType: 'administrative.locality', elementType: 'labels.text.fill', stylers: [{ color: '#9ca3af' }] },
  { featureType: 'poi', elementType: 'labels.text.fill', stylers: [{ color: '#6b7280' }] },
  { featureType: 'poi.park', elementType: 'geometry', stylers: [{ color: '#111827' }] },
  { featureType: 'poi.park', elementType: 'labels.text.fill', stylers: [{ color: '#4b5563' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#1f2937' }] },
  { featureType: 'road', elementType: 'geometry.stroke', stylers: [{ color: '#111827' }] },
  { featureType: 'road', elementType: 'labels.text.fill', stylers: [{ color: '#6b7280' }] },
  { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#374151' }] },
  { featureType: 'road.highway', elementType: 'geometry.stroke', stylers: [{ color: '#1f2937' }] },
  { featureType: 'road.highway', elementType: 'labels.text.fill', stylers: [{ color: '#9ca3af' }] },
  { featureType: 'transit', elementType: 'geometry', stylers: [{ color: '#111827' }] },
  { featureType: 'transit.station', elementType: 'labels.text.fill', stylers: [{ color: '#6b7280' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#0f172a' }] },
  { featureType: 'water', elementType: 'labels.text.fill', stylers: [{ color: '#374151' }] },
  { featureType: 'water', elementType: 'labels.text.stroke', stylers: [{ color: '#0f172a' }] },
];

export default App;

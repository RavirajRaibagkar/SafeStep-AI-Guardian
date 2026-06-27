import React, { useState, useEffect, useRef } from 'react';
import './App.css';
import io from 'socket.io-client';
import { Shield, MapPin, AlertCircle, Phone, Clock, Battery } from 'lucide-react';

const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:5000';

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
  liveLocation?: LiveLocation;
  trail: LiveLocation[];
}

function App() {
  const [token, setToken] = useState('');
  const [loginPhone, setLoginPhone] = useState('');
  const [loginPass, setLoginPass] = useState('');
  const [loggedIn, setLoggedIn] = useState(false);
  
  const [trackingCaseId, setTrackingCaseId] = useState('');
  const [activeCase, setActiveCase] = useState<TrackedCase | null>(null);
  const [error, setError] = useState('');
  const socketRef = useRef<any>(null);

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
        setLoggedIn(true);
        initSocket(data.access_token);
      } else {
        setError(data.error || 'Login failed');
      }
    } catch (e) {
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
      console.log('Location Update:', data);
      setActiveCase(prev => {
        if (!prev || prev.case_id !== data.case_id) return prev;
        const newLoc = { lat: data.lat, lng: data.lng, timestamp: data.timestamp, battery: data.battery };
        return {
          ...prev,
          liveLocation: newLoc,
          trail: [...prev.trail, newLoc]
        };
      });
    });

    socketRef.current = socket;
  };

  const trackCase = async () => {
    if (!trackingCaseId) return;
    setError('');
    try {
      const res = await fetch(`${API_BASE}/api/location/trail/${trackingCaseId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok) {
        setActiveCase({
          case_id: data.case_id,
          status: data.status,
          start_time: new Date().toISOString(), // Mocked for simplicity
          trigger_type: 'unknown',
          user_id: 0,
          trail: data.trail || [],
          liveLocation: data.trail?.length ? data.trail[data.trail.length - 1] : undefined
        });
        // Join the room for live updates
        if (socketRef.current) {
          socketRef.current.emit('join', { room: `case_${data.case_id}` });
        }
      } else {
        setError(data.error || 'Access denied or case not found');
      }
    } catch (e) {
      setError('Network error');
    }
  };

  if (!loggedIn) {
    return (
      <div className="login-container">
        <div className="login-card">
          <div className="logo-header">
            <Shield size={48} color="#818cf8" />
            <h1>Guardian Portal</h1>
            <p>Track your loved ones during emergencies</p>
          </div>
          <form onSubmit={handleLogin}>
            <input 
              type="text" 
              placeholder="Your Phone Number" 
              value={loginPhone} 
              onChange={e => setLoginPhone(e.target.value)} 
              className="dark-input"
            />
            <input 
              type="password" 
              placeholder="Password" 
              value={loginPass} 
              onChange={e => setLoginPass(e.target.value)} 
              className="dark-input"
            />
            {error && <div className="error-msg">{error}</div>}
            <button type="submit" className="primary-btn">Login</button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="dashboard-layout">
      <nav className="sidebar">
        <div className="sidebar-header">
          <Shield size={32} color="#818cf8" />
          <h2>SafeStep<br/><span>Guardian</span></h2>
        </div>
        <div className="nav-items">
          <div className="nav-item active">
            <MapPin size={20} /> Live Tracking
          </div>
        </div>
      </nav>

      <main className="main-content">
        <header className="top-header">
          <div className="search-bar">
            <input 
              type="text" 
              placeholder="Enter SOS Case ID (e.g., SS-2026-06-25-123456)" 
              value={trackingCaseId}
              onChange={e => setTrackingCaseId(e.target.value)}
            />
            <button onClick={trackCase}>Track</button>
          </div>
        </header>

        {error && <div className="error-banner">{error}</div>}

        <div className="content-grid">
          {activeCase ? (
            <div className="case-tracker-view">
              <div className="tracker-header">
                <div>
                  <h3>Case: {activeCase.case_id}</h3>
                  <span className={`status-badge ${activeCase.status}`}>
                    {activeCase.status.toUpperCase()}
                  </span>
                </div>
                <div className="live-indicator">
                  <div className="pulse-dot"></div> Live
                </div>
              </div>

              <div className="stats-row">
                <div className="stat-card">
                  <MapPin size={24} color="#818cf8" />
                  <div>
                    <h4>Latest Coordinates</h4>
                    <p>{activeCase.liveLocation ? `${activeCase.liveLocation.lat.toFixed(6)}, ${activeCase.liveLocation.lng.toFixed(6)}` : 'Waiting for GPS...'}</p>
                  </div>
                </div>
                <div className="stat-card">
                  <Battery size={24} color="#34d399" />
                  <div>
                    <h4>Battery Level</h4>
                    <p>{activeCase.liveLocation?.battery ? `${activeCase.liveLocation.battery}%` : 'Unknown'}</p>
                  </div>
                </div>
                <div className="stat-card">
                  <Clock size={24} color="#fbbf24" />
                  <div>
                    <h4>Last Update</h4>
                    <p>{activeCase.liveLocation ? new Date(activeCase.liveLocation.timestamp).toLocaleTimeString() : '--'}</p>
                  </div>
                </div>
              </div>

              <div className="map-placeholder">
                <div className="radar-animation">
                  <div className="radar-sweep"></div>
                  {activeCase.liveLocation && (
                    <div className="pin-pulse">
                      <MapPin size={32} color="#f87171" fill="#f87171" />
                    </div>
                  )}
                </div>
                {activeCase.liveLocation ? (
                  <p className="map-text">Tracking subject actively...</p>
                ) : (
                  <p className="map-text">Waiting for first location ping...</p>
                )}
              </div>
            </div>
          ) : (
            <div className="empty-state">
              <AlertCircle size={64} color="#4b5563" />
              <h2>No Active Tracking</h2>
              <p>Enter an emergency Case ID above to begin live tracking</p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

export default App;

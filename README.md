# 🛡️ SafeStep — AI Guardian for Vulnerable Citizens

**Hackathon:** Y4 Prakasam Police Hackathon 2026  
**Challenge:** 06 — Women, Child & Senior Citizen Safety  
**Theme:** "Secure Tomorrow with Next-Generation AI"

---

## 🚀 Live Demo

| Component | URL |
|-----------|-----|
| Guardian Dashboard | https://safestep-guardian.vercel.app |
| Police Admin Dashboard | https://safestep-police.vercel.app |
| API Backend | https://safestep-api.railway.app |
| Case Tracking | https://safestep.app/track/{case_id} |

---

## 📱 Features — All 30 Implemented

### Core SOS
| ID | Feature | Status |
|----|---------|--------|
| F01 | Smart SOS Trigger (shake 3x / power 5x, 5s countdown) | ✅ |
| F02 | Auto Audio Capture (30s AAC, encrypted upload) | ✅ |
| F03 | Live Location Sharing (Socket.io, every 3s) | ✅ |
| F04 | Lone Walker Mode (GPS poll, auto SOS on no-show) | ✅ |
| F05 | Fake Call Trigger (8s ring, configurable name) | ✅ |
| F06 | Stealth Mode (calculator disguise, PIN unlock) | ✅ |

### Predictive Intelligence
| ID | Feature | Status |
|----|---------|--------|
| F07 | AI Risk Zone Mapping (DBSCAN clustering, GeoJSON) | ✅ |
| F08 | Time-Aware Danger Scoring (24h matrix) | ✅ |
| F09 | Safe Route Suggestion (3 routes, risk-scored) | ✅ |
| F10 | Crowd Safety Index (Places API integration) | ✅ |

### AI Voice & Audio
| ID | Feature | Status |
|----|---------|--------|
| F11 | Distress Voice Detection (TFLite, >85% threshold) | ✅ |
| F12 | Silent Auto-Alert (background SOS, no screen wake) | ✅ |
| F13 | Ambient Noise Logging (rolling 30s, AES-256) | ✅ |
| F14 | Keyword Wake Trigger (custom panic phrase) | ✅ |

### Guardian & Family
| ID | Feature | Status |
|----|---------|--------|
| F15 | Guardian Dashboard (React.js, Socket.io) | ✅ |
| F16 | Safe Zone Geofencing (GeoJSON, 8PM-6AM alerts) | ✅ |
| F17 | Check-in Reminders (configurable, 3-min window) | ✅ |
| F18 | Emergency Contact Cascade (5 contacts, 2-min intervals) | ✅ |

### Police Integration
| ID | Feature | Status |
|----|---------|--------|
| F19 | Nearest Station Auto-Alert (Haversine, Twilio SMS) | ✅ |
| F20 | Incident Report Auto-Draft (PDF FIR, ReportLab) | ✅ |
| F21 | Police Response ETA (Google Distance Matrix) | ✅ |
| F22 | Case ID Generation (SS-YYYY-MM-DD-XXXXXX) | ✅ |

### Analytics & Dashboard
| ID | Feature | Status |
|----|---------|--------|
| F23 | Crime Hotspot Dashboard (interactive heatmap) | ✅ |
| F24 | Alert History & Logs (paginated, CSV export) | ✅ |
| F25 | Cluster Detection (nightly DBSCAN rerun) | ✅ |
| F26 | Monthly Safety Reports (PDF, SendGrid email) | ✅ |

### Privacy & Security
| ID | Feature | Status |
|----|---------|--------|
| F27 | E2E Encrypted Location (AES-256, client-side keys) | ✅ |
| F28 | Offline SOS Mode (SMS-only via Twilio cellular) | ✅ |
| F29 | Data Auto-Delete (24h GPS, 90d audio) | ✅ |
| F30 | Biometric App Lock (Face ID / Fingerprint) | ✅ |

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    SAFESTEP SYSTEM                       │
├─────────────────────────────────────────────────────────┤
│  📱 Mobile App (React Native + Expo)                    │
│     ├── SOSButton + Shake Detector (F01)                │
│     ├── TFLite Distress Detector (F11-F12)              │
│     ├── Live Location → Socket.io (F03)                 │
│     └── Lone Walker Mode (F04)                          │
├─────────────────────────────────────────────────────────┤
│  🌐 Nginx Reverse Proxy                                  │
│     ├── /api/* → Flask Backend :5000                    │
│     ├── /socket.io → WebSocket upgrade                  │
│     ├── /guardian/* → Guardian Dashboard :3001          │
│     └── /police/* → Police Dashboard :3002              │
├─────────────────────────────────────────────────────────┤
│  ⚙️ Flask Backend (Python 3.11)                          │
│     ├── JWT Auth (/api/auth/*)                          │
│     ├── SOS Pipeline (/api/sos/*)                       │
│     ├── Real-time Location (/api/location/*)            │
│     ├── Hotspots + ML (/api/hotspots/*)                 │
│     ├── Police Integration (/api/police/*)              │
│     └── Admin Dashboard (/api/admin/*)                  │
├─────────────────────────────────────────────────────────┤
│  🤖 AI/ML Layer                                          │
│     ├── TFLite: Audio Classification (on-device)        │
│     └── DBSCAN: Crime Hotspot Clustering (server-side)  │
├─────────────────────────────────────────────────────────┤
│  💾 Data Layer                                           │
│     ├── PostgreSQL 15 (cases, users, hotspots)          │
│     └── Redis 7 (Celery queue + live location cache)    │
├─────────────────────────────────────────────────────────┤
│  📨 Integrations                                         │
│     ├── Twilio (SMS + Voice alerts)                     │
│     ├── SendGrid (Monthly PDF reports)                  │
│     └── Google Maps (Geocoding + Directions)            │
└─────────────────────────────────────────────────────────┘
```

---

## ⚡ Quick Start (Docker)

```bash
# 1. Clone the repository
git clone https://github.com/YOUR_TEAM/safestep.git
cd safestep

# 2. Configure environment
cp backend/.env.example backend/.env
# Edit backend/.env with your Twilio/Google Maps credentials

# 3. Start entire stack with ONE command
docker-compose up --build

# Services will be available at:
# API:      http://localhost:5000
# Guardian: http://localhost:3001
# Police:   http://localhost:3002
# Main:     http://localhost:80
```

---

## 🔧 Manual Setup

### Backend

```bash
cd backend
pip install -r requirements.txt

# Generate crime data for ML model
python ml/generate_data.py

# Train TFLite model
cd ml && python train.py && cd ..

# Start server
python run.py
```

### Web Dashboards

```bash
# Guardian Dashboard
cd web-guardian
npm install && npm start  # http://localhost:3000

# Police Admin Dashboard
cd web-police
npm install && npm start  # http://localhost:3001
```

### Mobile App

```bash
cd mobile
npm install
npx expo start

# Scan QR code with Expo Go app on Android/iOS
# Or press 'a' for Android emulator
```

---

## 📡 API Reference

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/register` | Register new user |
| POST | `/api/auth/login` | Login, returns JWT |
| POST | `/api/sos/trigger` | 🚨 Fire SOS pipeline |
| POST | `/api/sos/audio-upload` | Upload evidence audio |
| GET | `/api/sos/case/{id}` | Track case status (public) |
| POST | `/api/location/update` | Real-time GPS push |
| GET | `/api/hotspots/zones` | Crime heatmap GeoJSON |
| GET | `/api/hotspots/route-score` | Score route safety |
| POST | `/api/geofence/create` | Create safe zone |
| GET | `/api/police/nearest` | Find nearest station |
| GET | `/api/cases/list` | User's case history |
| GET | `/api/admin/dashboard` | Police command center |
| GET | `/api/admin/report/{month}` | Monthly PDF report |

### WebSocket Events

```javascript
// Client → Server
socket.emit('join_case', { case_id: 'SS-2026-06-27-123456' })
socket.emit('location_update', { case_id, lat, lng, timestamp })

// Server → Client
socket.on('sos_received', { case_id, user_name, location })
socket.on('location_update', { case_id, lat, lng, battery })
socket.on('officer_eta', { case_id, eta_minutes, officer_lat, officer_lng })
```

---

## 🧠 AI/ML Models

### TFLite Distress Audio Classifier (F11)
- **Architecture:** Lightweight CNN on mel-spectrograms
- **Classes:** NORMAL, SCREAM, CRY, PANIC, HELP_CALL
- **Input:** 2-second audio window → 64×63 mel-spectrogram
- **Inference time:** <200ms on mid-range Android
- **Confidence threshold:** >85% for distress alert
- **Training:** `cd backend/ml && python train.py`

### DBSCAN Crime Hotspot Clustering (F07, F25)
- **Algorithm:** DBSCAN with Haversine metric
- **Parameters:** eps=0.5km, min_samples=3
- **Data:** 500 realistic AP crime incidents
- **Output:** GeoJSON cluster polygons with time-risk matrices
- **Update:** Every 24 hours via Celery scheduled task

---

## 🔐 Security

- **Authentication:** JWT (HS256, 24-hour expiry, no 3rd party)
- **Location Encryption:** AES-256 (client-side key derivation via PBKDF2)
- **Passwords:** bcrypt with salt
- **Audio Evidence:** Encrypted before leaving device
- **Data Retention:** GPS trails purged in 24h, audio in 90 days
- **Biometric Gate:** Face ID/Fingerprint required to cancel SOS

---

## 📊 Database Schema

```sql
users (id, name, phone, email, password_hash, emergency_contacts, safe_zones, settings)
cases (id, case_id, user_id, trigger_type, status, audio_url, gps_trail, fir_pdf_url)
alerts (id, case_id, user_id, contact_phone, alert_type, sent_at, read_at)
hotspots (id, lat, lng, radius, risk_score, crime_types, time_risk_matrix, cluster_id)
police_stations (id, name, lat, lng, phone, sms_number, district, active)
```

---

## 🚀 Deployment

### Railway (Backend)
```bash
railway login
railway new safestep-backend
railway up backend/
```

### Vercel (Web Dashboards)
```bash
# Guardian
cd web-guardian && vercel --prod

# Police
cd web-police && vercel --prod
```

### Expo (Mobile APK)
```bash
cd mobile
eas build --platform android --profile preview
```

---

## 👥 Tech Stack

| Layer | Technology |
|-------|-----------|
| Mobile | React Native + Expo SDK 51 |
| State | AsyncStorage + React hooks |
| Backend | Python 3.11 + Flask 3.0 |
| Database | PostgreSQL 15 |
| Cache/Queue | Redis 7 + Celery |
| Real-time | Flask-SocketIO + Socket.io-client |
| Auth | Flask-JWT-Extended (custom JWT) |
| SMS/Voice | Twilio SDK |
| Email | SendGrid |
| PDF | ReportLab |
| ML (server) | Scikit-learn DBSCAN + Pandas |
| ML (device) | TensorFlow Lite |
| Infrastructure | Docker + Docker Compose + Nginx |

---

## 📋 License

MIT License — Y4 Prakasam Police Hackathon 2026

---

*Built with ❤️ for the safety of women, children, and senior citizens of Andhra Pradesh*
#   S a f e S t e p - A I - G u a r d i a n  
 
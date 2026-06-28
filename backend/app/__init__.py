import os
from dotenv import load_dotenv
load_dotenv(os.path.join(os.path.dirname(os.path.dirname(__file__)), '.env'))

from flask import Flask
from flask_sqlalchemy import SQLAlchemy
from flask_jwt_extended import JWTManager
from flask_socketio import SocketIO
from flask_cors import CORS
from flask_migrate import Migrate

db = SQLAlchemy()
jwt = JWTManager()
socketio = SocketIO()
migrate = Migrate()


def create_app(config_name=None):
    app = Flask(__name__)

    # ── Configuration ──────────────────────────────────────────
    app.config['SECRET_KEY'] = os.environ.get('SECRET_KEY', 'safestep-dev-secret-2026')
    app.config['SQLALCHEMY_DATABASE_URI'] = os.environ.get(
        'DATABASE_URL', 'sqlite:///safestep_dev.db'
    )
    app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
    app.config['JWT_SECRET_KEY'] = os.environ.get('JWT_SECRET_KEY', 'safestep-jwt-dev-2026')
    app.config['JWT_ACCESS_TOKEN_EXPIRES'] = 86400  # 24 hours

    # Upload folder
    app.config['UPLOAD_FOLDER'] = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'uploads')

    # ── Extensions ─────────────────────────────────────────────
    db.init_app(app)
    jwt.init_app(app)

    # Use threading async_mode for local dev (no eventlet install needed)
    async_mode = 'threading'
    socketio.init_app(
        app,
        cors_allowed_origins="*",
        async_mode=async_mode,
        logger=False,
        engineio_logger=False
    )
    migrate.init_app(app, db)
    CORS(app, resources={r"/api/*": {"origins": "*"}})

    # ── Serve uploaded files statically ────────────────────────
    from flask import send_from_directory, jsonify

    @app.route('/uploads/<path:filename>')
    def uploaded_file(filename):
        return send_from_directory(app.config['UPLOAD_FOLDER'], filename)

    # ── Root status page ───────────────────────────────────────
    @app.route('/')
    def index():
        return '''<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <title>SafeStep API — Running</title>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800&display=swap" rel="stylesheet"/>
  <style>
    *{margin:0;padding:0;box-sizing:border-box;font-family:'Inter',sans-serif}
    body{background:#0b0d14;color:#f1f5f9;min-height:100vh;display:flex;align-items:center;justify-content:center;padding:24px}
    .card{background:#111827;border:1px solid rgba(255,255,255,0.07);border-radius:20px;padding:40px;max-width:700px;width:100%}
    .logo{display:flex;align-items:center;gap:14px;margin-bottom:28px}
    .logo-icon{width:52px;height:52px;background:rgba(79,70,229,0.15);border:1px solid rgba(79,70,229,0.3);border-radius:14px;display:flex;align-items:center;justify-content:center;font-size:24px}
    h1{font-size:24px;font-weight:800;background:linear-gradient(135deg,#f1f5f9,#818cf8);-webkit-background-clip:text;-webkit-text-fill-color:transparent}
    .sub{color:#4b5563;font-size:13px;margin-top:2px}
    .status-row{display:flex;align-items:center;gap:8px;margin-bottom:28px;padding:12px 16px;background:rgba(74,222,128,0.08);border:1px solid rgba(74,222,128,0.2);border-radius:10px}
    .dot{width:8px;height:8px;background:#4ade80;border-radius:50%;animation:pulse 1.5s infinite}
    @keyframes pulse{0%,100%{box-shadow:0 0 0 0 rgba(74,222,128,0.7)}50%{box-shadow:0 0 0 8px rgba(74,222,128,0)}}
    .status-text{color:#4ade80;font-size:13px;font-weight:600}
    .section{margin-bottom:24px}
    .section-title{font-size:11px;font-weight:700;color:#4b5563;text-transform:uppercase;letter-spacing:1px;margin-bottom:10px}
    .dashboards{display:grid;grid-template-columns:1fr 1fr;gap:12px}
    .dash-card{background:#1f2937;border:1px solid rgba(255,255,255,0.06);border-radius:12px;padding:16px;text-decoration:none;transition:all 0.2s;display:block}
    .dash-card:hover{border-color:rgba(79,70,229,0.4);background:#1a2235;transform:translateY(-2px)}
    .dash-icon{font-size:24px;margin-bottom:8px}
    .dash-title{font-size:15px;font-weight:700;color:#f1f5f9;margin-bottom:3px}
    .dash-url{font-size:11px;color:#818cf8;font-family:monospace}
    .dash-desc{font-size:12px;color:#6b7280;margin-top:4px}
    .endpoints{display:flex;flex-direction:column;gap:6px}
    .ep{display:flex;align-items:center;gap:10px;padding:8px 12px;background:#1f2937;border-radius:8px;font-size:12px}
    .method{padding:2px 8px;border-radius:4px;font-size:10px;font-weight:700;min-width:42px;text-align:center}
    .get{background:rgba(74,222,128,0.15);color:#4ade80}
    .post{background:rgba(251,191,36,0.15);color:#fbbf24}
    .ep-path{color:#a5b4fc;font-family:monospace}
    .ep-desc{color:#6b7280;margin-left:auto}
    .footer{border-top:1px solid rgba(255,255,255,0.05);padding-top:16px;margin-top:8px;font-size:11px;color:#374151;text-align:center}
  </style>
</head>
<body>
<div class="card">
  <div class="logo">
    <div class="logo-icon">🛡️</div>
    <div>
      <h1>SafeStep API</h1>
      <div class="sub">Y4 Prakasam Police Hackathon 2026 — Backend Server</div>
    </div>
  </div>

  <div class="status-row">
    <div class="dot"></div>
    <span class="status-text">Server is running on port 5000</span>
    <span style="margin-left:auto;color:#4b5563;font-size:12px">Flask + Socket.io</span>
  </div>

  <div class="section">
    <div class="section-title">Web Dashboards</div>
    <div class="dashboards">
      <a class="dash-card" href="http://localhost:3001" target="_blank">
        <div class="dash-icon">👨‍👩‍👧</div>
        <div class="dash-title">Guardian Dashboard</div>
        <div class="dash-url">http://localhost:3001</div>
        <div class="dash-desc">Live GPS tracking for family members</div>
      </a>
      <a class="dash-card" href="http://localhost:3002" target="_blank">
        <div class="dash-icon">🚔</div>
        <div class="dash-title">Police Dashboard</div>
        <div class="dash-url">http://localhost:3002</div>
        <div class="dash-desc">Command center + crime heatmap</div>
      </a>
    </div>
  </div>

  <div class="section">
    <div class="section-title">Key API Endpoints</div>
    <div class="endpoints">
      <div class="ep"><span class="method post">POST</span><span class="ep-path">/api/auth/register</span><span class="ep-desc">Register user</span></div>
      <div class="ep"><span class="method post">POST</span><span class="ep-path">/api/auth/login</span><span class="ep-desc">Login → JWT token</span></div>
      <div class="ep"><span class="method post">POST</span><span class="ep-path">/api/sos/trigger</span><span class="ep-desc">🚨 Fire SOS pipeline</span></div>
      <div class="ep"><span class="method get">GET</span><span class="ep-path">/api/sos/case/&lt;id&gt;</span><span class="ep-desc">Track case status</span></div>
      <div class="ep"><span class="method post">POST</span><span class="ep-path">/api/location/update</span><span class="ep-desc">Push live GPS</span></div>
      <div class="ep"><span class="method get">GET</span><span class="ep-path">/api/hotspots/zones</span><span class="ep-desc">Crime heatmap GeoJSON</span></div>
      <div class="ep"><span class="method get">GET</span><span class="ep-path">/api/admin/dashboard</span><span class="ep-desc">Police command stats</span></div>
      <div class="ep"><span class="method get">GET</span><span class="ep-path">/api/health</span><span class="ep-desc">Health check (JSON)</span></div>
    </div>
  </div>

  <div class="footer">
    SafeStep — AI Guardian for Women, Children &amp; Senior Citizens of Andhra Pradesh
  </div>
</div>
</body>
</html>''', 200, {'Content-Type': 'text/html'}

    @app.route('/api/health')
    def health():
        return jsonify({
            'status': 'ok',
            'service': 'SafeStep API',
            'version': '1.0.0',
            'hackathon': 'Y4 Prakasam Police Hackathon 2026',
            'dashboards': {
                'guardian': 'http://localhost:3001',
                'police': 'http://localhost:3002',
            },
        }), 200


    # ── Blueprints ─────────────────────────────────────────────
    from app.routes.auth import auth_bp
    from app.routes.sos import sos_bp
    from app.routes.location import location_bp
    from app.routes.hotspots import hotspots_bp
    from app.routes.police import police_bp
    from app.routes.cases import cases_bp
    from app.routes.admin import admin_bp
    from app.routes.geofence import geofence_bp

    app.register_blueprint(auth_bp, url_prefix='/api/auth')
    app.register_blueprint(sos_bp, url_prefix='/api/sos')
    app.register_blueprint(location_bp, url_prefix='/api/location')
    app.register_blueprint(hotspots_bp, url_prefix='/api/hotspots')
    app.register_blueprint(police_bp, url_prefix='/api/police')
    app.register_blueprint(cases_bp, url_prefix='/api/cases')
    app.register_blueprint(admin_bp, url_prefix='/api/admin')
    app.register_blueprint(geofence_bp, url_prefix='/api/geofence')

    # ── Socket.IO events ───────────────────────────────────────
    from app.socket_events import register_socket_events
    register_socket_events(socketio)

    return app

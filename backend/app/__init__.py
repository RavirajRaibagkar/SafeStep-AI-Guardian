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
    from flask import send_from_directory

    @app.route('/uploads/<path:filename>')
    def uploaded_file(filename):
        return send_from_directory(app.config['UPLOAD_FOLDER'], filename)

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

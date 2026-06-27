import os
from flask import Flask
from flask_sqlalchemy import SQLAlchemy
from flask_jwt_extended import JWTManager
from flask_socketio import SocketIO
from flask_cors import CORS
from flask_migrate import Migrate
from celery import Celery

db = SQLAlchemy()
jwt = JWTManager()
socketio = SocketIO()
migrate = Migrate()
celery = Celery()


def create_app(config_name=None):
    app = Flask(__name__)

    # Configuration
    app.config['SECRET_KEY'] = os.environ.get('SECRET_KEY', 'safestep-super-secret-key-2026')
    app.config['SQLALCHEMY_DATABASE_URI'] = os.environ.get(
        'DATABASE_URL',
        'postgresql://safestep:safestep123@localhost:5432/safestep_db'
    )
    app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
    app.config['JWT_SECRET_KEY'] = os.environ.get('JWT_SECRET_KEY', 'safestep-jwt-secret-2026')
    app.config['JWT_ACCESS_TOKEN_EXPIRES'] = 86400  # 24 hours

    # Celery config
    app.config['CELERY_BROKER_URL'] = os.environ.get('REDIS_URL', 'redis://localhost:6379/0')
    app.config['CELERY_RESULT_BACKEND'] = os.environ.get('REDIS_URL', 'redis://localhost:6379/0')

    # Initialize extensions
    db.init_app(app)
    jwt.init_app(app)
    socketio.init_app(app, cors_allowed_origins="*", async_mode='eventlet', logger=False, engineio_logger=False)
    migrate.init_app(app, db)
    CORS(app, resources={r"/api/*": {"origins": "*"}})

    # Initialize Celery
    celery.conf.update(
        broker_url=app.config['CELERY_BROKER_URL'],
        result_backend=app.config['CELERY_RESULT_BACKEND'],
        task_serializer='json',
        accept_content=['json'],
        result_serializer='json',
        timezone='Asia/Kolkata',
        enable_utc=True,
        beat_schedule={
            'update-hotspots-daily': {
                'task': 'app.tasks.hotspot_updater.update_hotspots',
                'schedule': 86400.0,  # every 24 hours
            },
            'cleanup-data-daily': {
                'task': 'app.tasks.data_cleanup.cleanup_old_data',
                'schedule': 86400.0,
            },
            'monthly-report': {
                'task': 'app.tasks.report_generator.generate_monthly_report',
                'schedule': 2592000.0,  # ~30 days
            },
        }
    )

    # Register blueprints
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

    # Register Socket.IO events
    from app.socket_events import register_socket_events
    register_socket_events(socketio)

    return app

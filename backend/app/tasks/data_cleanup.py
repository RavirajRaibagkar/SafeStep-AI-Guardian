import os
import logging
from datetime import datetime, timedelta
from app import db
from app.models.case import Case
from app.models.alert import Alert

logger = logging.getLogger(__name__)


def cleanup_old_data():
    """F29: Daily data purge — location history 24h, audio 90 days."""
    try:
        now = datetime.utcnow()
        results = {}

        # Clear GPS trails older than 24 hours from resolved cases
        threshold_24h = now - timedelta(hours=24)
        old_cases = Case.query.filter(
            Case.status.in_(['resolved', 'false_alarm']),
            Case.updated_at < threshold_24h,
        ).all()

        gps_cleared = 0
        for case in old_cases:
            if case.gps_trail:
                case.gps_trail = []
                gps_cleared += 1

        results['gps_trails_cleared'] = gps_cleared

        # Delete audio files older than 90 days (unless case is open)
        threshold_90d = now - timedelta(days=90)
        old_audio_cases = Case.query.filter(
            Case.status.in_(['resolved', 'false_alarm']),
            Case.created_at < threshold_90d,
        ).all()

        audio_deleted = 0
        audio_dir = os.path.join('uploads', 'audio')
        for case in old_audio_cases:
            case_audio_dir = os.path.join(audio_dir, case.case_id)
            if os.path.exists(case_audio_dir):
                import shutil
                shutil.rmtree(case_audio_dir)
                audio_deleted += 1
            case.audio_url = None

        results['audio_dirs_deleted'] = audio_deleted

        db.session.commit()

        # Delete alert records older than 90 days
        deleted_alerts = Alert.query.filter(
            Alert.created_at < threshold_90d
        ).delete()
        db.session.commit()
        results['alerts_deleted'] = deleted_alerts

        logger.info(f"Data cleanup complete: {results}")
        return {'status': 'success', **results}
    except Exception as e:
        logger.error(f"Data cleanup failed: {e}")
        db.session.rollback()
        return {'status': 'error', 'message': str(e)}

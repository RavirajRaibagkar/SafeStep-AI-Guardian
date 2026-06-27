import logging
from app import db
from app.models.alert import Hotspot
from app.ml.hotspot_model import HotspotModel

logger = logging.getLogger(__name__)


def update_hotspots():
    """F07: Celery task to update crime hotspot clusters every 24 hours."""
    try:
        import os
        model = HotspotModel(eps_km=0.5, min_samples=3)
        data_path = os.path.join('ml', 'data', 'sample_crimes.csv')

        if not os.path.exists(data_path):
            logger.warning(f"Crime data not found at {data_path}, skipping hotspot update")
            return {'status': 'skipped', 'reason': 'data file not found'}

        df = model.load_csv_data(data_path)
        if df.empty:
            return {'status': 'skipped', 'reason': 'empty dataset'}

        clusters = model.run_clustering(df)
        saved = model.save_clusters_to_db(clusters)

        logger.info(f"Hotspot update complete: {saved} clusters saved")
        return {'status': 'success', 'clusters_saved': saved}
    except Exception as e:
        logger.error(f"Hotspot update failed: {e}")
        return {'status': 'error', 'message': str(e)}

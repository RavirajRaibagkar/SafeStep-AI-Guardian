import numpy as np
import pandas as pd
import logging
from sklearn.cluster import DBSCAN
from sklearn.preprocessing import StandardScaler
from datetime import datetime
import math

logger = logging.getLogger(__name__)


class HotspotModel:
    """
    F07 + F25: DBSCAN-based crime hotspot clustering.
    Clusters incident GPS coordinates to identify danger zones.
    """

    def __init__(self, eps_km=0.5, min_samples=3):
        self.eps_km = eps_km  # 500m radius
        self.min_samples = min_samples
        self.scaler = StandardScaler()

    def load_csv_data(self, filepath: str) -> pd.DataFrame:
        """Load crime data CSV."""
        try:
            df = pd.read_csv(filepath)
            required_cols = ['lat', 'lng']
            if not all(c in df.columns for c in required_cols):
                raise ValueError(f"CSV must contain columns: {required_cols}")
            df['lat'] = pd.to_numeric(df['lat'], errors='coerce')
            df['lng'] = pd.to_numeric(df['lng'], errors='coerce')
            df.dropna(subset=['lat', 'lng'], inplace=True)
            logger.info(f"Loaded {len(df)} crime records from {filepath}")
            return df
        except Exception as e:
            logger.error(f"Error loading crime data: {e}")
            return pd.DataFrame(columns=['lat', 'lng'])

    def run_clustering(self, df: pd.DataFrame) -> list:
        """
        Run DBSCAN on GPS coordinates.
        Returns list of cluster dicts with center, radius, risk_score.
        """
        if df.empty or len(df) < self.min_samples:
            logger.warning("Insufficient data for clustering")
            return []

        # Convert to radians for Haversine metric
        coords_rad = np.radians(df[['lat', 'lng']].values)
        eps_rad = self.eps_km / 6371.0  # convert km to radians

        db = DBSCAN(
            eps=eps_rad,
            min_samples=self.min_samples,
            algorithm='ball_tree',
            metric='haversine'
        )
        labels = db.fit_predict(coords_rad)

        df = df.copy()
        df['cluster'] = labels

        clusters = []
        unique_labels = set(labels) - {-1}  # exclude noise

        for cluster_id in unique_labels:
            cluster_df = df[df['cluster'] == cluster_id]
            center_lat = cluster_df['lat'].mean()
            center_lng = cluster_df['lng'].mean()
            count = len(cluster_df)

            # Calculate cluster radius (max distance from center)
            distances = cluster_df.apply(
                lambda row: self._haversine_km(center_lat, center_lng, row['lat'], row['lng']),
                axis=1
            )
            radius_m = float(distances.max() * 1000) + 100  # add buffer

            # Risk score: normalized by incident count
            base_score = min(1.0, count / 50.0)

            # Time-based risk matrix (24 hours)
            time_matrix = self._build_time_matrix(cluster_df)

            # Crime types summary
            crime_types = []
            if 'crime_type' in cluster_df.columns:
                crime_types = cluster_df['crime_type'].value_counts().head(3).index.tolist()

            # Recent incident weight
            recent_weight = 1.0
            if 'date' in cluster_df.columns:
                try:
                    cluster_df['date_parsed'] = pd.to_datetime(cluster_df['date'], errors='coerce')
                    last_30_days = cluster_df[
                        cluster_df['date_parsed'] >= (pd.Timestamp.now() - pd.Timedelta(days=30))
                    ]
                    recent_weight = 1.0 + (len(last_30_days) / max(count, 1)) * 0.5
                except Exception:
                    pass

            district = cluster_df['district'].mode().iloc[0] if 'district' in cluster_df.columns and not cluster_df['district'].isna().all() else 'Unknown'

            clusters.append({
                'cluster_id': int(cluster_id),
                'center_lat': round(float(center_lat), 6),
                'center_lng': round(float(center_lng), 6),
                'radius_m': round(radius_m, 1),
                'incident_count': count,
                'risk_score': round(float(base_score * recent_weight), 3),
                'time_risk_matrix': time_matrix,
                'crime_types': crime_types,
                'district': str(district),
            })

        clusters.sort(key=lambda x: x['risk_score'], reverse=True)
        logger.info(f"Found {len(clusters)} clusters from {len(df)} incidents")
        return clusters

    def _build_time_matrix(self, cluster_df: pd.DataFrame) -> list:
        """Build 24-hour risk multiplier matrix for a cluster."""
        matrix = [0.3] * 24  # baseline

        if 'hour' in cluster_df.columns:
            hour_counts = cluster_df['hour'].value_counts()
            max_count = hour_counts.max() if not hour_counts.empty else 1
            for hour, count in hour_counts.items():
                if 0 <= int(hour) < 24:
                    matrix[int(hour)] = round(float(count) / float(max_count), 3)
        else:
            # Default: higher risk at night (6PM-6AM)
            for h in range(18, 24):
                matrix[h] = 0.9
            for h in range(0, 6):
                matrix[h] = 0.95
            for h in range(6, 8):
                matrix[h] = 0.6

        return matrix

    def _haversine_km(self, lat1, lon1, lat2, lon2) -> float:
        R = 6371
        phi1, phi2 = math.radians(lat1), math.radians(lat2)
        dphi = math.radians(lat2 - lat1)
        dlambda = math.radians(lon2 - lon1)
        a = math.sin(dphi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(dlambda / 2) ** 2
        return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))

    def save_clusters_to_db(self, clusters: list):
        """Persist clusters to database (replaces old ones)."""
        from app import db
        from app.models.alert import Hotspot

        # Clear old auto-generated hotspots
        Hotspot.query.filter(Hotspot.cluster_id != None).delete()

        for c in clusters:
            hotspot = Hotspot(
                lat=c['center_lat'],
                lng=c['center_lng'],
                radius=c['radius_m'],
                risk_score=c['risk_score'],
                crime_types=c['crime_types'],
                time_risk_matrix=c['time_risk_matrix'],
                cluster_id=c['cluster_id'],
                incident_count=c['incident_count'],
                district=c['district'],
                updated_at=datetime.utcnow(),
            )
            db.session.add(hotspot)

        db.session.commit()
        logger.info(f"Saved {len(clusters)} clusters to database")
        return len(clusters)

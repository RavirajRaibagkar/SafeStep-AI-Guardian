import os
import logging
import requests

logger = logging.getLogger(__name__)

GOOGLE_MAPS_API_KEY = os.environ.get('GOOGLE_MAPS_API_KEY', '')


def get_reverse_geocode(lat: float, lng: float) -> str:
    """Convert GPS coordinates to human-readable address."""
    if not GOOGLE_MAPS_API_KEY or not lat or not lng:
        return f"GPS: {lat:.6f}, {lng:.6f}"

    try:
        url = f"https://maps.googleapis.com/maps/api/geocode/json"
        params = {'latlng': f"{lat},{lng}", 'key': GOOGLE_MAPS_API_KEY}
        resp = requests.get(url, params=params, timeout=5)
        data = resp.json()

        if data.get('status') == 'OK' and data.get('results'):
            return data['results'][0].get('formatted_address', f"{lat},{lng}")
    except Exception as e:
        logger.warning(f"Reverse geocode failed: {e}")

    return f"Lat: {lat:.6f}, Lng: {lng:.6f}"


def get_directions(origin_lat, origin_lng, dest_lat, dest_lng, alternatives=True):
    """Get route alternatives from Google Directions API."""
    if not GOOGLE_MAPS_API_KEY:
        # Return mock routes for demo
        return _mock_routes(origin_lat, origin_lng, dest_lat, dest_lng)

    try:
        url = "https://maps.googleapis.com/maps/api/directions/json"
        params = {
            'origin': f"{origin_lat},{origin_lng}",
            'destination': f"{dest_lat},{dest_lng}",
            'alternatives': 'true' if alternatives else 'false',
            'key': GOOGLE_MAPS_API_KEY,
        }
        resp = requests.get(url, params=params, timeout=10)
        data = resp.json()

        if data.get('status') == 'OK':
            routes = []
            for route in data.get('routes', []):
                waypoints = []
                for leg in route.get('legs', []):
                    for step in leg.get('steps', []):
                        loc = step.get('start_location', {})
                        waypoints.append({'lat': loc.get('lat'), 'lng': loc.get('lng')})
                routes.append({
                    'summary': route.get('summary', ''),
                    'distance': route['legs'][0]['distance']['text'],
                    'duration': route['legs'][0]['duration']['text'],
                    'waypoints': waypoints,
                    'polyline': route.get('overview_polyline', {}).get('points', ''),
                })
            return routes
        return _mock_routes(origin_lat, origin_lng, dest_lat, dest_lng)
    except Exception as e:
        logger.error(f"Directions API error: {e}")
        return _mock_routes(origin_lat, origin_lng, dest_lat, dest_lng)


def _mock_routes(o_lat, o_lng, d_lat, d_lng):
    """Generate mock routes for demo without API key."""
    def midpoint(f, t, ratio):
        return o_lat + (d_lat - o_lat) * ratio, o_lng + (d_lng - o_lng) * ratio

    return [
        {
            'summary': 'Main Road',
            'distance': '5.2 km',
            'duration': '12 mins',
            'waypoints': [
                {'lat': o_lat, 'lng': o_lng},
                {'lat': o_lat + (d_lat - o_lat) * 0.5, 'lng': o_lng + (d_lng - o_lng) * 0.5 + 0.005},
                {'lat': d_lat, 'lng': d_lng},
            ],
            'polyline': '',
        },
        {
            'summary': 'Via Market',
            'distance': '6.1 km',
            'duration': '15 mins',
            'waypoints': [
                {'lat': o_lat, 'lng': o_lng},
                {'lat': o_lat + (d_lat - o_lat) * 0.3, 'lng': o_lng - 0.008},
                {'lat': o_lat + (d_lat - o_lat) * 0.7, 'lng': o_lng + (d_lng - o_lng) * 0.7},
                {'lat': d_lat, 'lng': d_lng},
            ],
            'polyline': '',
        },
        {
            'summary': 'Ring Road',
            'distance': '7.5 km',
            'duration': '18 mins',
            'waypoints': [
                {'lat': o_lat, 'lng': o_lng},
                {'lat': o_lat - 0.01, 'lng': o_lng + 0.01},
                {'lat': d_lat + 0.005, 'lng': d_lng - 0.005},
                {'lat': d_lat, 'lng': d_lng},
            ],
            'polyline': '',
        },
    ]

from math import asin, cos, radians, sin, sqrt

EARTH_RADIUS_M = 6_371_000


def haversine_m(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Great-circle distance in meters."""
    rlat1, rlon1, rlat2, rlon2 = map(radians, [lat1, lon1, lat2, lon2])
    dlat = rlat2 - rlat1
    dlon = rlon2 - rlon1
    a = sin(dlat / 2) ** 2 + cos(rlat1) * cos(rlat2) * sin(dlon / 2) ** 2
    c = 2 * asin(sqrt(min(1.0, a)))
    return EARTH_RADIUS_M * c


def within_radius(
    lat: float, lng: float, center_lat: float, center_lng: float, radius_m: float
) -> tuple[bool, float]:
    d = haversine_m(lat, lng, center_lat, center_lng)
    return d <= radius_m, d

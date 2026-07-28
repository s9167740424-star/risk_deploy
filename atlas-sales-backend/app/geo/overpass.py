from __future__ import annotations
import math
import requests
OVERPASS_URLS = [
    "https://overpass-api.de/api/interpreter",
    "https://maps.mail.ru/osm/tools/overpass/api/interpreter",
    "https://overpass.kumi.systems/api/interpreter",
]
REQUEST_TIMEOUT = 60
QUERY_TIMEOUT = 50
DEFAULT_RADIUS = 3000

def distance_m(lat1: float, lon1: float, lat2: float, lon2: float) -> int:
    r = 6371000
    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    d_phi = math.radians(lat2 - lat1)
    d_lambda = math.radians(lon2 - lon1)
    a = (
        math.sin(d_phi / 2) ** 2
        + math.cos(phi1) * math.cos(phi2) * math.sin(d_lambda / 2) ** 2
    )
    return int(r * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a)))

def _min_distance_to_geometry(lat: float, lon: float, element: dict):
    geometry = element.get("geometry")
    if geometry:
        return min(
            distance_m(lat, lon, point["lat"], point["lon"])
            for point in geometry
        )
    if "center" in element:
        return distance_m(
            lat, lon, element["center"]["lat"], element["center"]["lon"]
        )
    if "lat" in element and "lon" in element:
        return distance_m(lat, lon, element["lat"], element["lon"])
    return None

def _coords_of(element: dict):
    if "lat" in element and "lon" in element:
        return element["lat"], element["lon"]
    if "center" in element:
        return element["center"]["lat"], element["center"]["lon"]
    geometry = element.get("geometry")
    if geometry:
        return geometry[0]["lat"], geometry[0]["lon"]
    return None, None

def _run_query(query: str, request_timeout: int | None = None) -> dict:
    last_error = None
    timeout = request_timeout if request_timeout is not None else REQUEST_TIMEOUT
    for url in OVERPASS_URLS:
        try:
            response = requests.post(
                url,
                data=query,
                headers={
                    "Content-Type": "text/plain",
                    "User-Agent": "AtlasSales/1.0",
                },
                timeout=timeout,
            )
            if response.status_code in (429, 503, 504):
                last_error = f"{response.status_code} от {url}"
                continue
            response.raise_for_status()
            return response.json()
        except requests.exceptions.RequestException as e:
            last_error = str(e)
    raise RuntimeError(
        "Серверы OpenStreetMap перегружены, попробуйте ещё раз через "
        f"минуту. Последняя ошибка: {last_error}"
    )

def _query_points(lat: float, lon: float, radius: int) -> str:
    return f"""
[out:json][timeout:{QUERY_TIMEOUT}];
(
  nwr["amenity"="school"](around:{radius},{lat},{lon});
  nwr["amenity"="kindergarten"](around:{radius},{lat},{lon});
  nwr["station"="subway"](around:{radius},{lat},{lon});
  nwr["leisure"="park"](around:{radius},{lat},{lon});
);
out center;
"""

def _query_lines(lat: float, lon: float, radius: int) -> str:
    return f"""
[out:json][timeout:{QUERY_TIMEOUT}];
(
  way["highway"~"^(motorway|trunk|primary)$"](around:{radius},{lat},{lon});
  way["highway"="secondary"]["lanes"~"^([3-9]|[1-9][0-9])$"](around:{radius},{lat},{lon});
  way["railway"~"^(rail|light_rail)$"]["service"!~"."](around:{radius},{lat},{lon});
);
out geom;
"""

def _query_zones(lat: float, lon: float, radius: int) -> str:
    return f"""
[out:json][timeout:{QUERY_TIMEOUT}];
(
  nwr["landuse"="industrial"](around:{radius},{lat},{lon});
  nwr["landuse"="cemetery"](around:{radius},{lat},{lon});
  nwr["amenity"="grave_yard"](around:{radius},{lat},{lon});
);
out center;
"""

def _lanes_word(lanes) -> str:
    try:
        n = int(lanes)
    except (TypeError, ValueError):
        return "полос"
    if 11 <= n % 100 <= 14:
        return "полос"
    last = n % 10
    if last == 1:
        return "полоса"
    if last in (2, 3, 4):
        return "полосы"
    return "полос"

def _road_label(tags: dict) -> str:
    name = tags.get("name") or tags.get("ref") or "Без названия"
    lanes = tags.get("lanes")
    if lanes:
        return f"{name} ({lanes} {_lanes_word(lanes)})"
    labels = {
        "motorway": "автомагистраль",
        "trunk": "магистраль",
        "primary": "главная дорога",
    }
    highway = tags.get("highway", "")
    if highway in labels:
        return f"{name} ({labels[highway]})"
    return name

def _classify(tags: dict):
    if tags.get("station") == "subway":
        return "metro"
    amenity = tags.get("amenity")
    if amenity == "school":
        return "school"
    if amenity == "kindergarten":
        return "kindergarten"
    if amenity == "grave_yard":
        return "cemetery"
    if tags.get("leisure") == "park":
        return "park"
    landuse = tags.get("landuse")
    if landuse == "cemetery":
        return "cemetery"
    if landuse == "industrial":
        return "industrial_zone"
    railway = tags.get("railway")
    if railway in ("rail", "light_rail"):
        return "railway"
    if tags.get("highway"):
        return "big_road"
    return None
KIND_META = {
    "metro": ("positive", "Метро"),
    "school": ("positive", "Школа"),
    "kindergarten": ("positive", "Детский сад"),
    "park": ("positive", "Парк"),
    "big_road": ("risk", "Крупная дорога"),
    "railway": ("risk", "Железная дорога"),
    "industrial_zone": ("risk", "Промышленная зона"),
    "cemetery": ("risk", "Кладбище"),
}
LINEAR_KINDS = {"big_road", "railway"}

def _collect(data: dict, lat: float, lon: float, found: dict) -> None:
    for element in data.get("elements", []):
        tags = element.get("tags", {})
        kind = _classify(tags)
        if kind is None:
            continue
        obj_lat, obj_lon = _coords_of(element)
        if obj_lat is None:
            continue
        dist = _min_distance_to_geometry(lat, lon, element)
        if dist is None:
            continue
        if kind == "big_road":
            name = _road_label(tags)
        else:
            name = tags.get("name") or KIND_META[kind][1]
        bucket = found.setdefault(kind, {})
        if kind in LINEAR_KINDS:
            key = name
        else:
            key = (name, round(obj_lat, 4), round(obj_lon, 4))
        existing = bucket.get(key)
        if existing is None or dist < existing["distance_m"]:
            bucket[key] = {
                "kind": kind,
                "name": name,
                "category": KIND_META[kind][0],
                "distance_m": dist,
                "latitude": obj_lat,
                "longitude": obj_lon,
            }

def search_surroundings(lat: float, lon: float, radius: int = DEFAULT_RADIUS) -> dict:
    found: dict = {}
    failed: list[str] = []
    plans = [
        (_query_points, ["metro", "school", "kindergarten", "park"]),
        (_query_lines, ["big_road", "railway"]),
        (_query_zones, ["industrial_zone", "cemetery"]),
    ]
    for build_query, kinds in plans:
        try:
            data = _run_query(build_query(lat, lon, radius))
            _collect(data, lat, lon, found)
        except RuntimeError:
            failed.extend(kinds)
    items = []
    for bucket in found.values():
        items.extend(bucket.values())
    items.sort(key=lambda x: x["distance_m"])
    return {"items": items, "failed": failed, "radius_m": radius}

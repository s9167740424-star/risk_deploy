from __future__ import annotations

import requests

from app.geo.geocoder import GeocoderNotConfigured, search_near
from app.geo.overpass import QUERY_TIMEOUT, _coords_of, _run_query, distance_m

DEFAULT_PLACES_RADIUS = 10000
DEFAULT_LIMIT = 12
OFFICES_OVERPASS_TIMEOUT = 18


def _query_offices(lat: float, lon: float, radius: int) -> str:
    timeout = min(QUERY_TIMEOUT, OFFICES_OVERPASS_TIMEOUT)
    return f"""
[out:json][timeout:{timeout}];
(
  nwr["name"~"МФЦ|Мои документы|многофункциональн",i](around:{radius},{lat},{lon});
  nwr["operator"~"МФЦ|Мои документы",i](around:{radius},{lat},{lon});
  nwr["name"~"Росреестр|кадастров|БТИ",i](around:{radius},{lat},{lon});
  nwr["operator"~"Росреестр|кадастров",i](around:{radius},{lat},{lon});
);
out center;
"""


MFC_MARKERS = (
    "мфц",
    "мои документы",
    "многофункциональный центр",
    "мои док",
)

ROSREESTR_MARKERS = (
    "росреестр",
    "кадастров",
    "регистрации, кадастра",
    "бти",
)

CATEGORY_META = {
    "mfc": {
        "title": "МФЦ",
        "subtitle": "Центры «Мои документы» рядом с объектом",
        "queries": ("МФЦ", "Мои документы"),
    },
    "rosreestr_office": {
        "title": "Росреестр / кадастровая палата",
        "subtitle": "Офисы для подачи и получения документов",
        "queries": ("Росреестр", "Кадастровая палата"),
    },
}


def _classify_office(name: str, extra: str = "") -> str | None:
    haystack = f"{name} {extra}".lower()
    if any(marker in haystack for marker in ROSREESTR_MARKERS):
        return "rosreestr_office"
    if any(marker in haystack for marker in MFC_MARKERS):
        return "mfc"
    return None


def _build_address(tags: dict) -> str:
    street = tags.get("addr:street", "").strip()
    house = tags.get("addr:housenumber", "").strip()
    city = tags.get("addr:city", "").strip()
    parts = []
    if street:
        parts.append(f"{street}, {house}" if house else street)
    if city and street:
        parts.insert(0, city)
    elif city:
        parts.append(city)
    return ", ".join(parts)


def _working_hours(tags: dict) -> str:
    return (tags.get("opening_hours") or "").strip()


def _empty_buckets() -> dict[str, list[dict]]:
    return {"mfc": [], "rosreestr_office": []}


def _add_place(
    buckets: dict[str, list[dict]],
    *,
    category: str,
    name: str,
    address: str,
    working_hours: str,
    origin_lat: float,
    origin_lon: float,
    obj_lat: float,
    obj_lon: float,
    seen: set[tuple],
) -> None:
    key = (name, round(obj_lat, 4), round(obj_lon, 4))
    if key in seen:
        return
    seen.add(key)
    buckets[category].append(
        {
            "name": name,
            "address": address,
            "working_hours": working_hours,
            "distance_m": distance_m(origin_lat, origin_lon, obj_lat, obj_lon),
            "latitude": obj_lat,
            "longitude": obj_lon,
        }
    )


def _search_yandex(lat: float, lon: float, radius: int, limit: int) -> dict[str, list[dict]]:
    buckets = _empty_buckets()
    seen: set[tuple] = set()

    for category, meta in CATEGORY_META.items():
        for query in meta["queries"]:
            try:
                hits = search_near(query, lat, lon, radius_m=radius, results=limit)
            except (GeocoderNotConfigured, requests.RequestException, ValueError):
                continue

            for hit in hits:
                name = (hit.get("name") or "").strip()
                address = (hit.get("address") or "").strip()
                classified = _classify_office(name, address)
                if classified != category:
                    continue
                obj_lat = hit.get("latitude")
                obj_lon = hit.get("longitude")
                if obj_lat is None or obj_lon is None:
                    continue
                if distance_m(lat, lon, obj_lat, obj_lon) > radius:
                    continue
                _add_place(
                    buckets,
                    category=category,
                    name=name,
                    address=address,
                    working_hours="",
                    origin_lat=lat,
                    origin_lon=lon,
                    obj_lat=obj_lat,
                    obj_lon=obj_lon,
                    seen=seen,
                )

    return buckets


def _search_overpass(lat: float, lon: float, radius: int) -> tuple[dict[str, list[dict]], bool]:
    buckets = _empty_buckets()
    failed = False
    seen: set[tuple] = set()

    try:
        data = _run_query(
            _query_offices(lat, lon, radius),
            request_timeout=OFFICES_OVERPASS_TIMEOUT + 5,
        )
    except RuntimeError:
        return buckets, True

    for element in data.get("elements", []):
        tags = element.get("tags", {})
        if not isinstance(tags, dict):
            continue
        name = (tags.get("name") or "").strip()
        if not name:
            continue
        category = _classify_office(name, tags.get("operator") or "")
        if category is None:
            continue

        obj_lat, obj_lon = _coords_of(element)
        if obj_lat is None:
            continue

        _add_place(
            buckets,
            category=category,
            name=name,
            address=_build_address(tags),
            working_hours=_working_hours(tags),
            origin_lat=lat,
            origin_lon=lon,
            obj_lat=obj_lat,
            obj_lon=obj_lon,
            seen=seen,
        )

    return buckets, failed


def _has_any(buckets: dict[str, list[dict]]) -> bool:
    return any(buckets[key] for key in buckets)


def search_offices(
    lat: float,
    lon: float,
    radius: int = DEFAULT_PLACES_RADIUS,
    limit: int = DEFAULT_LIMIT,
) -> dict:
    failed = False
    buckets = _search_yandex(lat, lon, radius, limit)

    missing = [key for key, items in buckets.items() if not items]
    if missing:
        osm_buckets, osm_failed = _search_overpass(lat, lon, radius)
        failed = osm_failed and not _has_any(buckets)
        for key in missing:
            buckets[key] = osm_buckets.get(key, [])

    for items in buckets.values():
        items.sort(key=lambda x: x["distance_m"])

    categories = [
        {
            "id": category_id,
            "title": meta["title"],
            "subtitle": meta["subtitle"],
            "places": buckets[category_id][:limit],
        }
        for category_id, meta in CATEGORY_META.items()
    ]

    return {"categories": categories, "failed": failed, "radius_m": radius}

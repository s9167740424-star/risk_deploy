from __future__ import annotations

import os

import requests

GEOCODER_URL = "https://geocode-maps.yandex.ru/1.x/"

REQUEST_TIMEOUT = 15

class GeocoderNotConfigured(RuntimeError):
    pass

def geocode(address: str) -> dict | None:

    address = (address or "").strip()

    if not address:

        return None

    api_key = os.getenv("YANDEX_GEOCODER_KEY", "").strip()

    if not api_key:

        raise GeocoderNotConfigured(

            "Не задан YANDEX_GEOCODER_KEY. Получите ключ Geocoder API "

            "в кабинете разработчика Яндекса и добавьте его в .env"

        )

    response = requests.get(

        GEOCODER_URL,

        params={

            "apikey": api_key,

            "geocode": address,

            "format": "json",

            "results": 1,

            "lang": "ru_RU",

        },

        timeout=REQUEST_TIMEOUT,

    )

    response.raise_for_status()

    data = response.json()

    try:

        members = data["response"]["GeoObjectCollection"]["featureMember"]

    except (KeyError, TypeError):

        return None

    if not members:

        return None

    geo_object = members[0]["GeoObject"]

    lon_str, lat_str = geo_object["Point"]["pos"].split()

    meta = geo_object.get("metaDataProperty", {}).get("GeocoderMetaData", {})

    full_address = meta.get("text") or geo_object.get("name") or address

    return {

        "lat": float(lat_str),

        "lon": float(lon_str),

        "address": full_address,

    }


def search_near(
    text: str,
    lat: float,
    lon: float,
    *,
    radius_m: int = 10000,
    results: int = 10,
) -> list[dict]:
    """Поиск объектов Яндекс.Геокодером около точки (быстрый источник для МФЦ/Росреестра)."""
    query = (text or "").strip()
    if not query:
        return []

    api_key = os.getenv("YANDEX_GEOCODER_KEY", "").strip()
    if not api_key:
        raise GeocoderNotConfigured(
            "Не задан YANDEX_GEOCODER_KEY. Получите ключ Geocoder API "
            "в кабинете разработчика Яндекса и добавьте его в .env"
        )

    # ~1° широты ≈ 111 км; spn ограничивает область поиска
    span = max(radius_m, 500) / 111_000
    response = requests.get(
        GEOCODER_URL,
        params={
            "apikey": api_key,
            "geocode": query,
            "ll": f"{lon},{lat}",
            "spn": f"{span},{span}",
            "rspn": 1,
            "results": max(1, min(results, 25)),
            "format": "json",
            "lang": "ru_RU",
        },
        timeout=REQUEST_TIMEOUT,
    )
    response.raise_for_status()
    data = response.json()

    try:
        members = data["response"]["GeoObjectCollection"]["featureMember"]
    except (KeyError, TypeError):
        return []

    items: list[dict] = []
    for member in members:
        geo_object = member.get("GeoObject") or {}
        try:
            lon_str, lat_str = geo_object["Point"]["pos"].split()
            obj_lat = float(lat_str)
            obj_lon = float(lon_str)
        except (KeyError, TypeError, ValueError):
            continue

        meta = geo_object.get("metaDataProperty", {}).get("GeocoderMetaData", {})
        name = (geo_object.get("name") or "").strip()
        address = (meta.get("text") or geo_object.get("description") or "").strip()
        if not name:
            continue

        items.append(
            {
                "name": name,
                "address": address,
                "latitude": obj_lat,
                "longitude": obj_lon,
            }
        )

    return items

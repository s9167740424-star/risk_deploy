from __future__ import annotations
from app.geo.overpass import search_surroundings
from app.risks.services import (
    RECOMMENDATIONS,
    RISK_TITLES,
    POSITIVE_TITLES,
    severity,
)
KIND_TO_RISK_RULE = {
    "big_road": "highway",
    "railway": "railway",
    "industrial_zone": "industrial_zone",
    "cemetery": None,
}
POSITIVE_IMPACT = {
    "metro": "Транспортная доступность — один из главных факторов цены.",
    "school": "Школа в пешей доступности расширяет круг покупателей с детьми.",
    "kindergarten": "Детский сад рядом ценится семьями с малышами.",
    "park": "Зелёная зона рядом улучшает экологию и вид из окна.",
}
POSITIVE_TIP = {
    "metro": "Укажите время пешком до метро в объявлении — это заметно повышает отклик.",
    "school": "Уточните рейтинг школы и приём по прописке — покупатели спрашивают.",
    "kindergarten": "Проверьте наличие мест и очередь — это частый вопрос на показах.",
    "park": "Сделайте фото парка в кадре: зелень хорошо работает в объявлении.",
}
CEMETERY_IMPACT = "Соседство с кладбищем для части покупателей — стоп-фактор."
CEMETERY_TIP = "Оценивайте влияние трезво: если объект не виден из окон, укажите это."

def _format_distance(meters: int) -> str:
    if meters < 1000:
        return f"{meters} м"
    return f"{meters / 1000:.1f} км".replace(".", ",")

def _build_item(raw: dict) -> dict:
    kind = raw["kind"]
    dist = raw["distance_m"]
    is_plus = raw["category"] == "positive"
    if is_plus:
        impact = POSITIVE_IMPACT.get(
            kind, "Положительный фактор окружения, повышающий привлекательность объекта."
        )
        tip = POSITIVE_TIP.get(kind, "Отметьте этот плюс в объявлении и на показах.")
        title = POSITIVE_TITLES.get(kind, raw["name"])
        level = None
    else:
        rule_kind = KIND_TO_RISK_RULE.get(kind)
        level = severity(rule_kind, dist) if rule_kind else None
        if kind == "cemetery":
            impact = CEMETERY_IMPACT
            tip = CEMETERY_TIP
        else:
            impact = f"Объект расположен примерно в {dist} м."
            tip = RECOMMENDATIONS.get(
                rule_kind, "Проведите дополнительную проверку влияния объекта на сделку."
            )
        title = RISK_TITLES.get(rule_kind, raw["name"])
    return {
        "kind": kind,
        "name": raw["name"],
        "title": title,
        "category": raw["category"],
        "type": "plus" if is_plus else "minus",
        "distance_m": dist,
        "distance_text": _format_distance(dist),
        "severity": level,
        "latitude": raw["latitude"],
        "longitude": raw["longitude"],
        "impact": impact,
        "tip": tip,
        "link": None,
    }

def build_surroundings(lat: float, lon: float, radius: int, limit_per_kind: int = 3) -> dict:
    result = search_surroundings(lat, lon, radius)
    per_kind: dict[str, int] = {}
    items = []
    for raw in result["items"]:
        kind = raw["kind"]
        used = per_kind.get(kind, 0)
        if used >= limit_per_kind:
            continue
        per_kind[kind] = used + 1
        items.append(_build_item(raw))
    items.sort(key=lambda x: (0 if x["type"] == "plus" else 1, x["distance_m"]))
    return {
        "items": items,
        "failed": result["failed"],
        "radius_m": result["radius_m"],
    }

def markers_from_surroundings(
    center_lat: float,
    center_lon: float,
    address: str,
    items: list[dict],
) -> list[dict]:
    markers = [
        {
            "type": "property",
            "label": address,
            "latitude": center_lat,
            "longitude": center_lon,
        }
    ]
    for item in items:
        markers.append(
            {
                "type": item["category"],
                "kind": item["kind"],
                "label": item["name"],
                "distance_m": item["distance_m"],
                "latitude": item["latitude"],
                "longitude": item["longitude"],
            }
        )
    return markers

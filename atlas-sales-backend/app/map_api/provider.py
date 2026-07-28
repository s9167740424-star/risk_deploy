from __future__ import annotations
from typing import Protocol
from app.extensions import db
from app.models import Property
from app.risks.services import build_property_analysis
_DEMO_PLACE_CATEGORIES = [
    {
        "id": "mfc",
        "title": "МФЦ",
        "subtitle": "Ближайшие центры получения документов",
        "places": [
            {
                "name": "МФЦ Центрального района",
                "address": "ул. Примерная, 10",
                "working_hours": "09:00–20:00",
                "distance_m": 1200,
                "latitude": 59.932,
                "longitude": 30.320,
            },
            {
                "name": "МФЦ Адмиралтейского района",
                "address": "наб. Примерная, 5",
                "working_hours": "09:00–21:00",
                "distance_m": 2400,
                "latitude": 59.925,
                "longitude": 30.305,
            },
        ],
    },
    {
        "id": "rosreestr_office",
        "title": "Росреестр / кадастровая палата",
        "subtitle": "Офисы для подачи и получения документов",
        "places": [
            {
                "name": "Кадастровая палата (демо)",
                "address": "ул. Демонстрационная, 1",
                "working_hours": "09:00–18:00",
                "distance_m": 1800,
                "latitude": 59.930,
                "longitude": 30.310,
            },
        ],
    },
]

class MapDataProvider(Protocol):
    def get_property_map(self, property_id: int) -> dict | None: ...
    def search(self, query: str) -> dict: ...

def _markers_for(item: Property) -> list[dict]:
    markers = [
        {
            "type": "property",
            "label": item.address,
            "latitude": item.latitude,
            "longitude": item.longitude,
        }
    ]
    for obj in item.nearby_objects:
        markers.append(
            {
                "type": obj.category,
                "kind": obj.kind,
                "label": obj.name,
                "distance_m": obj.distance_m,
                "latitude": obj.latitude,
                "longitude": obj.longitude,
            }
        )
    return markers

def _surroundings_for(item: Property) -> list[dict]:
    analysis = build_property_analysis(item)
    risk_by_kind = {r["kind"]: r for r in analysis.get("risks") or []}
    items = []
    for obj in item.nearby_objects:
        is_plus = obj.category == "positive"
        risk = risk_by_kind.get(obj.kind)
        items.append(
            {
                "kind": obj.kind,
                "name": obj.name,
                "category": obj.category,
                "type": "plus" if is_plus else "minus",
                "distance_m": obj.distance_m,
                "latitude": obj.latitude,
                "longitude": obj.longitude,
                "impact": risk.get("reason")
                if risk
                else (
                    "Положительный фактор окружения, повышающий привлекательность объекта."
                    if is_plus
                    else "Фактор окружения, который стоит учитывать при оценке и продаже."
                ),
                "tip": risk.get("recommendation")
                if risk
                else (
                    "Отметьте этот плюс в объявлении и на показах."
                    if is_plus
                    else "Будьте готовы честно ответить на вопросы покупателя."
                ),
                "link": None,
            }
        )
    return items

class DemoMapDataProvider:
    def get_property_map(self, property_id: int) -> dict | None:
        item = db.session.get(Property, property_id)
        if item is None:
            return None
        return {
            "source": "demo",
            "property_id": item.id,
            "center": {"latitude": item.latitude, "longitude": item.longitude},
            "markers": _markers_for(item),
            "surroundings": _surroundings_for(item),
            "place_categories": list(_DEMO_PLACE_CATEGORIES),
        }
    def search(self, query: str) -> dict:
        q = (query or "").strip()
        stmt = db.select(Property).order_by(Property.id)
        if q:
            stmt = stmt.where(Property.address.ilike(f"%{q}%"))
        items = db.session.scalars(stmt).all()
        results = []
        for item in items:
            results.append(
                {
                    "property_id": item.id,
                    "address": item.address,
                    "latitude": item.latitude,
                    "longitude": item.longitude,
                    "center": {"latitude": item.latitude, "longitude": item.longitude},
                    "markers": _markers_for(item),
                }
            )
        return {"source": "demo", "query": q, "items": results}

def get_map_provider() -> MapDataProvider:
    return DemoMapDataProvider()

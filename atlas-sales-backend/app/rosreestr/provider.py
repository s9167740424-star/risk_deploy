from __future__ import annotations
from dataclasses import asdict, dataclass
from typing import Protocol
from app.extensions import db
from app.models import Property

@dataclass
class PropertyLookupResult:
    address: str
    cadastral_number: str | None = None
    area: float | None = None
    property_type: str | None = None
    ownership_type: str | None = None
    boundaries_status: str | None = None
    land_category: str | None = None
    permitted_use: str | None = None
    encumbrances: str | None = None
    owner_name: str | None = None
    checked_at: str | None = None
    latitude: float | None = None
    longitude: float | None = None
    source: str = "demo"
    property_id: int | None = None
    def to_dict(self):
        data = asdict(self)
        if self.property_id is not None:
            data["id"] = self.property_id
        return data

class PropertyDataProvider(Protocol):
    def lookup_by_address(self, query: str) -> PropertyLookupResult | None: ...
    def lookup_by_id(self, property_id: int) -> PropertyLookupResult | None: ...
    def list_all(self) -> list[PropertyLookupResult]: ...

def _from_model(item: Property, source: str = "demo") -> PropertyLookupResult:
    return PropertyLookupResult(
        property_id=item.id,
        address=item.address,
        cadastral_number=item.cadastral_number,
        area=item.area,
        property_type=item.property_type,
        ownership_type=item.ownership_type,
        boundaries_status=item.boundaries_status,
        land_category=item.land_category,
        permitted_use=item.permitted_use,
        encumbrances=item.encumbrances,
        owner_name=item.owner_name,
        checked_at=item.checked_at,
        latitude=item.latitude,
        longitude=item.longitude,
        source=source,
    )

class DemoPropertyProvider:
    def lookup_by_address(self, query: str) -> PropertyLookupResult | None:
        q = (query or "").strip()
        if not q:
            return None
        # 1) прямой подстрочный матч: адрес в базе содержит запрос
        item = db.session.scalar(
            db.select(Property)
            .where(Property.address.ilike(f"%{q}%"))
            .order_by(Property.id)
            .limit(1)
        )
        if item:
            return _from_model(item)
        # 2) обратный и нечёткий матч: геокодер часто добавляет "Россия, ",
        #    город и т.п., поэтому сравниваем по значимым токенам адреса.
        import re

        def norm(s: str) -> str:
            s = (s or "").lower().replace("ё", "е")
            return re.sub(r"[^0-9a-zа-я]+", " ", s).strip()

        qn = norm(q)
        # выкидываем частые префиксы-шумы
        stop = {"россия", "город", "г", "ул", "улица", "проспект", "пр", "д", "дом",
                "линия", "набережная", "наб", "проезд", "переулок", "пер", "к", "корпус"}
        q_tokens = [t for t in qn.split() if t and t not in stop]
        if not q_tokens:
            return None
        best = None
        best_score = 0
        for candidate in db.session.scalars(
            db.select(Property).order_by(Property.id)
        ).all():
            an = norm(candidate.address)
            # прямое вхождение в любую сторону — сильный сигнал
            if an and (an in qn or qn in an):
                return _from_model(candidate)
            a_tokens = set(an.split())
            score = sum(1 for t in q_tokens if t in a_tokens)
            if score > best_score:
                best_score = score
                best = candidate
        # требуем совпадения хотя бы двух значимых токенов (напр. "твардовского" + "17")
        if best is not None and best_score >= 2:
            return _from_model(best)
        return None
    def lookup_by_id(self, property_id: int) -> PropertyLookupResult | None:
        item = db.session.get(Property, property_id)
        return _from_model(item) if item else None
    def list_all(self) -> list[PropertyLookupResult]:
        items = db.session.scalars(db.select(Property).order_by(Property.id)).all()
        return [_from_model(i) for i in items]

def get_property_provider() -> PropertyDataProvider:
    return DemoPropertyProvider()

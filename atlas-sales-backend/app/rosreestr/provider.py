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
        item = db.session.scalar(
            db.select(Property)
            .where(Property.address.ilike(f"%{q}%"))
            .order_by(Property.id)
            .limit(1)
        )
        return _from_model(item) if item else None
    def lookup_by_id(self, property_id: int) -> PropertyLookupResult | None:
        item = db.session.get(Property, property_id)
        return _from_model(item) if item else None
    def list_all(self) -> list[PropertyLookupResult]:
        items = db.session.scalars(db.select(Property).order_by(Property.id)).all()
        return [_from_model(i) for i in items]

def get_property_provider() -> PropertyDataProvider:
    return DemoPropertyProvider()

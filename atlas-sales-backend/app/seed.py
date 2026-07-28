from app.extensions import db
from app.models import NearbyObject, Property

def get_or_create(model, defaults=None, **lookup):
    item = db.session.scalar(db.select(model).filter_by(**lookup))
    if item is not None:
        return item, False
    params = dict(lookup)
    params.update(defaults or {})
    item = model(**params)
    db.session.add(item)
    db.session.flush()
    return item, True

def seed_demo_data():
    prop, _ = get_or_create(
        Property,
        address="ул. Садовая, 14",
        defaults={
            "cadastral_number": "78:31:0000000:1234",
            "area": 68.4,
            "property_type": "apartment",
            "ownership_type": "Индивидуальная",
            "boundaries_status": "Установлены",
            "land_category": "Земли населённых пунктов",
            "permitted_use": "Многоквартирная жилая застройка",
            "encumbrances": "Не выявлены в демонстрационных данных",
            "owner_name": "Иванов Иван Иванович",
            "checked_at": "2026-07-01",
            "latitude": 59.9343,
            "longitude": 30.3351,
        },
    )
    nearby = [
        ("metro", "Метро «Садовая»", "positive", 300, 59.9327, 30.3297),
        ("kindergarten", "Детский сад №15", "positive", 500, 59.9360, 30.3380),
        ("school", "Школа №7", "positive", 800, 59.9390, 30.3400),
        ("park", "Парк «Центральный»", "positive", 1200, 59.9430, 30.3440),
        ("railway", "Железная дорога", "risk", 1800, 59.9500, 30.3500),
        ("industrial_zone", "Промышленная зона", "risk", 2500, 59.9550, 30.3600),
    ]
    for kind, name, category, distance_m, lat, lon in nearby:
        exists = db.session.scalar(
            db.select(NearbyObject).where(
                NearbyObject.property_id == prop.id,
                NearbyObject.kind == kind,
                NearbyObject.name == name,
            )
        )
        if exists is None:
            db.session.add(
                NearbyObject(
                    property_id=prop.id,
                    kind=kind,
                    name=name,
                    category=category,
                    distance_m=distance_m,
                    latitude=lat,
                    longitude=lon,
                )
            )
    from app.content_seed import seed_content
    seed_content()
    db.session.commit()

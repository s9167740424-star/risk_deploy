from __future__ import annotations

import json
import re
from pathlib import Path

from app import create_app
from app.extensions import db
from app.models import NearbyObject, Property
from app.geo.services import build_surroundings


# Эти адреса заранее сохраняются в общей SQLite-БД.
# Потом сайт будет отдавать их из БД, без повторного вызова геокодера/parser для поиска по адресу.
KNOWN_OBJECTS = [
    {
        "address": "Москва, улица Кржижановского, 8к1",
        "latitude": 55.681854,
        "longitude": 37.564132,
        "legal": None,
    },
    {
        "address": "Москва, улица Медынская, 5к1",
        "latitude": 55.589921,
        "longitude": 37.648438,
        "legal": None,
    },
    {
        "address": "Москва, улица Твардовского, 17к1",
        "latitude": 55.794830,
        "longitude": 37.396950,
        "legal": {
            "cadastral_number": "77:08:0008011:9963",
            "timestamp": "2026-07-28T17:40:57.296290",
            "info": {
                "Вид объекта недвижимости": "Земельный участок",
                "Вид земельного участка": "Землепользование",
                "Дата присвоения": "10.09.2025",
                "Кадастровый номер": "77:08:0008011:9963",
                "Кадастровый квартал": "77:08:0008011",
                "Адрес": "Почтовый адрес ориентира: Российская Федерация, город Москва, вн.тер.г. муниципальный округ Строгино, улица Твардовского, земельный участок 11",
                "Площадь уточненная": "3 082 кв. м",
                "Статус": "Учтенный",
                "Категория земель": "Земли населенных пунктов",
                "Форма собственности": "-",
                "Кадастровая стоимость": "204 147 303,56 руб.",
                "Удельный показатель кадастровой стоимости": "66 238,58 руб./кв. м",
            },
        },
    },
    {
        "address": "Москва, улица Новорязанская, 30",
        "latitude": 55.771504,
        "longitude": 37.667806,
        "legal": None,
    },
    {
        "address": "Санкт-Петербург, 13-я линия Васильевского острова, 30",
        "latitude": 59.939640,
        "longitude": 30.272093,
        "legal": {
            "cadastral_number": "78:06:0002049:16",
            "timestamp": "2026-07-28T17:41:37.578228",
            "info": {
                "Вид объекта недвижимости": "Земельный участок",
                "Вид земельного участка": "Землепользование",
                "Дата присвоения": "12.04.2010",
                "Кадастровый номер": "78:06:0002049:16",
                "Кадастровый квартал": "78:06:0002049",
                "Адрес": "г.Санкт-Петербург, 13-я линия В.О., дом 30, литера А",
                "Площадь уточненная": "1 289 кв. м",
                "Статус": "Учтенный",
                "Категория земель": "Земли населенных пунктов",
                "Вид разрешенного использования": "для размещения жилого дома (жилых домов)",
                "Форма собственности": "Частная",
                "Кадастровая стоимость": "107 766 026,48 руб.",
                "Удельный показатель кадастровой стоимости": "83 604,365 руб./кв. м",
            },
        },
    },
    {
        "address": "Санкт-Петербург, улица Антонова-Овсеенко, 21",
        "latitude": 59.909048,
        "longitude": 30.473648,
        "legal": {
            "cadastral_number": "78:12:0006308:17",
            "timestamp": "2026-07-28T17:41:44.759675",
            "info": {
                "Вид объекта недвижимости": "Земельный участок",
                "Вид земельного участка": "Землепользование",
                "Дата присвоения": "04.05.2011",
                "Кадастровый номер": "78:12:0006308:17",
                "Кадастровый квартал": "78:12:0006308",
                "Адрес": "Почтовый адрес ориентира: г.Санкт-Петербург, улица Антонова-Овсеенко, дом 21, литера Я",
                "Площадь уточненная": "8 615 кв. м",
                "Статус": "Учтенный",
                "Категория земель": "Земли населенных пунктов",
                "Вид разрешенного использования": "для размещения жилого дома (жилых домов)",
                "Форма собственности": "Частная",
                "Кадастровая стоимость": "237 684 095,58 руб.",
                "Удельный показатель кадастровой стоимости": "27 589,564 руб./кв. м",
            },
        },
    },
    {
        "address": "Санкт-Петербург, Константиновский проспект, 26",
        "latitude": 59.972897,
        "longitude": 30.267350,
        "legal": {
            "cadastral_number": "78:07:0003269:1",
            "timestamp": "2026-07-28T17:41:51.954662",
            "info": {
                "Вид объекта недвижимости": "Земельный участок",
                "Вид земельного участка": "Землепользование",
                "Дата присвоения": "28.05.2001",
                "Кадастровый номер": "78:07:0003269:1",
                "Кадастровый квартал": "78:07:0003269",
                "Адрес": "Почтовый адрес ориентира: г.Санкт-Петербург, Константиновский проспект, дом 26",
                "Площадь уточненная": "16 942 кв. м",
                "Статус": "Ранее учтенный",
                "Категория земель": "Земли населенных пунктов",
                "Вид разрешенного использования": "для размещения жилого дома (жилых домов)",
                "Форма собственности": "-",
                "Кадастровая стоимость": "1 330 982 705,12 руб.",
                "Удельный показатель кадастровой стоимости": "78 561,132 руб./кв. м",
            },
        },
    },
    {
        "address": "Санкт-Петербург, Морская набережная, 33",
        "latitude": 59.958827,
        "longitude": 30.218751,
        "legal": None,
    },
    {
        "address": "Екатеринбург, улица Куйбышева, 74",
        "latitude": 56.829995,
        "longitude": 60.633434,
        "legal": {
            "cadastral_number": "66:41:0601031:50",
            "timestamp": "2026-07-28T17:42:36.538418",
            "info": {
                "Вид объекта недвижимости": "Земельный участок",
                "Вид земельного участка": "Землепользование",
                "Дата присвоения": "29.09.2006",
                "Кадастровый номер": "66:41:0601031:50",
                "Кадастровый квартал": "66:41:0601031",
                "Адрес": "Почтовый адрес ориентира: обл. Свердловская, г. Екатеринбург, ул. Куйбышева, дом 74",
                "Площадь уточненная": "3 378 кв. м",
                "Статус": "Ранее учтенный",
                "Категория земель": "Земли населенных пунктов",
                "Вид разрешенного использования": "многоквартирный дом",
                "Форма собственности": "Частная",
                "Кадастровая стоимость": "31 179 176,46 руб.",
                "Удельный показатель кадастровой стоимости": "9 230,07 руб./кв. м",
            },
        },
    },
    {
        "address": "Екатеринбург, Заводская улица, 34",
        "latitude": 56.833142,
        "longitude": 60.551615,
        "legal": {
            "cadastral_number": "66:41:0303066:35",
            "timestamp": "2026-07-28T17:42:43.894438",
            "info": {
                "Вид объекта недвижимости": "Земельный участок",
                "Вид земельного участка": "Землепользование",
                "Дата присвоения": "22.07.2004",
                "Кадастровый номер": "66:41:0303066:35",
                "Кадастровый квартал": "66:41:0303066",
                "Адрес": "Почтовый адрес ориентира: обл. Свердловская, г. Екатеринбург, ул. Заводская, дом 34",
                "Площадь уточненная": "4 491 кв. м",
                "Статус": "Ранее учтенный",
                "Категория земель": "Земли населенных пунктов",
                "Вид разрешенного использования": "Среднеэтажная жилая застройка",
                "Форма собственности": "Частная",
                "Кадастровая стоимость": "37 177 890,21 руб.",
                "Удельный показатель кадастровой стоимости": "8 278,309 руб./кв. м",
            },
        },
    },
]


def parse_area(value: str | None) -> float | None:
    """Преобразует строки вроде '3 082 кв. м' в 3082.0."""
    if not value:
        return None
    before_units = str(value).split("кв")[0]
    cleaned = before_units.replace("\u00a0", " ").replace(" ", "").replace(",", ".")
    match = re.search(r"\d+(?:\.\d+)?", cleaned)
    return float(match.group(0)) if match else None


def apply_legal_fields(prop: Property, legal: dict | None) -> None:
    if not legal:
        return

    info = legal.get("info") or {}

    prop.cadastral_number = (
        legal.get("cadastral_number")
        or info.get("Кадастровый номер")
        or prop.cadastral_number
    )
    prop.area = parse_area(info.get("Площадь уточненная")) or prop.area
    prop.property_type = info.get("Вид объекта недвижимости") or prop.property_type
    prop.ownership_type = info.get("Форма собственности") or prop.ownership_type
    prop.boundaries_status = info.get("Статус") or prop.boundaries_status
    prop.land_category = info.get("Категория земель") or prop.land_category
    prop.permitted_use = (
        info.get("Вид разрешенного использования")
        or info.get("Разрешенное использование")
        or info.get("Разрешённое использование")
        or prop.permitted_use
    )
    # В текущей модели нет отдельного поля для кадастровой стоимости.
    # Не записываем её в encumbrances, чтобы не смешивать разные юридические смыслы.
    prop.encumbrances = None
    prop.checked_at = legal.get("timestamp") or prop.checked_at


def save_surroundings(prop: Property, radius_m: int = 3000) -> dict:
    result = build_surroundings(prop.latitude, prop.longitude, radius_m)
    saved_count = 0

    for item in result.get("items") or []:
        db.session.add(
            NearbyObject(
                property=prop,
                kind=item["kind"],
                name=item["name"],
                category=item["category"],
                distance_m=int(item["distance_m"]),
                latitude=item.get("latitude"),
                longitude=item.get("longitude"),
            )
        )
        saved_count += 1

    return {
        "saved_count": saved_count,
        "failed": result.get("failed") or [],
        "radius_m": result.get("radius_m"),
    }


def main() -> None:
    app = create_app()
    report = []

    with app.app_context():
        db.create_all()

        # Удаляем только старые объекты недвижимости и окружение.
        # Документы, алгоритмы, материалы и пользователи не трогаются.
        db.session.query(NearbyObject).delete()
        db.session.query(Property).delete()
        db.session.commit()

        for idx, item in enumerate(KNOWN_OBJECTS, start=1):
            print()
            print(f"[{idx}/{len(KNOWN_OBJECTS)}] {item['address']}")

            prop = Property(
                address=item["address"],
                latitude=item["latitude"],
                longitude=item["longitude"],
                property_type="Объект недвижимости",
            )

            apply_legal_fields(prop, item.get("legal"))

            db.session.add(prop)
            db.session.flush()

            print(f"  coords: {prop.latitude}, {prop.longitude}")
            print(f"  cadastral: {prop.cadastral_number or '—'}")
            print("  Ищем и сохраняем плюсы/минусы окружения...")

            try:
                surroundings_report = save_surroundings(prop)
                print(
                    "  surroundings:",
                    surroundings_report["saved_count"],
                    "failed:",
                    surroundings_report["failed"],
                )
            except Exception as e:
                surroundings_report = {
                    "saved_count": 0,
                    "failed": ["surroundings_failed"],
                    "error": str(e),
                }
                print("  surroundings error:", e)

            report.append(
                {
                    "address": prop.address,
                    "latitude": prop.latitude,
                    "longitude": prop.longitude,
                    "cadastral_number": prop.cadastral_number,
                    "area": prop.area,
                    "ownership_type": prop.ownership_type,
                    "boundaries_status": prop.boundaries_status,
                    "land_category": prop.land_category,
                    "permitted_use": prop.permitted_use,
                    "checked_at": prop.checked_at,
                    "surroundings": surroundings_report,
                }
            )

        db.session.commit()

    out = Path("seed_main_known_addresses_report.json")
    out.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")

    print()
    print("Готово. Объектов записано:", len(KNOWN_OBJECTS))
    print("Отчёт:", out.resolve())


if __name__ == "__main__":
    main()

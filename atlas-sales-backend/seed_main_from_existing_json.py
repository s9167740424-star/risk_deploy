from __future__ import annotations

import json
import re
from pathlib import Path
from typing import Any

from app import create_app
from app.extensions import db
from app.models import Property, NearbyObject


# Юридические данные, которые были получены заранее.
# Для адресов, которых здесь нет, юридические поля останутся пустыми:
# фейковые данные не подставляем.
LEGAL_DATA: dict[str, dict[str, Any]] = {
    "Москва, улица Твардовского, 17к1": {
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
    "Санкт-Петербург, 13-я линия Васильевского острова, 30": {
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
    "Санкт-Петербург, улица Антонова-Овсеенко, 21": {
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
    "Санкт-Петербург, Константиновский проспект, 26": {
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
    "Екатеринбург, улица Куйбышева, 74": {
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
    "Екатеринбург, Заводская улица, 34": {
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
}


def parse_area(value: Any) -> float | None:
    if value is None:
        return None
    text = str(value).replace("\xa0", " ")
    match = re.search(r"\d[\d\s]*([,.]\d+)?", text)
    if not match:
        return None
    number = match.group(0).replace(" ", "").replace(",", ".")
    try:
        return float(number)
    except ValueError:
        return None


def clean_text(value: Any) -> str | None:
    if value is None:
        return None
    text = str(value).strip()
    return text or None


def apply_legal_data(prop: Property, requested_address: str) -> bool:
    legal = LEGAL_DATA.get(requested_address)
    if not legal:
        return False

    info = legal["info"]

    prop.cadastral_number = clean_text(
        legal.get("cadastral_number") or info.get("Кадастровый номер")
    )
    prop.area = parse_area(info.get("Площадь уточненная"))
    prop.property_type = clean_text(info.get("Вид объекта недвижимости"))
    prop.ownership_type = clean_text(info.get("Форма собственности"))
    prop.boundaries_status = clean_text(info.get("Статус"))
    prop.land_category = clean_text(info.get("Категория земель"))
    prop.permitted_use = clean_text(info.get("Вид разрешенного использования"))
    prop.encumbrances = None
    prop.owner_name = None
    prop.checked_at = clean_text(legal.get("timestamp") or info.get("Дата присвоения"))

    return True


def find_json_file() -> Path:
    candidates = [
        Path("addresses_geo_data.json"),
        Path("addresses_geo_data(2).json"),
        Path("data/addresses_geo_data.json"),
    ]
    for candidate in candidates:
        if candidate.exists():
            return candidate

    raise FileNotFoundError(
        "Не найден addresses_geo_data.json. "
        "Положи файл с окружением в atlas-sales-backend и назови его addresses_geo_data.json"
    )


def create_property_from_entry(entry: dict[str, Any]) -> tuple[Property, int, int]:
    requested_address = entry["requested_address"]
    payload = entry["data"]
    center = payload["center"]

    prop = Property(
        address=requested_address,
        latitude=float(center["latitude"]),
        longitude=float(center["longitude"]),
    )

    has_legal = apply_legal_data(prop, requested_address)

    db.session.add(prop)
    db.session.flush()

    saved_nearby = 0
    for item in payload.get("surroundings") or []:
        name = clean_text(item.get("name") or item.get("label"))
        if not name:
            continue

        db.session.add(
            NearbyObject(
                property_id=prop.id,
                kind=clean_text(item.get("kind")) or "unknown",
                name=name[:200],
                category=clean_text(item.get("category")) or (
                    "positive" if item.get("type") == "plus" else "risk"
                ),
                distance_m=int(item.get("distance_m") or 0),
                latitude=item.get("latitude"),
                longitude=item.get("longitude"),
            )
        )
        saved_nearby += 1

    return prop, saved_nearby, int(has_legal)


def main() -> None:
    json_path = find_json_file()
    entries = json.loads(json_path.read_text(encoding="utf-8"))

    app = create_app()

    report: list[dict[str, Any]] = []

    with app.app_context():
        # Удаляем только объекты недвижимости и окружение.
        # Остальные демо-данные после seed-demo сохраняются.
        old_props = db.session.scalars(db.select(Property)).all()
        for prop in old_props:
            db.session.delete(prop)
        db.session.commit()

        for index, entry in enumerate(entries, start=1):
            requested_address = entry.get("requested_address")
            print()
            print(f"[{index}/{len(entries)}] {requested_address}")

            if entry.get("status_code") != 200 or not entry.get("data"):
                print("  пропускаем: нет data/status 200")
                continue

            prop, surroundings_count, has_legal = create_property_from_entry(entry)

            pluses = sum(
                1
                for item in entry["data"].get("surroundings") or []
                if item.get("category") == "positive" or item.get("type") == "plus"
            )
            minuses = surroundings_count - pluses

            print(f"  coords: {prop.latitude}, {prop.longitude}")
            print(f"  surroundings saved: {surroundings_count} (плюсы: {pluses}, минусы: {minuses})")
            print(f"  legal saved: {'да' if has_legal else 'нет'}")
            print(f"  cadastral: {prop.cadastral_number}")

            report.append(
                {
                    "address": prop.address,
                    "latitude": prop.latitude,
                    "longitude": prop.longitude,
                    "surroundings_saved": surroundings_count,
                    "pluses": pluses,
                    "minuses": minuses,
                    "legal_saved": bool(has_legal),
                    "cadastral_number": prop.cadastral_number,
                }
            )

        db.session.commit()

    Path("seed_main_known_addresses_from_json_report.json").write_text(
        json.dumps(report, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )

    print()
    print("Готово.")
    print("Отчёт: seed_main_known_addresses_from_json_report.json")


if __name__ == "__main__":
    main()

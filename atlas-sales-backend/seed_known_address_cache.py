from __future__ import annotations

import json
from pathlib import Path
from typing import Any

from app import create_app
from app.extensions import db
from app.geo.places import DEFAULT_PLACES_RADIUS, search_offices
from app.geo.rosreestr_parser import (
    ParserUnavailable,
    normalize_parser_result,
    parse_by_coords,
)
from app.models import NearbyObject, Property, PropertySnapshot

# Используем уже собранные в main реальные юридические данные.
# У файла seed_main_from_existing_json.py есть main guard, поэтому импорт безопасен.
from seed_main_from_existing_json import LEGAL_DATA, apply_legal_data, parse_area


ADDRESSES_JSON = Path("addresses_geo_data.json")


def _normalized_cadastral_from_payload(value: Any) -> dict | None:
    if not isinstance(value, dict) or not value:
        return None

    # /geo-lookup уже возвращает нормализованный объект.
    if "source" in value or "extra" in value or "parsed_at" in value:
        return value

    # Если здесь оказался сырой ответ parser.
    if "info" in value:
        return normalize_parser_result(value)

    return value


def _apply_normalized_to_property(prop: Property, cadastral: dict | None) -> None:
    if not cadastral:
        return

    prop.cadastral_number = cadastral.get("cadastral_number") or prop.cadastral_number

    area = parse_area(cadastral.get("area"))
    if area is not None:
        prop.area = area

    prop.ownership_type = cadastral.get("ownership_type") or prop.ownership_type
    prop.boundaries_status = (
        cadastral.get("status")
        or cadastral.get("boundaries_status")
        or prop.boundaries_status
    )
    prop.land_category = cadastral.get("land_category") or prop.land_category
    prop.permitted_use = cadastral.get("permitted_use") or prop.permitted_use
    prop.encumbrances = cadastral.get("encumbrances") or prop.encumbrances
    prop.checked_at = cadastral.get("parsed_at") or prop.checked_at

    extra = cadastral.get("extra") or {}
    if isinstance(extra, dict):
        prop.property_type = extra.get("Вид объекта недвижимости") or prop.property_type


def _get_cadastral(
    address: str,
    payload: dict,
    lat: float,
    lon: float,
) -> tuple[dict | None, str]:
    # 1. Данные, уже сохранённые в актуальном main.
    raw_legal = LEGAL_DATA.get(address)
    if raw_legal:
        return normalize_parser_result(raw_legal), "existing_legal_data"

    # 2. Кадастровый снимок из addresses_geo_data.json, если он там есть.
    from_payload = _normalized_cadastral_from_payload(payload.get("cadastral"))
    if from_payload:
        return from_payload, "addresses_geo_data"

    # 3. Для отсутствующих данных обращаемся к parser один раз при seed.
    try:
        raw = parse_by_coords(lat, lon)
        if raw:
            return normalize_parser_result(raw), "parser"
        return None, "not_found"
    except ParserUnavailable as exc:
        print(f"    parser недоступен: {exc}")
        return None, "parser_unavailable"
    except Exception as exc:
        print(f"    parser error: {exc}")
        return None, "parser_error"


def _get_offices(lat: float, lon: float) -> dict:
    try:
        result = search_offices(lat, lon, DEFAULT_PLACES_RADIUS)
        return {
            "source": "seed_cache",
            "center": {"latitude": lat, "longitude": lon},
            "categories": result.get("categories") or [],
            "failed": bool(result.get("failed")),
            "radius_m": result.get("radius_m") or DEFAULT_PLACES_RADIUS,
        }
    except Exception as exc:
        print(f"    offices error: {exc}")
        return {
            "source": "seed_cache_error",
            "center": {"latitude": lat, "longitude": lon},
            "categories": [],
            "failed": True,
            "radius_m": DEFAULT_PLACES_RADIUS,
        }


def _save_nearby(prop: Property, surroundings: list[dict]) -> int:
    count = 0
    for item in surroundings:
        name = str(item.get("name") or item.get("label") or "").strip()
        if not name:
            continue

        distance = item.get("distance_m")
        if distance is None:
            continue

        db.session.add(
            NearbyObject(
                property_id=prop.id,
                kind=str(item.get("kind") or "unknown")[:50],
                name=name[:200],
                category=str(
                    item.get("category")
                    or ("positive" if item.get("type") == "plus" else "risk")
                )[:20],
                distance_m=int(distance),
                latitude=item.get("latitude"),
                longitude=item.get("longitude"),
            )
        )
        count += 1
    return count


def main() -> None:
    if not ADDRESSES_JSON.exists():
        raise FileNotFoundError(
            f"Не найден {ADDRESSES_JSON}. Запусти скрипт из atlas-sales-backend."
        )

    entries = json.loads(ADDRESSES_JSON.read_text(encoding="utf-8"))
    app = create_app()
    report = []

    with app.app_context():
        # PropertySnapshot — новая таблица. Старые таблицы не меняются.
        db.create_all()

        # Пересобираем только объекты, окружение и их кэш.
        # Пользователей, документы, алгоритмы и материалы не трогаем.
        db.session.query(PropertySnapshot).delete()
        db.session.query(NearbyObject).delete()
        db.session.query(Property).delete()
        db.session.commit()

        valid_entries = [
            entry
            for entry in entries
            if entry.get("status_code") == 200 and isinstance(entry.get("data"), dict)
        ]

        for index, entry in enumerate(valid_entries, start=1):
            address = str(entry["requested_address"]).strip()
            payload = entry["data"]
            center = payload.get("center") or {}
            lat = float(center["latitude"])
            lon = float(center["longitude"])

            print()
            print(f"[{index}/{len(valid_entries)}] {address}")

            prop = Property(
                address=address,
                latitude=lat,
                longitude=lon,
                property_type="Объект недвижимости",
            )

            # Заполняем старые колонки для совместимости.
            apply_legal_data(prop, address)

            db.session.add(prop)
            db.session.flush()

            cadastral, cadastral_source = _get_cadastral(
                address, payload, lat, lon
            )
            _apply_normalized_to_property(prop, cadastral)

            surroundings = payload.get("surroundings") or []
            nearby_count = _save_nearby(prop, surroundings)

            print(f"    окружение из JSON: {nearby_count}")
            print(
                "    кадастр:",
                cadastral.get("cadastral_number") if cadastral else "—",
                f"({cadastral_source})",
            )

            print("    ищем МФЦ/Росреестр один раз и сохраняем в SQLite...")
            offices = _get_offices(lat, lon)

            snapshot = PropertySnapshot(
                property_id=prop.id,
                cadastral_data=cadastral,
                # Важно: сохраняем ИСХОДНЫЕ items из geo-lookup.
                # Здесь уже есть distance_text, impact, tip и т.д.
                surroundings_data=surroundings,
                markers_data=payload.get("markers") or [],
                failed_data=payload.get("failed") or [],
                radius_m=int(payload.get("radius_m") or 3000),
                offices_data=offices,
            )
            db.session.add(snapshot)

            mfc_places = next(
                (
                    category.get("places") or []
                    for category in offices.get("categories") or []
                    if category.get("id") == "mfc"
                ),
                [],
            )

            report.append(
                {
                    "address": address,
                    "property_id": prop.id,
                    "surroundings_saved": nearby_count,
                    "cadastral_source": cadastral_source,
                    "cadastral_number": (
                        cadastral.get("cadastral_number") if cadastral else None
                    ),
                    "offices_failed": bool(offices.get("failed")),
                    "mfc_count": len(mfc_places),
                }
            )

        db.session.commit()

    report_path = Path("seed_known_address_cache_report.json")
    report_path.write_text(
        json.dumps(report, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )

    print()
    print("Готово.")
    print(f"Объектов сохранено: {len(report)}")
    print(f"Отчёт: {report_path.resolve()}")


if __name__ == "__main__":
    main()

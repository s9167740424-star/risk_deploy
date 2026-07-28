from __future__ import annotations

import json
from math import atan2, cos, radians, sin, sqrt
from pathlib import Path

from app import create_app
from app.extensions import db
from app.models import Property, PropertySnapshot


# Статический кэш ближайших МФЦ для 10 демонстрационных адресов.
# Никаких внешних API этот скрипт не вызывает.
#
# Важно:
# - изменяется ТОЛЬКО PropertySnapshot.offices_data;
# - кадастровые данные, окружение, маркеры, Property, NearbyObject,
#   пользователи, документы и прочие таблицы не пересоздаются;
# - категория rosreestr_office намеренно оставлена пустой:
#   административный офис Росреестра не обязательно является местом приема документов.
#   Для подачи документов на регистрацию недвижимости корректнее направлять пользователя в МФЦ.

OFFICES_BY_ADDRESS = {
    "Москва, улица Кржижановского, 8к1": {
        "name": "МФЦ «Мои документы» — Академический район",
        "address": "Москва, Новочерёмушкинская улица, 23 к5",
        "latitude": 55.680761,
        "longitude": 37.580003,
    },
    "Москва, улица Медынская, 5к1": {
        "name": "МФЦ «Мои документы» — Бирюлёво Западное",
        "address": "Москва, Востряковский проезд, 22Б",
        "latitude": 55.575254,
        "longitude": 37.656753,
    },
    "Москва, улица Твардовского, 17к1": {
        "name": "МФЦ «Мои документы» — Строгино",
        "address": "Москва, Строгинский бульвар, 28",
        "latitude": 55.802923,
        "longitude": 37.404122,
    },
    "Москва, улица Новорязанская, 30": {
        "name": "МФЦ «Мои документы» — Басманный район",
        "address": "Москва, Центросоюзный переулок, 13 ст3",
        "latitude": 55.780160,
        "longitude": 37.685742,
    },
    "Санкт-Петербург, 13-я линия Васильевского острова, 30": {
        "name": "МФЦ «Мои документы» — Василеостровский район",
        "address": "Санкт-Петербург, 15-я линия В.О., 32",
        "latitude": 59.939289,
        "longitude": 30.269232,
    },
    "Санкт-Петербург, улица Антонова-Овсеенко, 21": {
        "name": "Сектор 5 МФЦ Невского района",
        "address": "Санкт-Петербург, проспект Большевиков, 8, корп. 1, лит. А",
        "latitude": 59.915100,
        "longitude": 30.476020,
    },
    "Санкт-Петербург, Константиновский проспект, 26": {
        "name": "Сектор 1 МФЦ Петроградского района",
        "address": "Санкт-Петербург, улица Красного Курсанта, 28",
        "latitude": 59.960215,
        "longitude": 30.278595,
    },
    "Санкт-Петербург, Морская набережная, 33": {
        "name": "МФЦ «Мои документы» — Василеостровский район",
        "address": "Санкт-Петербург, улица Нахимова, 1",
        "latitude": 59.944200,
        "longitude": 30.235500,
    },
    "Екатеринбург, улица Куйбышева, 74": {
        "name": "МФЦ «Мои документы»",
        "address": "Екатеринбург, улица Малышева, 53",
        "latitude": 56.836200,
        "longitude": 60.615900,
    },
    "Екатеринбург, Заводская улица, 34": {
        "name": "МФЦ «Мои документы»",
        "address": "Екатеринбург, улица Готвальда, 6/4",
        "latitude": 56.850900,
        "longitude": 60.570400,
    },
}

MFC_TITLE = "МФЦ"
MFC_SUBTITLE = "Центры «Мои документы» рядом с объектом"
ROSREESTR_TITLE = "Росреестр / кадастровая палата"
ROSREESTR_SUBTITLE = "Офисы для подачи и получения документов"
RADIUS_M = 10000


def distance_m(
    lat1: float,
    lon1: float,
    lat2: float,
    lon2: float,
) -> int:
    """Расстояние по прямой между двумя координатами в метрах."""
    earth_radius = 6_371_000.0

    phi1 = radians(lat1)
    phi2 = radians(lat2)
    d_phi = radians(lat2 - lat1)
    d_lambda = radians(lon2 - lon1)

    a = (
        sin(d_phi / 2) ** 2
        + cos(phi1) * cos(phi2) * sin(d_lambda / 2) ** 2
    )
    return round(
        earth_radius
        * 2
        * atan2(sqrt(a), sqrt(1 - a))
    )


def build_offices_payload(prop: Property, office: dict) -> dict:
    if prop.latitude is None or prop.longitude is None:
        raise RuntimeError(
            f"У объекта {prop.address!r} отсутствуют координаты"
        )

    dist = distance_m(
        float(prop.latitude),
        float(prop.longitude),
        float(office["latitude"]),
        float(office["longitude"]),
    )

    place = {
        "name": office["name"],
        "address": office["address"],
        "working_hours": "",
        "distance_m": dist,
        "latitude": office["latitude"],
        "longitude": office["longitude"],
    }

    return {
        "source": "static_seed",
        "categories": [
            {
                "id": "mfc",
                "title": MFC_TITLE,
                "subtitle": MFC_SUBTITLE,
                "places": [place],
            },
            {
                "id": "rosreestr_office",
                "title": ROSREESTR_TITLE,
                "subtitle": ROSREESTR_SUBTITLE,
                "places": [],
            },
        ],
        "failed": False,
        "radius_m": RADIUS_M,
    }


def main() -> None:
    app = create_app()
    report: list[dict] = []

    with app.app_context():
        for index, (address, office) in enumerate(
            OFFICES_BY_ADDRESS.items(), start=1
        ):
            prop = Property.query.filter_by(address=address).first()

            if prop is None:
                print(f"[{index}/10] {address}")
                print("    ОШИБКА: Property не найден")
                report.append(
                    {
                        "address": address,
                        "ok": False,
                        "error": "property_not_found",
                    }
                )
                continue

            snapshot = PropertySnapshot.query.filter_by(
                property_id=prop.id
            ).first()

            if snapshot is None:
                print(f"[{index}/10] {address}")
                print("    ОШИБКА: PropertySnapshot не найден")
                report.append(
                    {
                        "address": address,
                        "property_id": prop.id,
                        "ok": False,
                        "error": "snapshot_not_found",
                    }
                )
                continue

            payload = build_offices_payload(prop, office)
            snapshot.offices_data = payload

            place = payload["categories"][0]["places"][0]

            print(f"[{index}/10] {address}")
            print(f"    -> {place['name']}")
            print(f"    -> {place['address']}")
            print(f"    -> {place['distance_m']} м")

            report.append(
                {
                    "address": address,
                    "property_id": prop.id,
                    "ok": True,
                    "mfc_name": place["name"],
                    "mfc_address": place["address"],
                    "distance_m": place["distance_m"],
                }
            )

        db.session.commit()

    report_path = Path(__file__).with_name(
        "seed_known_address_offices_report.json"
    )
    report_path.write_text(
        json.dumps(report, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )

    ok_count = sum(1 for item in report if item.get("ok"))

    print()
    print("Готово.")
    print(f"МФЦ сохранено: {ok_count}/10")
    print(f"Отчёт: {report_path}")

    if ok_count != len(OFFICES_BY_ADDRESS):
        raise SystemExit(
            "Не для всех объектов удалось сохранить МФЦ. "
            "Посмотрите отчёт выше."
        )


if __name__ == "__main__":
    main()

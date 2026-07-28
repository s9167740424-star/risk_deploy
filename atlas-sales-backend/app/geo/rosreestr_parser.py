from __future__ import annotations
import os
import re
import requests
_CADASTRAL_RE = re.compile(r"\b\d{1,2}:\d{1,2}:\d{5,7}(?::\d{1,10})?\b")

def _clean_cadastral(value) -> str | None:
    if not value:
        return None
    match = _CADASTRAL_RE.search(str(value))
    return match.group(0) if match else None
PARSER_URL = os.getenv("ROSREESTR_PARSER_URL", "http://127.0.0.1:8000")
PARSE_TIMEOUT = int(os.getenv("ROSREESTR_PARSER_TIMEOUT", "60"))

class ParserUnavailable(RuntimeError):
    pass

def is_enabled() -> bool:
    return os.getenv("ROSREESTR_PARSER_ENABLED", "1").strip() not in (
        "0",
        "false",
        "False",
        "",
    )

def parse_by_coords(lat: float, lon: float) -> dict | None:
    if not is_enabled():
        raise ParserUnavailable("Парсер Росреестра отключён настройкой")
    try:
        response = requests.post(
            f"{PARSER_URL}/parse",
            json={"latitude": lat, "longitude": lon},
            timeout=PARSE_TIMEOUT,
        )
    except requests.exceptions.RequestException as e:
        raise ParserUnavailable(
            f"Сервис парсера недоступен по адресу {PARSER_URL}: {e}"
        ) from e
    def _detail() -> str:
        try:
            return str(response.json().get("detail") or "").strip()
        except ValueError:
            return ""
    if response.status_code == 404:
        return None
    if response.status_code == 503:
        raise ParserUnavailable(_detail() or "Сайт НСПД недоступен")
    if response.status_code >= 500:
        raise ParserUnavailable(
            _detail() or f"Парсер вернул ошибку {response.status_code}"
        )
    try:
        return response.json()
    except ValueError as e:
        raise ParserUnavailable("Парсер вернул некорректный JSON") from e
FIELD_MATCHERS = [
    ("cadastral_number", ["кадастровый номер"]),
    ("cost", ["кадастровая стоимость"]),
    ("area", ["площадь"]),
    ("land_category", ["категория земель"]),
    ("permitted_use", [
        "разрешенное использование",
        "разрешённое использование",
        "ври",
    ]),
    ("ownership_type", ["форма собственности", "вид права"]),
    ("encumbrances", ["ограничения", "обременени"]),
    ("address", ["местоположение", "адрес"]),
    ("registered_at", ["дата постановки", "дата регистрации"]),
    ("status", ["статус записи", "статус объекта", "статус"]),
    ("boundaries_status", ["граница", "координат"]),
]

def normalize_parser_result(raw: dict) -> dict:
    info = raw.get("info") or {}
    result: dict = {
        "cadastral_number": _clean_cadastral(raw.get("cadastral_number")),
        "source": "rosreestr_parser",
        "parsed_at": raw.get("timestamp"),
    }
    used_labels = set()
    for field, markers in FIELD_MATCHERS:
        for label, value in info.items():
            if label in used_labels:
                continue
            low = label.lower()
            if any(marker in low for marker in markers):
                used_labels.add(label)
                if not result.get(field):
                    if field == "cadastral_number":
                        cleaned = _clean_cadastral(value)
                        if cleaned:
                            result[field] = cleaned
                    else:
                        result[field] = value
                break
    result["extra"] = {
        label: value for label, value in info.items() if label not in used_labels
    }
    return result

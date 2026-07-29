# Парсер Росреестра

Дочерний микросервис бэкенда (`atlas-sales-backend/rosreestr-parser/`).
Общая инструкция — в корневом `../../README.md`.

```bash
python3 -m venv .venv && source .venv/bin/activate
pip install -r ../../requirements.txt
playwright install chromium
python main.py
```

Health: http://127.0.0.1:8000/health

Обычно Flask поднимает сервис сам (`ROSREESTR_PARSER_AUTOSTART=1`).

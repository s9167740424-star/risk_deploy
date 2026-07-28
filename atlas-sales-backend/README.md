# Atlas Sales Backend

Flask API сервиса «Атлас продаж». Общая инструкция — в корневом `../README.md`.

## Быстрый старт

```bash
python3 -m venv .venv && source .venv/bin/activate
pip install -r ../requirements.txt
cp .env.example .env
flask --app run.py init-db && flask --app run.py seed-demo
flask --app run.py run --port 5000 --debug
```

Парсер: `rosreestr-parser/` (автозапуск). Контент: `content/README.md`.
API и тесты — ниже.

## API

### Авторизация

```text
POST /api/auth/register
POST /api/auth/login
POST /api/auth/logout
GET  /api/auth/me
POST /api/auth/guest
```

### Анкета

```text
GET /api/questionnaire
PUT /api/questionnaire
GET /api/questionnaire/schema
```

### Недвижимость

```text
GET /api/properties
GET /api/properties/<id>
GET /api/properties/lookup
```

### Риски

```text
GET /api/risks/property/<property_id>
```

### Документы / алгоритмы / материалы

```text
GET  /api/documents
GET  /api/documents/sources
POST /api/documents/<id>/toggle
GET  /api/algorithms
GET  /api/algorithms/tree
POST /api/algorithms/steps/<id>/toggle
GET  /api/materials
GET  /api/materials/<id>/file
```

### Карта

```text
GET /api/map/search
GET /api/map/property/<id>
GET /api/map/geo-lookup
GET /api/map/offices
GET /api/map/config
GET /api/map/document-points
```

### Health

```text
GET /api/health
```

## Тесты

```bash
pytest
```

## Архитектура

```text
app/
├── auth/ questionnaire/ property/ risks/
├── documents/ algorithms/ materials/
├── map_api/ geo/ rosreestr/ models/
rosreestr-parser/   # дочерний микросервис Playwright
```

# Атлас продаж (RiskCheck)

MVP-чеклист для продавца недвижимости: анкета, карта и окружение,
юридические сведения, документы, алгоритмы действий и статьи.

## Структура

| Путь | Назначение |
|------|------------|
| `frontend/` | React + Vite SPA (порт 3000) |
| `atlas-sales-backend/` | Flask API + SQLite (порт 5000) |
| `atlas-sales-backend/rosreestr-parser/` | Дочерний микросервис кадастровых данных НСПД (порт 8000), автозапуск из Flask |
| `requirements.txt` | Общие Python-зависимости (бэкенд + парсер) |
| `frontend/public/` | Контент: algorithms, documents, questionnaire, articles, hints |

## Возможности бэкенда

- регистрация / вход / выход / гость
- анкета и персонализация документов
- каталог объектов (демо: `ул. Садовая, 14`)
- геокодер Яндекс + окружение OpenStreetMap
- юридические данные через парсер НСПД
- алгоритмы, материалы, тесты

## Контент (`frontend/public/`)

Редактируйте файлы и залейте в БД:

```bash
cd atlas-sales-backend
flask --app run.py seed-content
# или полный демо-сид:
flask --app run.py seed-demo
```

| Что | Файлы |
|-----|-------|
| Алгоритмы | `algorithms/*.json` |
| Документы | `documents/*.json`, `documents/sources.json` |
| Анкета | `questionnaire/survey.json` |
| Материалы | `articles/*.docx` |
| Подсказки (юрданные и окружение) | `hints/hints.json` |

Формат `hints/hints.json`:

- `surroundings` — тексты `impact` / `tip` / `link` по виду объекта (`metro`, `school`, …)
- `surroundingFallback` — запасные `plus` / `minus`
- `legal` — подсказки по полям юркарточки; опционально `byValue` (подстрока в значении)
- `legalFallback`, `legalUnavailable` — запасные тексты

Плейсхолдеры в текстах: `{name}`, `{distance}`, `{value}`.
Ссылки: `{ "type": "helpful"|"algorithm", "id": "..." }` или `null`.

## Запуск

### 1. Python-зависимости

```bash
cd atlas-sales-backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r ../requirements.txt

cd rosreestr-parser
python3 -m venv .venv
source .venv/bin/activate
pip install -r ../../requirements.txt
playwright install chromium
deactivate
```

### 2. Конфиг бэкенда

```bash
cd atlas-sales-backend
cp .env.example .env
```

В `.env` нужны два ключа Яндекс.Карт (Geocoder и JavaScript API):
https://developer.tech.yandex.ru/services/

Парсер поднимается сам при старте Flask (`ROSREESTR_PARSER_AUTOSTART=1`).
Отключить: `ROSREESTR_PARSER_AUTOSTART=0` или `ROSREESTR_PARSER_ENABLED=0`.

### 3. БД и сервер API

```bash
cd atlas-sales-backend
source .venv/bin/activate
flask --app run.py init-db
flask --app run.py seed-demo
flask --app run.py run --port 5000 --debug
```

Health: http://127.0.0.1:5000/api/health

### 4. Фронтенд

```bash
cd frontend
npm install
npm run dev
```

Открыть: http://localhost:3000

Vite проксирует `/api` на бэкенд.

## Парсер (дочерний микросервис)

Каталог: `atlas-sales-backend/rosreestr-parser/`.

По координатам открывает карту НСПД в headless Chromium и возвращает
сведения об участке для карточки «Юридические данные».

Ручной запуск (если автозапуск выключен):

```bash
cd atlas-sales-backend/rosreestr-parser
source .venv/bin/activate
python main.py
```

Проверка: `curl http://127.0.0.1:8000/health`

Таймауты: `PARSER_NAV_TIMEOUT`, `PARSER_UI_TIMEOUT`, `PARSER_RESULT_TIMEOUT`, `PARSER_NAV_RETRIES`.

Коды ответа: 404 — участок не найден; 503 — НСПД недоступен / смена вёрстки.

## Карты и гео

- Geocoder API — поиск адреса на бэкенде
- JS API — отрисовка карты во фронтенде
- Overpass (OSM) — окружение и ближайшие МФЦ / Росреестр
- Результаты геопоиска кэшируются в `localStorage`; выбранный на Шаге 1
  адрес и снимок карты сохраняются у авторизованного пользователя в БД
  (`/api/user-geo`: точка, `step1`, результат поиска офисов — в том числе
  «не найдено» / ошибка поиска)

Подробности зеркал Overpass и гео-lookup: `ИНТЕГРАЦИЯ_КАРТЫ.md`.

## Деплой на PythonAnywhere

Краткий рабочий вариант: **Flask API + собранный фронт** на одном веб-приложении.
Парсер НСПД (Playwright) на бесплатном PA обычно **не поднимают** — юридические
данные с карты будут недоступны, остальное работает.

### 1. Аккаунт и файлы

1. Зарегистрируйтесь на https://www.pythonanywhere.com/
2. Загрузите проект (Git или Files → Upload), например в:
   `~/RiskCheckProject-integrated5`
3. В Bash-консоли:

```bash
cd ~/RiskCheckProject-integrated5/atlas-sales-backend
python3.10 -m venv .venv
source .venv/bin/activate
pip install -r ../requirements.txt
# Playwright/chromium на PA не ставьте, если не планируете Always-on задачу
```

### 2. Переменные окружения

Создайте `atlas-sales-backend/.env`:

```bash
SECRET_KEY=сгенерируйте-длинную-строку
DATABASE_URL=sqlite:////home/ВАШ_ЮЗЕР/RiskCheckProject-integrated5/atlas-sales-backend/atlas.db
YANDEX_GEOCODER_KEY=...
YANDEX_JS_API_KEY=...
ROSREESTR_PARSER_ENABLED=0
ROSREESTR_PARSER_AUTOSTART=0
GEO_SEARCH_RADIUS=3000
```

Путь к SQLite — **абсолютный** (иначе PA может писать БД не туда).

Инициализация:

```bash
cd ~/RiskCheckProject-integrated5/atlas-sales-backend
source .venv/bin/activate
flask --app run.py init-db
flask --app run.py seed-demo
```

### 3. Сборка фронтенда

На своей машине или в консоли PA (если хватает Node):

```bash
cd ~/RiskCheckProject-integrated5/frontend
npm ci
npm run build
```

Скопируйте содержимое `frontend/dist/` в статику бэкенда, например:

```bash
mkdir -p ~/RiskCheckProject-integrated5/atlas-sales-backend/static/spa
cp -R ~/RiskCheckProject-integrated5/frontend/dist/* \
  ~/RiskCheckProject-integrated5/atlas-sales-backend/static/spa/
```

В Web → Static files на PA удобно отдать:

| URL | Directory |
|-----|-----------|
| `/assets/` | `.../atlas-sales-backend/static/spa/assets` |
| `/hints/` | `.../frontend/public/hints` (или из dist, если попало в build) |
| `/algorithms/` и др. | при необходимости из `frontend/public/` |

Либо отдавайте весь `static/spa` с корня и проксируйте `/api` на Flask
(см. ниже WSGI + catch-all для `index.html`).

### 4. Web App (WSGI)

1. **Web** → **Add a new web app** → Manual configuration → Python 3.10
2. Source code: `.../atlas-sales-backend`
3. Working directory: `.../atlas-sales-backend`
4. Virtualenv: `.../atlas-sales-backend/.venv`
5. WSGI-файл (редактировать ссылку на странице Web), заменить содержимое на:

```python
import sys
from pathlib import Path

project = Path("/home/ВАШ_ЮЗЕР/RiskCheckProject-integrated5/atlas-sales-backend")
sys.path.insert(0, str(project))

# подхват .env (если python-dotenv уже в create_app — достаточно cwd)
from dotenv import load_dotenv
load_dotenv(project / ".env")

from wsgi import application  # noqa: E402
```

В проекте уже есть `atlas-sales-backend/wsgi.py` → `application = create_app()`.

6. Reload веб-приложения.

Проверка API: `https://ВАШ_ЮЗЕР.pythonanywhere.com/api/health`

### 5. Отдача SPA из Flask (минимум правок)

Если статика с PA Static files не настроена, после сборки можно временно
открыть `index.html` через отдельный static mapping:

| URL | Directory |
|-----|-----------|
| `/` | `.../static/spa` |

Тогда запросы к `/api/...` идут в WSGI, а `/`, `/assets/...` — файлы.
Клиентский роутер React (`/app/step1` и т.д.): добавьте **Error log** и при 404
на не-API путях отдавайте `index.html` (Error pages / свой catch-all в Flask).

Пример catch-all (добавить в `create_app`, если понадобится):

```python
from flask import send_from_directory
import os

SPA = os.path.join(app.root_path, "static", "spa")

@app.route("/", defaults={"path": ""})
@app.route("/<path:path>")
def spa(path: str):
    if path.startswith("api/"):
        return {"error": "not_found"}, 404
    target = os.path.join(SPA, path)
    if path and os.path.isfile(target):
        return send_from_directory(SPA, path)
    return send_from_directory(SPA, "index.html")
```

(Регистрировать **после** blueprints `/api/...`.)

### 6. Ограничения PythonAnywhere

| Тема | Что делать |
|------|------------|
| Парсер Playwright / Chromium | `ROSREESTR_PARSER_*=0`; кадастр с НСПД на PA не крутить |
| Исходящий HTTP (Overpass, Яндекс) | на бесплатном тарифе иногда режется allowlist — проверьте Geocoder и OSM |
| Долгие запросы офисов | ответ кэшируется у пользователя в БД (`user_geo.offices`) |
| HTTPS / домен | в Web → Domains; ключи Яндекса ограничьте вашим доменом |
| Always-on / отдельный worker | только на платных планах |

### 7. Обновление

```bash
cd ~/RiskCheckProject-integrated5
git pull   # или заново залить файлы
source atlas-sales-backend/.venv/bin/activate
pip install -r requirements.txt
cd frontend && npm ci && npm run build
cp -R dist/* ../atlas-sales-backend/static/spa/
cd ../atlas-sales-backend
flask --app run.py seed-content   # если меняли JSON/статьи
# Reload на странице Web
```

## API (кратко)

```text
POST /api/auth/register|login|logout|guest
GET  /api/auth/me
GET|PUT /api/questionnaire
GET  /api/properties ...
GET  /api/map/geo-lookup|offices|config|search|...
GET  /api/documents|algorithms|materials ...
```

Полный список — в `atlas-sales-backend/README.md`.

## Тесты

```bash
cd atlas-sales-backend
source .venv/bin/activate
pytest
```

## Лицензия

Apache 2.0 — см. `LICENSE`.

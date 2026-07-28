# RiskCheck — исправление кэша 10 известных адресов

Пакет подготовлен под актуальный `main` после merge PR #8.

## Что исправляется

1. Для известных адресов `/api/map/geo-lookup` возвращает снимок из SQLite в той же форме,
   что живой Yandex + OSM + НСПД ответ.
2. Исчезает `undefined` у расстояний: в SQLite сохраняется исходный объект окружения,
   где уже есть `distance_text`.
3. Полный нормализованный кадастровый ответ сохраняется как JSON, поэтому карточка
   известных объектов показывает те же публичные поля, что и обычный поиск.
4. МФЦ / Росреестр ищутся один раз во время seed и потом `/api/map/offices`
   отдаёт результат из SQLite.
5. Пользователи, документы, алгоритмы и материалы не удаляются.

## Важно

В текущем main реальные юридические данные заранее зафиксированы только для 6 из 10 адресов.
Для 4 остальных новый seed один раз попробует получить сведения через `rosreestr-parser`.
Если parser недоступен или НСПД не найдёт объект, фейковые сведения не подставляются.

## Как установить

Сначала приведи локальный main к GitHub:

```bash
cd ~/work/RiskCheckProject
git switch main
git fetch origin
git reset --hard origin/main
git clean -fd
```

Затем распакуй этот архив поверх `~/work/RiskCheckProject`, сохраняя структуру каталогов.

После распаковки:

```bash
cd ~/work/RiskCheckProject/atlas-sales-backend
source .venv/bin/activate
python seed_known_address_cache.py
```

Если окружение называется `venv`, используй:

```bash
source venv/bin/activate
```

После seed:

```bash
cat seed_known_address_cache_report.json
```

Для каждого адреса будут:
- `cadastral_source`
- `cadastral_number`
- `surroundings_saved`
- `mfc_count`
- `offices_failed`

## Запуск

Backend:

```bash
cd ~/work/RiskCheckProject/atlas-sales-backend
source .venv/bin/activate
python run.py
```

Frontend в другом терминале:

```bash
cd ~/work/RiskCheckProject/frontend
npm run dev
```

## Проверка объекта из БД

```bash
curl --get 'http://127.0.0.1:5000/api/map/geo-lookup' \
  --data-urlencode 'q=Санкт-Петербург, 13-я линия Васильевского острова, 30'
```

В JSON должны присутствовать:

```text
"source": "db"
surroundings[*].distance_text
cadastral.cost
cadastral.status
cadastral.extra
```

## Проверка МФЦ из БД

```bash
curl 'http://127.0.0.1:5000/api/map/offices?lat=59.93964&lon=30.272093'
```

Ожидается:

```json
{
  "source": "db",
  "categories": [...]
}
```

## Какие файлы заменяются

- `atlas-sales-backend/app/models/property.py`
- `atlas-sales-backend/app/models/__init__.py`
- `atlas-sales-backend/app/map_api/routes.py`
- `frontend/src/api/mappers.ts`

Добавляется:

- `atlas-sales-backend/seed_known_address_cache.py`

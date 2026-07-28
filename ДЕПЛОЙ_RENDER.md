# Деплой RiskCheck на Render (пошагово)

Всё уже подготовлено. Тебе нужно: аккаунт GitHub, аккаунт Render, ключи Яндекс.Карт.
Проект будет одним сервисом: Flask отдаёт и API, и собранный фронтенд.

## Шаг 1. Залить проект на GitHub

1. Зайди на https://github.com , создай новый **пустой** репозиторий (например `riskcheck`), приватный можно.
2. На своём Mac, в папке проекта:

   cd ~/Documents/RiskCheckProject
   git init                 # если ещё не git-репозиторий
   git add .
   git commit -m "deploy to render"
   git branch -M main
   git remote add origin https://github.com/ТВОЙ_ЛОГИН/riskcheck.git
   git push -u origin main

   Если git попросит логин/пароль — вместо пароля нужен Personal Access Token
   (GitHub → Settings → Developer settings → Personal access tokens → generate).

## Шаг 2. Создать сервис на Render

1. Зайди на https://render.com , зарегистрируйся (можно через GitHub — тогда доступ к репам сразу).
2. Кнопка **New +** → **Web Service**.
3. Выбери свой репозиторий `riskcheck` → **Connect**.
4. Render сам увидит файл `render.yaml` и предложит применить настройки (Blueprint).
   Если спросит "Apply blueprint?" — соглашайся. Тогда build/start команды и переменные
   подхватятся автоматически.

   Если render.yaml не подхватился и он просит заполнить вручную:
   - Language / Runtime: **Python 3**
   - Build Command:  `./render-build.sh`
   - Start Command:  `cd atlas-sales-backend && gunicorn wsgi:application --bind 0.0.0.0:$PORT --workers 2 --timeout 120`
   - Instance Type:  **Free**

## Шаг 3. Вписать переменные окружения (ключи Яндекса)

В настройках сервиса → **Environment** → добавь два ключа (если не добавились сами):

   YANDEX_GEOCODER_KEY = твой_ключ_геокодера
   YANDEX_JS_API_KEY   = твой_ключ_js_api

Остальные переменные (SECRET_KEY, DATABASE_URL, отключение парсера) уже заданы в render.yaml.

ВАЖНО про ключ JS API: в кабинете Яндекса у этого ключа обычно стоит ограничение по домену.
Добавь туда домен, который выдаст Render — он будет вида `riskcheck-xxxx.onrender.com`
(увидишь его после первого деплоя вверху страницы сервиса). Иначе карта не нарисуется.

## Шаг 4. Deploy

1. Нажми **Create Web Service** (или **Deploy**).
2. Первая сборка идёт ~5–10 минут: Render ставит Node, собирает фронт, ставит Python-зависимости,
   заливает демо-данные в базу. Смотри вкладку **Logs**.
3. Когда увидишь в логах что-то вроде `Booting worker` / `Listening at: http://0.0.0.0:...`
   и статус станет **Live** — готово.
4. Открой ссылку вида `https://riskcheck-xxxx.onrender.com` — это твой сайт, доступный из любой сети.

## Проверка

- Сайт: `https://riskcheck-xxxx.onrender.com`
- Бэкенд жив: `https://riskcheck-xxxx.onrender.com/api/health` → `{"status":"ok"}`

## Что нужно знать (важно для 2 дней)

- **Free-план засыпает** после 15 минут без запросов. Первый заход после сна грузится
  ~30–50 секунд (Render будит сервис), дальше быстро. Для демо это норма.
- **База SQLite сбрасывается** при каждом рестарте/редеплое (эфемерный диск на free-плане):
  демо-данные засеются заново, но регистрации/анкеты пользователей не сохранятся между рестартами.
  Для показа проекта на 2 дня это ок.
- **Парсер Росреестра отключён** (юрданные с карты НСПД недоступны) — на free-плане он не работает.
  Всё остальное функционирует.
- Ссылка `onrender.com` **постоянная** — не меняется, можно раздавать.

## Если сборка упала

Открой **Logs** и посмотри ошибку. Частые причины:
- фронт не собрался из-за ошибки TypeScript → напиши мне текст ошибки, поправим tsconfig;
- не хватило памяти на free-плане при npm ci → обычно проходит со второй попытки (Manual Deploy → Clear build cache & deploy).

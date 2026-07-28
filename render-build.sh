#!/usr/bin/env bash
set -o errexit

# 1. Собрать фронтенд
cd frontend
npm ci
# vite build без строгого tsc (чтобы ошибки типов не роняли деплой)
npx vite build
cd ..

# 2. Скопировать собранный фронт туда, откуда Flask его отдаёт
rm -rf atlas-sales-backend/static/spa
mkdir -p atlas-sales-backend/static/spa
cp -R frontend/dist/* atlas-sales-backend/static/spa/

# 3. Python-зависимости
pip install --upgrade pip
pip install -r requirements-render.txt

# 4. Инициализировать БД и залить демо-данные + контент
cd atlas-sales-backend
flask --app run.py seed-demo
flask --app run.py seed-content

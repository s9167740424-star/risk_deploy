#!/usr/bin/env bash
set -o errexit
cd frontend
npm ci
npx vite build
cd ..
rm -rf atlas-sales-backend/static/spa
mkdir -p atlas-sales-backend/static/spa
cp -R frontend/dist/* atlas-sales-backend/static/spa/
pip install --upgrade pip
pip install -r requirements-render.txt
cd atlas-sales-backend
flask --app run.py seed-demo
flask --app run.py seed-content
python seed_main_from_existing_json.py

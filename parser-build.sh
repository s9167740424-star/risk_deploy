#!/usr/bin/env bash
set -o errexit
cd atlas-sales-backend/rosreestr-parser
pip install --upgrade pip
pip install -r requirements-render.txt
# Ставим Chromium в папку внутри проекта, чтобы рантайм нашёл его по тому же пути.
# PLAYWRIGHT_BROWSERS_PATH задаётся и тут, и в env сервиса (render.yaml) — пути должны совпадать.
export PLAYWRIGHT_BROWSERS_PATH=/opt/render/project/src/.playwright
playwright install chromium

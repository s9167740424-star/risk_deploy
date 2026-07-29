#!/usr/bin/env bash
set -o errexit
cd atlas-sales-backend/rosreestr-parser
pip install --upgrade pip
pip install -r requirements-render.txt
export PLAYWRIGHT_BROWSERS_PATH=/opt/render/project/src/.playwright
playwright install chromium

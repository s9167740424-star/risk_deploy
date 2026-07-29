#!/usr/bin/env bash
set -o errexit
cd atlas-sales-backend/rosreestr-parser
pip install --upgrade pip
pip install -r requirements-render.txt
playwright install chromium

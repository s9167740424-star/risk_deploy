import os
from dotenv import load_dotenv
load_dotenv()

class Config:
    SECRET_KEY = os.getenv("SECRET_KEY", "dev-secret-change-me")
    SQLALCHEMY_DATABASE_URI = os.getenv("DATABASE_URL", "sqlite:///atlas.db")
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    JSON_AS_ASCII = False
    YANDEX_GEOCODER_KEY = os.getenv("YANDEX_GEOCODER_KEY", "")
    YANDEX_JS_API_KEY = os.getenv("YANDEX_JS_API_KEY", "")
    GEO_SEARCH_RADIUS = int(os.getenv("GEO_SEARCH_RADIUS", "3000"))

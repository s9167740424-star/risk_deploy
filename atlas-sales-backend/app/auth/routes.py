from flask import Blueprint, request
from flask_login import current_user, login_user, logout_user
from app.extensions import db
from app.models import User
bp = Blueprint("auth", __name__, url_prefix="/api/auth")

def body():
    return request.get_json(silent=True) or {}

@bp.post("/register")
def register():
    data = body()
    full_name = str(data.get("full_name","")).strip()
    email = str(data.get("email","")).strip().lower()
    password = str(data.get("password",""))
    if len(full_name) < 2:
        return {"error":"invalid_full_name"}, 400
    if "@" not in email or len(email) > 255:
        return {"error":"invalid_email"}, 400
    if len(password) < 8:
        return {"error":"password_too_short","min_length":8}, 400
    if db.session.scalar(db.select(User).where(User.email == email)):
        return {"error":"email_already_exists"}, 409
    user = User(full_name=full_name, email=email)
    user.set_password(password)
    db.session.add(user)
    db.session.commit()
    login_user(user)
    return {"user":user.to_dict()}, 201

@bp.post("/login")
def login():
    data = body()
    email = str(data.get("email","")).strip().lower()
    password = str(data.get("password",""))
    user = db.session.scalar(db.select(User).where(User.email == email))
    if user is None or not user.check_password(password):
        return {"error":"invalid_credentials"}, 401
    login_user(user, remember=bool(data.get("remember", False)))
    return {"user":user.to_dict()}

@bp.post("/logout")
def logout():
    if current_user.is_authenticated:
        logout_user()
    return {"ok":True}

@bp.get("/me")
def me():
    if not current_user.is_authenticated:
        return {"authenticated":False,"mode":"guest"}
    return {"authenticated":True,"mode":"user","user":current_user.to_dict()}

@bp.post("/guest")
def guest():
    if current_user.is_authenticated:
        logout_user()
    return {
        "authenticated":False,"mode":"guest",
        "message":"Доступна общая информация без сохранения персонального прогресса."
    }

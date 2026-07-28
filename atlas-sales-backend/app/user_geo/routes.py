from datetime import datetime, timezone

from flask import Blueprint, request
from flask_login import current_user, login_required

from app.extensions import db
from app.models.user_geo import UserGeoState

bp = Blueprint("user_geo", __name__, url_prefix="/api/user-geo")


def _get_or_create() -> UserGeoState:
    row = db.session.scalar(
        db.select(UserGeoState).where(UserGeoState.user_id == current_user.id)
    )
    if row is None:
        row = UserGeoState(user_id=current_user.id)
        db.session.add(row)
        db.session.flush()
    return row


@bp.get("")
@login_required
def get_user_geo():
    row = db.session.scalar(
        db.select(UserGeoState).where(UserGeoState.user_id == current_user.id)
    )
    if row is None:
        return {"state": None}
    return {"state": row.to_dict()}


@bp.put("")
@login_required
def put_user_geo():
    payload = request.get_json(silent=True) or {}
    row = _get_or_create()

    if "address" in payload:
        row.address = payload.get("address")
    if "latitude" in payload:
        row.latitude = payload.get("latitude")
    if "longitude" in payload:
        row.longitude = payload.get("longitude")
    if "searchQuery" in payload:
        row.search_query = payload.get("searchQuery")
    if "radiusM" in payload:
        row.radius_m = payload.get("radiusM")
    if "step1" in payload:
        row.step1_json = payload.get("step1")
    if "offices" in payload:
        row.offices_json = payload.get("offices")

    row.updated_at = datetime.now(timezone.utc)
    db.session.commit()
    return {"state": row.to_dict()}

from flask import Blueprint
from app.extensions import db
from app.models import Property
from app.risks.services import build_property_analysis
bp = Blueprint("risks", __name__, url_prefix="/api/risks")

@bp.get("/property/<int:property_id>")
def property_risks(property_id):
    item = db.session.get(Property, property_id)
    if item is None:
        return {"error":"property_not_found"}, 404
    return {"analysis":build_property_analysis(item)}

from flask import Blueprint, request
from app.rosreestr import get_property_provider
from app.extensions import db
from app.models import Property
bp = Blueprint("property", __name__, url_prefix="/api/properties")

@bp.get("")
def list_properties():
    q = str(request.args.get("q", "")).strip()
    provider = get_property_provider()
    if q:
        found = provider.lookup_by_address(q)
        items = [found.to_dict()] if found else []
    else:
        items = [p.to_dict() for p in provider.list_all()]
    return {"items": items, "source": items[0]["source"] if items else "demo"}

@bp.get("/lookup")
def lookup_property():
    q = str(request.args.get("q", "")).strip()
    if not q:
        return {"error": "query_required"}, 400
    found = get_property_provider().lookup_by_address(q)
    if found is None:
        return {"error": "property_not_found", "query": q}, 404
    return {"property": found.to_dict()}

@bp.get("/<int:property_id>")
def get_property(property_id):
    item = db.session.get(Property, property_id)
    if item is None:
        return {"error": "property_not_found"}, 404
    data = item.to_dict(include_nearby=True)
    data["source"] = "demo"
    return {"property": data}

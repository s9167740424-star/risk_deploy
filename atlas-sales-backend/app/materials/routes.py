from flask import Blueprint, request, send_from_directory
from sqlalchemy import or_
from app.content_seed import ARTICLES_DIR
from app.extensions import db
from app.models import Material
bp = Blueprint("materials", __name__, url_prefix="/api/materials")

@bp.get("")
def list_materials():
    q = str(request.args.get("q", "")).strip()
    category = str(request.args.get("category", "")).strip()
    stmt = db.select(Material).order_by(Material.id)
    if category:
        stmt = stmt.where(Material.category == category)
    if q:
        pattern = f"%{q}%"
        stmt = stmt.where(
            or_(
                Material.title.ilike(pattern),
                Material.summary.ilike(pattern),
                Material.content.ilike(pattern),
                Material.keywords.ilike(pattern),
                Material.slug.ilike(pattern),
            )
        )
    items = db.session.scalars(stmt).all()
    return {"items": [i.to_dict() for i in items]}

@bp.get("/by-slug/<slug>")
def get_material_by_slug(slug):
    item = db.session.scalar(db.select(Material).where(Material.slug == slug))
    if item is None:
        return {"error": "material_not_found"}, 404
    return {"material": item.to_dict(include_content=True)}

@bp.get("/<int:material_id>")
def get_material(material_id):
    item = db.session.get(Material, material_id)
    if item is None:
        return {"error": "material_not_found"}, 404
    return {"material": item.to_dict(include_content=True)}

@bp.get("/<int:material_id>/file")
def get_material_file(material_id):
    item = db.session.get(Material, material_id)
    if item is None or not item.file_name:
        return {"error": "material_file_not_found"}, 404
    path = ARTICLES_DIR / item.file_name
    if not path.exists():
        return {"error": "material_file_missing"}, 404
    return send_from_directory(
        ARTICLES_DIR,
        item.file_name,
        mimetype="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        as_attachment=False,
        download_name=item.file_name,
    )

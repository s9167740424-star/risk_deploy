from flask import Blueprint
from flask_login import current_user, login_required
from app.documents.services import get_selected_documents
from app.extensions import db
from app.models import Document, DocumentSource, UserDocument
bp = Blueprint("documents", __name__, url_prefix="/api/documents")

@bp.get("/sources")
def list_document_sources():
    sources = db.session.scalars(
        db.select(DocumentSource).order_by(DocumentSource.sort_order, DocumentSource.id)
    ).all()
    return {"items": [s.to_dict() for s in sources]}

@bp.get("")
def list_documents():
    user = current_user if current_user.is_authenticated else None
    documents = get_selected_documents(user)
    progress_by_id = {}
    if user:
        rows = db.session.scalars(
            db.select(UserDocument).where(UserDocument.user_id == user.id)
        ).all()
        progress_by_id = {r.document_id: r.collected for r in rows}
    items = []
    for doc in documents:
        data = doc.to_dict()
        data["collected"] = bool(progress_by_id.get(doc.id, False))
        items.append(data)
    total = len(items)
    collected = sum(1 for x in items if x["collected"])
    sources = db.session.scalars(
        db.select(DocumentSource).order_by(DocumentSource.sort_order, DocumentSource.id)
    ).all()
    return {
        "items": items,
        "sources": [s.to_dict() for s in sources],
        "progress": {
            "collected": collected,
            "total": total,
            "percent": round(collected / total * 100) if total else 0,
        },
        "personalized": bool(user and user.questionnaire),
    }

@bp.post("/<int:document_id>/toggle")
@login_required
def toggle_document(document_id):
    doc = db.session.get(Document, document_id)
    if doc is None:
        return {"error": "document_not_found"}, 404
    row = db.session.scalar(
        db.select(UserDocument).where(
            UserDocument.user_id == current_user.id,
            UserDocument.document_id == document_id,
        )
    )
    if row is None:
        row = UserDocument(
            user_id=current_user.id, document_id=document_id, collected=True
        )
        db.session.add(row)
    else:
        row.collected = not row.collected
    db.session.commit()
    return {"document_id": document_id, "collected": row.collected}

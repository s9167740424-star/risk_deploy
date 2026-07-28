from app.extensions import db
from app.models import Document

def _answers_from_user(user):
    if user is None or user.questionnaire is None:
        return {}
    q = user.questionnaire
    answers = dict(q.answers_json or {})
    if q.owners_count == "multiple":
        answers.setdefault("ownersCount", "2+")
    elif q.owners_count == "one":
        answers.setdefault("ownersCount", "1")
    if q.maternity_capital is True:
        answers.setdefault("maternityCapital", "yes")
    elif q.maternity_capital is False:
        answers.setdefault("maternityCapital", "no")
    if q.redevelopment == "unauthorized":
        answers.setdefault("redevelopment", "yes")
    elif q.redevelopment == "none":
        answers.setdefault("redevelopment", "no")
    if q.property_type == "apartment":
        answers.setdefault("propertyType", "apartment_house")
    elif q.property_type == "house":
        answers.setdefault("propertyType", "land")
    elif q.property_type == "commercial":
        answers.setdefault("propertyType", "commercial")
    return answers

def document_matches_conditions(doc: Document, answers: dict) -> bool:
    conditions = doc.conditions_json
    if not conditions:
        return True
    if not answers:
        return False
    for rule in conditions:
        qid = rule.get("questionId")
        expected = rule.get("value")
        if qid is None:
            continue
        if answers.get(qid) != expected:
            return False
    return True

def get_selected_documents(user=None):
    answers = _answers_from_user(user)
    all_docs = db.session.scalars(
        db.select(Document).order_by(Document.sort_order, Document.id)
    ).all()
    return [d for d in all_docs if document_matches_conditions(d, answers)]

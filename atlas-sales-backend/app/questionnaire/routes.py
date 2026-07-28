from flask import Blueprint, request
from flask_login import current_user, login_required
from app.extensions import db
from app.models import QuestionnaireResponse, SurveySchema
bp = Blueprint("questionnaire", __name__, url_prefix="/api/questionnaire")
ALLOWED = {
    "owners_count": {"one", "multiple", "unknown"},
    "property_type": {"apartment", "house", "commercial"},
    "redevelopment": {"legalized", "unauthorized", "none"},
    "sale_urgency": {"asap", "three_months", "best_price"},
}

def get_or_create():
    response = current_user.questionnaire
    if response is None:
        response = QuestionnaireResponse(user_id=current_user.id)
        db.session.add(response)
        db.session.flush()
    return response

@bp.get("/schema")
def get_survey_schema():
    schema = db.session.scalar(
        db.select(SurveySchema).where(SurveySchema.code == "default")
    )
    if schema is None:
        return {"error": "survey_schema_not_found"}, 404
    return {"schema": schema.to_dict()}

@bp.get("")
@login_required
def get_questionnaire():
    response = get_or_create()
    db.session.commit()
    return {"questionnaire": response.to_dict()}

@bp.put("")
@login_required
def update_questionnaire():
    data = request.get_json(silent=True) or {}
    response = get_or_create()
    for field, allowed in ALLOWED.items():
        if field in data:
            value = data[field]
            if value is not None and value not in allowed:
                return {
                    "error": "invalid_questionnaire_value",
                    "field": field,
                    "allowed": sorted(allowed),
                }, 400
            setattr(response, field, value)
    if "maternity_capital" in data:
        value = data["maternity_capital"]
        if value not in (True, False, None):
            return {"error": "invalid_maternity_capital"}, 400
        response.maternity_capital = value
    if "current_step" in data:
        try:
            step = int(data["current_step"])
        except (TypeError, ValueError):
            return {"error": "invalid_current_step"}, 400
        if step not in (1, 2, 3):
            return {"error": "invalid_current_step"}, 400
        response.current_step = step
    if "completed" in data:
        response.completed = bool(data["completed"])
    if "answers" in data and isinstance(data["answers"], dict):
        cleaned = {
            str(k): str(v)
            for k, v in data["answers"].items()
            if v is not None and str(v) != ""
        }
        response.answers_json = cleaned
    db.session.commit()
    return {"questionnaire": response.to_dict()}

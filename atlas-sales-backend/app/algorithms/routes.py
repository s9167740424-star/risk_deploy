from collections import defaultdict
from flask import Blueprint
from flask_login import current_user, login_required
from app.extensions import db
from app.models import Algorithm, AlgorithmStep, UserAlgorithmStep
bp = Blueprint("algorithms", __name__, url_prefix="/api/algorithms")

def _completed_step_codes_for_user():
    if not current_user.is_authenticated:
        return set()
    rows = db.session.scalars(
        db.select(UserAlgorithmStep).where(UserAlgorithmStep.user_id == current_user.id)
    ).all()
    completed_ids = {r.step_id for r in rows if r.completed}
    if not completed_ids:
        return set()
    steps = db.session.scalars(
        db.select(AlgorithmStep).where(AlgorithmStep.id.in_(completed_ids))
    ).all()
    return {s.code for s in steps}

@bp.get("")
def list_algorithms():
    items = db.session.scalars(
        db.select(Algorithm).order_by(Algorithm.group_order, Algorithm.sort_order, Algorithm.id)
    ).all()
    return {"items": [i.to_dict() for i in items]}

@bp.get("/tree")
def algorithms_tree():
    completed_codes = _completed_step_codes_for_user()
    items = db.session.scalars(
        db.select(Algorithm).order_by(Algorithm.group_order, Algorithm.sort_order, Algorithm.id)
    ).all()
    groups_map = {}
    for algo in items:
        key = algo.group_code
        if key not in groups_map:
            groups_map[key] = {
                "id": algo.group_code,
                "title": algo.group_title or algo.title,
                "order": algo.group_order,
                "algorithms": [],
            }
        groups_map[key]["algorithms"].append(algo.to_config_dict(completed_codes))
    groups = sorted(groups_map.values(), key=lambda g: (g["order"], g["id"]))
    for g in groups:
        g.pop("order", None)
    checked = defaultdict(list)
    for algo in items:
        codes = [s.code for s in algo.steps if s.code in completed_codes]
        if codes:
            checked[algo.code] = codes
    return {"groups": groups, "checkedAlgorithms": dict(checked)}

@bp.get("/by-code/<code>")
def get_algorithm_by_code(code):
    algorithm = db.session.scalar(db.select(Algorithm).where(Algorithm.code == code))
    if algorithm is None:
        return {"error": "algorithm_not_found"}, 404
    return _algorithm_detail(algorithm)

@bp.get("/<int:algorithm_id>")
def get_algorithm(algorithm_id):
    algorithm = db.session.get(Algorithm, algorithm_id)
    if algorithm is None:
        return {"error": "algorithm_not_found"}, 404
    return _algorithm_detail(algorithm)

def _algorithm_detail(algorithm: Algorithm):
    completed_codes = _completed_step_codes_for_user()
    data = algorithm.to_dict()
    data["config"] = algorithm.to_config_dict(completed_codes)
    data["steps"] = [s.to_dict() for s in algorithm.steps]
    for step in data["steps"]:
        step["completed"] = step["code"] in completed_codes
    total = len(data["steps"])
    completed = sum(1 for x in data["steps"] if x["completed"])
    data["progress"] = {
        "completed": completed,
        "total": total,
        "percent": round(completed / total * 100) if total else 0,
    }
    return {"algorithm": data}

@bp.post("/steps/<int:step_id>/toggle")
@login_required
def toggle_step(step_id):
    step = db.session.get(AlgorithmStep, step_id)
    if step is None:
        return {"error": "algorithm_step_not_found"}, 404
    row = db.session.scalar(
        db.select(UserAlgorithmStep).where(
            UserAlgorithmStep.user_id == current_user.id,
            UserAlgorithmStep.step_id == step_id,
        )
    )
    if row is None:
        row = UserAlgorithmStep(user_id=current_user.id, step_id=step_id, completed=True)
        db.session.add(row)
    else:
        row.completed = not row.completed
    db.session.commit()
    return {
        "step_id": step_id,
        "step_code": step.code,
        "algorithm_code": step.algorithm.code if step.algorithm else None,
        "completed": row.completed,
    }

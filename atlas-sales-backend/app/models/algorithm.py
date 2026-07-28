from app.extensions import db

class Algorithm(db.Model):
    __tablename__ = "algorithms"
    id = db.Column(db.Integer, primary_key=True)
    code = db.Column(db.String(80), unique=True, nullable=False, index=True)
    title = db.Column(db.String(250), nullable=False)
    description = db.Column(db.Text)
    category = db.Column(db.String(80), nullable=False, default="general")
    group_code = db.Column(db.String(80), nullable=False, default="general", index=True)
    group_title = db.Column(db.String(250), nullable=False, default="")
    group_order = db.Column(db.Integer, nullable=False, default=1)
    sort_order = db.Column(db.Integer, nullable=False, default=1)
    toggle_json = db.Column(db.JSON)
    steps = db.relationship(
        "AlgorithmStep",
        back_populates="algorithm",
        order_by="AlgorithmStep.position",
        cascade="all, delete-orphan",
    )
    def to_dict(self, include_steps=False):
        data = {
            "id": self.id,
            "code": self.code,
            "title": self.title,
            "description": self.description,
            "category": self.category,
            "group_code": self.group_code,
            "group_title": self.group_title,
            "group_order": self.group_order,
            "sort_order": self.sort_order,
            "display_title": self.title,
            "subtitle": self.description or "",
            "toggle": self.toggle_json,
        }
        if include_steps:
            data["steps"] = [s.to_dict() for s in self.steps]
        return data
    def to_config_dict(self, completed_codes=None):
        completed_codes = completed_codes or set()
        return {
            "id": self.code,
            "displayTitle": self.title,
            "subtitle": self.description or "",
            "toggle": self.toggle_json,
            "steps": [s.to_ui_dict(completed_codes) for s in self.steps],
        }

class AlgorithmStep(db.Model):
    __tablename__ = "algorithm_steps"
    id = db.Column(db.Integer, primary_key=True)
    algorithm_id = db.Column(
        db.Integer,
        db.ForeignKey("algorithms.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    code = db.Column(db.String(80), nullable=False, index=True)
    position = db.Column(db.Integer, nullable=False)
    title = db.Column(db.String(300), nullable=False)
    description = db.Column(db.Text)
    is_sub_step = db.Column(db.Boolean, nullable=False, default=False)
    link_json = db.Column(db.JSON)
    algorithm = db.relationship("Algorithm", back_populates="steps")
    __table_args__ = (
        db.UniqueConstraint("algorithm_id", "code", name="uq_algorithm_step_code"),
    )
    def to_dict(self):
        return {
            "id": self.id,
            "code": self.code,
            "position": self.position,
            "title": self.title,
            "description": self.description,
            "is_sub_step": self.is_sub_step,
            "link": self.link_json,
        }
    def to_ui_dict(self, completed_codes=None):
        completed_codes = completed_codes or set()
        data = {
            "id": self.code,
            "dbId": self.id,
            "text": self.title,
            "completed": self.code in completed_codes,
        }
        if self.description:
            data["description"] = self.description
        if self.is_sub_step:
            data["isSubStep"] = True
        if self.link_json:
            data["link"] = self.link_json
        return data

class UserAlgorithmStep(db.Model):
    __tablename__ = "user_algorithm_steps"
    __table_args__ = (
        db.UniqueConstraint("user_id", "step_id", name="uq_user_algorithm_step"),
    )
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(
        db.Integer,
        db.ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    step_id = db.Column(
        db.Integer,
        db.ForeignKey("algorithm_steps.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    completed = db.Column(db.Boolean, nullable=False, default=False)
    step = db.relationship("AlgorithmStep")

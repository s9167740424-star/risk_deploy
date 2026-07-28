from app.extensions import db

class QuestionnaireResponse(db.Model):
    __tablename__ = "questionnaire_responses"
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id", ondelete="CASCADE"),
                        unique=True, nullable=False)
    owners_count = db.Column(db.String(30))
    maternity_capital = db.Column(db.Boolean)
    property_type = db.Column(db.String(30))
    redevelopment = db.Column(db.String(30))
    sale_urgency = db.Column(db.String(30))
    current_step = db.Column(db.Integer, nullable=False, default=1)
    completed = db.Column(db.Boolean, nullable=False, default=False)
    answers_json = db.Column(db.JSON)
    user = db.relationship("User", back_populates="questionnaire")
    def to_dict(self):
        return {
            "owners_count": self.owners_count,
            "maternity_capital": self.maternity_capital,
            "property_type": self.property_type,
            "redevelopment": self.redevelopment,
            "sale_urgency": self.sale_urgency,
            "current_step": self.current_step,
            "completed": self.completed,
            "answers": self.answers_json or {},
        }

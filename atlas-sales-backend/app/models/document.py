from app.extensions import db

class Document(db.Model):
    __tablename__ = "documents"
    id = db.Column(db.Integer, primary_key=True)
    code = db.Column(db.String(80), unique=True, nullable=False, index=True)
    title = db.Column(db.String(250), nullable=False)
    description = db.Column(db.Text)
    notes_json = db.Column(db.JSON)
    is_required = db.Column(db.Boolean, nullable=False, default=True)
    validity_period = db.Column(db.String(120))
    category = db.Column(db.String(80), nullable=False, default="general")
    obtain_algorithm = db.Column(db.Text)
    source_id = db.Column(db.String(80), nullable=False, default="on_hand")
    algorithm_id = db.Column(db.String(80))
    article_id = db.Column(db.String(80))
    conditions_json = db.Column(db.JSON)
    sort_order = db.Column(db.Integer, nullable=False, default=1)
    def to_dict(self):
        notes = self.notes_json
        if not notes:
            notes = [x for x in (self.description, self.obtain_algorithm) if x]
        return {
            "id": self.id,
            "code": self.code,
            "title": self.title,
            "description": self.description,
            "notes": notes or [],
            "note": notes or [],
            "is_required": self.is_required,
            "required": self.is_required,
            "validity_period": self.validity_period,
            "category": self.category,
            "obtain_algorithm": self.obtain_algorithm,
            "sourceId": self.source_id,
            "algorithmId": self.algorithm_id,
            "articleId": self.article_id,
            "conditions": self.conditions_json,
            "sort_order": self.sort_order,
        }

class UserDocument(db.Model):
    __tablename__ = "user_documents"
    __table_args__ = (
        db.UniqueConstraint("user_id", "document_id", name="uq_user_document"),
    )
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(
        db.Integer,
        db.ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    document_id = db.Column(
        db.Integer,
        db.ForeignKey("documents.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    collected = db.Column(db.Boolean, nullable=False, default=False)
    document = db.relationship("Document")

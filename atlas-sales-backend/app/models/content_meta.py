from app.extensions import db

class SurveySchema(db.Model):
    __tablename__ = "survey_schemas"
    id = db.Column(db.Integer, primary_key=True)
    code = db.Column(db.String(50), unique=True, nullable=False, default="default")
    steps_json = db.Column(db.JSON, nullable=False)
    def to_dict(self):
        return {"code": self.code, "steps": self.steps_json or []}

class DocumentSource(db.Model):
    __tablename__ = "document_sources"
    id = db.Column(db.String(80), primary_key=True)
    title = db.Column(db.String(200), nullable=False)
    download_header = db.Column(db.Text, nullable=False)
    sort_order = db.Column(db.Integer, nullable=False, default=1)
    def to_dict(self):
        return {
            "id": self.id,
            "title": self.title,
            "downloadHeader": self.download_header,
            "sort_order": self.sort_order,
        }

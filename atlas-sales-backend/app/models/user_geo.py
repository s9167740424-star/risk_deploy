from datetime import datetime, timezone

from app.extensions import db


class UserGeoState(db.Model):
    __tablename__ = "user_geo_states"

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(
        db.Integer,
        db.ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        unique=True,
        index=True,
    )
    address = db.Column(db.String(500))
    latitude = db.Column(db.Float)
    longitude = db.Column(db.Float)
    search_query = db.Column(db.String(500))
    radius_m = db.Column(db.Integer)
    step1_json = db.Column(db.JSON)
    offices_json = db.Column(db.JSON)
    updated_at = db.Column(
        db.DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )

    user = db.relationship("User", backref=db.backref("geo_state", uselist=False))

    def to_dict(self) -> dict:
        return {
            "address": self.address,
            "latitude": self.latitude,
            "longitude": self.longitude,
            "searchQuery": self.search_query,
            "radiusM": self.radius_m,
            "step1": self.step1_json,
            "offices": self.offices_json,
            "updatedAt": self.updated_at.isoformat() if self.updated_at else None,
        }

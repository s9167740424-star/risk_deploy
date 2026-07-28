from app.extensions import db


class Property(db.Model):
    __tablename__ = "properties"

    id = db.Column(db.Integer, primary_key=True)
    address = db.Column(db.String(300), nullable=False, index=True)
    cadastral_number = db.Column(db.String(50))
    area = db.Column(db.Float)
    property_type = db.Column(db.String(50))
    ownership_type = db.Column(db.String(100))
    boundaries_status = db.Column(db.String(100))
    land_category = db.Column(db.String(200))
    permitted_use = db.Column(db.String(200))
    encumbrances = db.Column(db.String(300))
    owner_name = db.Column(db.String(200))
    checked_at = db.Column(db.String(50))
    latitude = db.Column(db.Float, nullable=False)
    longitude = db.Column(db.Float, nullable=False)

    nearby_objects = db.relationship(
        "NearbyObject", back_populates="property", cascade="all, delete-orphan"
    )
    snapshot = db.relationship(
        "PropertySnapshot",
        back_populates="property",
        uselist=False,
        cascade="all, delete-orphan",
    )

    def to_dict(self, include_nearby=False):
        data = {
            "id": self.id,
            "address": self.address,
            "cadastral_number": self.cadastral_number,
            "area": self.area,
            "property_type": self.property_type,
            "ownership_type": self.ownership_type,
            "boundaries_status": self.boundaries_status,
            "land_category": self.land_category,
            "permitted_use": self.permitted_use,
            "encumbrances": self.encumbrances,
            "owner_name": self.owner_name,
            "checked_at": self.checked_at,
            "latitude": self.latitude,
            "longitude": self.longitude,
            "cadastral": self.snapshot.cadastral_data if self.snapshot else None,
        }
        if include_nearby:
            data["nearby_objects"] = [obj.to_dict() for obj in self.nearby_objects]
        return data


class NearbyObject(db.Model):
    __tablename__ = "nearby_objects"

    id = db.Column(db.Integer, primary_key=True)
    property_id = db.Column(
        db.Integer,
        db.ForeignKey("properties.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    kind = db.Column(db.String(50), nullable=False)
    name = db.Column(db.String(200), nullable=False)
    category = db.Column(db.String(20), nullable=False)
    distance_m = db.Column(db.Integer, nullable=False)
    latitude = db.Column(db.Float)
    longitude = db.Column(db.Float)

    property = db.relationship("Property", back_populates="nearby_objects")

    def to_dict(self):
        return {
            "id": self.id,
            "kind": self.kind,
            "name": self.name,
            "category": self.category,
            "distance_m": self.distance_m,
            "latitude": self.latitude,
            "longitude": self.longitude,
        }


class PropertySnapshot(db.Model):
    __tablename__ = "property_snapshots"

    id = db.Column(db.Integer, primary_key=True)
    property_id = db.Column(
        db.Integer,
        db.ForeignKey("properties.id", ondelete="CASCADE"),
        nullable=False,
        unique=True,
        index=True,
    )
    cadastral_data = db.Column(db.JSON)
    surroundings_data = db.Column(db.JSON)
    markers_data = db.Column(db.JSON)
    failed_data = db.Column(db.JSON)
    radius_m = db.Column(db.Integer)
    offices_data = db.Column(db.JSON)

    property = db.relationship("Property", back_populates="snapshot")

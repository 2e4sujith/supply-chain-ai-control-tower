from sqlalchemy import select
from sqlalchemy.exc import IntegrityError

from app.core.database import SessionLocal
from app.models.shipment import Shipment
from app.schemas.shipments import ShipmentCreate, ShipmentUpdate


DEMO_SHIPMENTS = [
    {"shipment_id": "SHP-1048", "origin": "Shanghai, CN", "destination": "Long Beach, US", "current_location": "Pacific Ocean", "status": "Delayed", "risk_score": 91, "risk_level": "Critical", "eta": "Aug 26, 08:30", "last_updated": "12 min ago", "priority": "Urgent", "risk_factors": ["Port congestion at origin", "Vessel schedule slipped 48 hours", "Weather system in transit lane"]},
    {"shipment_id": "SHP-1082", "origin": "Rotterdam, NL", "destination": "Hamburg, DE", "current_location": "North Sea", "status": "Rerouting", "risk_score": 78, "risk_level": "High", "eta": "Aug 25, 14:10", "last_updated": "34 min ago", "priority": "High", "risk_factors": ["Severe weather warning", "Alternate berth assigned"]},
    {"shipment_id": "SHP-1107", "origin": "Chicago, US", "destination": "Dallas, US", "current_location": "Oklahoma City, US", "status": "In transit", "risk_score": 72, "risk_level": "High", "eta": "Aug 25, 19:45", "last_updated": "48 min ago", "priority": "High", "risk_factors": ["Driver hours constraint", "Traffic delay on I-35"]},
    {"shipment_id": "SHP-1121", "origin": "Singapore, SG", "destination": "Sydney, AU", "current_location": "Coral Sea", "status": "Weather watch", "risk_score": 69, "risk_level": "High", "eta": "Aug 27, 06:00", "last_updated": "1 hr ago", "priority": "High", "risk_factors": ["Tropical storm track", "Reduced vessel speed"]},
    {"shipment_id": "SHP-1139", "origin": "Busan, KR", "destination": "Oakland, US", "current_location": "East China Sea", "status": "In transit", "risk_score": 54, "risk_level": "Medium", "eta": "Aug 29, 11:20", "last_updated": "1 hr ago", "priority": "Standard", "risk_factors": ["Moderate port dwell time"]},
    {"shipment_id": "SHP-1154", "origin": "Frankfurt, DE", "destination": "Toronto, CA", "current_location": "Frankfurt Airport", "status": "Processing", "risk_score": 47, "risk_level": "Medium", "eta": "Aug 26, 15:00", "last_updated": "2 hrs ago", "priority": "Standard", "risk_factors": ["Customs documentation review"]},
    {"shipment_id": "SHP-1172", "origin": "Mexico City, MX", "destination": "Atlanta, US", "current_location": "Monterrey, MX", "status": "In transit", "risk_score": 21, "risk_level": "Low", "eta": "Aug 26, 09:15", "last_updated": "2 hrs ago", "priority": "Standard", "risk_factors": ["No active disruptions"]},
    {"shipment_id": "SHP-1188", "origin": "Mumbai, IN", "destination": "Dubai, AE", "current_location": "Arabian Sea", "status": "In transit", "risk_score": 18, "risk_level": "Low", "eta": "Aug 28, 03:40", "last_updated": "3 hrs ago", "priority": "Standard", "risk_factors": ["No active disruptions"]},
    {"shipment_id": "SHP-1204", "origin": "Los Angeles, US", "destination": "Chicago, US", "current_location": "Phoenix, US", "status": "In transit", "risk_score": 16, "risk_level": "Low", "eta": "Aug 25, 22:00", "last_updated": "3 hrs ago", "priority": "Standard", "risk_factors": ["No active disruptions"]},
    {"shipment_id": "SHP-1217", "origin": "Ho Chi Minh City, VN", "destination": "Seattle, US", "current_location": "South China Sea", "status": "Booked", "risk_score": 42, "risk_level": "Medium", "eta": "Sep 01, 10:30", "last_updated": "4 hrs ago", "priority": "Standard", "risk_factors": ["Transshipment connection tight"]},
]


def serialize(shipment: Shipment) -> dict:
    return {
        "shipment_id": shipment.shipment_id,
        "origin": shipment.origin,
        "destination": shipment.destination,
        "current_location": shipment.current_location,
        "status": shipment.status,
        "risk_score": shipment.risk_score,
        "risk_level": shipment.risk_level,
        "eta": shipment.eta,
        "last_updated": shipment.last_updated,
        "priority": shipment.priority,
        "risk_factors": shipment.risk_factors,
    }


class ShipmentRepository:
    def list(self) -> list[dict]:
        with SessionLocal() as session:
            shipments = session.scalars(select(Shipment).order_by(Shipment.id)).all()
            return [serialize(shipment) for shipment in shipments]

    def get(self, shipment_id: str) -> dict | None:
        with SessionLocal() as session:
            shipment = session.scalar(select(Shipment).where(Shipment.shipment_id == shipment_id))
            return serialize(shipment) if shipment else None

    def create(self, shipment: ShipmentCreate) -> dict:
        item = Shipment(**shipment.model_dump())
        with SessionLocal() as session:
            session.add(item)
            try:
                session.commit()
            except IntegrityError:
                session.rollback()
                raise
            session.refresh(item)
            return serialize(item)

    def update(self, shipment_id: str, changes: ShipmentUpdate) -> dict | None:
        with SessionLocal() as session:
            shipment = session.scalar(select(Shipment).where(Shipment.shipment_id == shipment_id))
            if shipment is None:
                return None
            for field, value in changes.model_dump(exclude_unset=True).items():
                setattr(shipment, field, value)
            session.commit()
            session.refresh(shipment)
            return serialize(shipment)

    def delete(self, shipment_id: str) -> bool:
        with SessionLocal() as session:
            shipment = session.scalar(select(Shipment).where(Shipment.shipment_id == shipment_id))
            if shipment is None:
                return False
            session.delete(shipment)
            session.commit()
            return True

    def seed_demo_shipments(self) -> int:
        with SessionLocal() as session:
            existing_ids = set(session.scalars(select(Shipment.shipment_id)).all())
            new_shipments = [Shipment(**item) for item in DEMO_SHIPMENTS if item["shipment_id"] not in existing_ids]
            if not new_shipments:
                return 0
            session.add_all(new_shipments)
            session.commit()
            return len(new_shipments)


shipment_repository = ShipmentRepository()

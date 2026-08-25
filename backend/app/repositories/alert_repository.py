from sqlalchemy import select
from sqlalchemy.exc import IntegrityError

from app.core.database import SessionLocal
from app.models.alert import Alert
from app.schemas.alerts import AlertCreate


DEMO_ALERTS = [
    {"alert_id": "ALT-204", "shipment_id": "SHP-1048", "severity": "CRITICAL", "type": "Delay", "title": "Port congestion detected", "message": "Shanghai terminal congestion may delay vessel departure by 48 hours.", "recommended_action": "Review alternate transload capacity", "timestamp": "2026-08-24T08:42:00Z", "read": False},
    {"alert_id": "ALT-203", "shipment_id": "SHP-1082", "severity": "HIGH", "type": "Weather", "title": "Weather disruption likely", "message": "Severe weather warning detected along the North Sea route.", "recommended_action": "Confirm rerouting window", "timestamp": "2026-08-24T08:18:00Z", "read": False},
    {"alert_id": "ALT-202", "shipment_id": "SHP-1107", "severity": "HIGH", "type": "Traffic", "title": "Final-mile delay risk", "message": "Driver hours constraint could impact final-mile arrival.", "recommended_action": "Contact regional carrier", "timestamp": "2026-08-24T07:55:00Z", "read": False},
    {"alert_id": "ALT-201", "shipment_id": "SHP-1121", "severity": "MEDIUM", "type": "Weather", "title": "Storm track shifted", "message": "Tropical storm track has shifted toward the current vessel lane.", "recommended_action": "Monitor vessel speed", "timestamp": "2026-08-24T07:31:00Z", "read": True},
    {"alert_id": "ALT-200", "shipment_id": "SHP-1154", "severity": "INFORMATION", "type": "Operational", "title": "Customs review started", "message": "Customs documentation review has started at Frankfurt Airport.", "recommended_action": "No action required", "timestamp": "2026-08-24T06:48:00Z", "read": True},
    {"alert_id": "ALT-199", "shipment_id": "SHP-1107", "severity": "INFORMATION", "type": "Shipment Risk", "title": "Delivery milestone reached", "message": "Shipment arrived at Dallas distribution hub.", "recommended_action": "Confirm receiving scan", "timestamp": "2026-08-24T06:22:00Z", "read": True},
    {"alert_id": "ALT-198", "shipment_id": "SHP-1139", "severity": "MEDIUM", "type": "Route", "title": "Port dwell time elevated", "message": "Busan terminal dwell time is above the route baseline.", "recommended_action": "Review berth allocation", "timestamp": "2026-08-24T05:50:00Z", "read": True},
    {"alert_id": "ALT-197", "shipment_id": "SHP-1217", "severity": "MEDIUM", "type": "Operational", "title": "Connection window tightening", "message": "Transshipment connection has less than 12 hours of buffer.", "recommended_action": "Confirm onward booking", "timestamp": "2026-08-24T05:12:00Z", "read": True},
]


def serialize(alert: Alert) -> dict:
    return {"alert_id": alert.alert_id, "shipment_id": alert.shipment_id, "severity": alert.severity, "type": alert.type, "title": alert.title, "message": alert.message, "recommended_action": alert.recommended_action, "timestamp": alert.timestamp, "read": alert.read}


class AlertRepository:
    def list(self) -> list[dict]:
        with SessionLocal() as session:
            return [serialize(alert) for alert in session.scalars(select(Alert).order_by(Alert.id)).all()]

    def get(self, alert_id: str) -> dict | None:
        with SessionLocal() as session:
            alert = session.scalar(select(Alert).where(Alert.alert_id == alert_id.upper()))
            return serialize(alert) if alert else None

    def create(self, alert: AlertCreate) -> dict:
        item = Alert(**alert.model_dump())
        with SessionLocal() as session:
            session.add(item)
            try:
                session.commit()
            except IntegrityError:
                session.rollback()
                raise
            session.refresh(item)
            return serialize(item)

    def mark_read(self, alert_id: str) -> dict | None:
        with SessionLocal() as session:
            alert = session.scalar(select(Alert).where(Alert.alert_id == alert_id.upper()))
            if alert is None:
                return None
            alert.read = True
            session.commit()
            session.refresh(alert)
            return serialize(alert)

    def delete(self, alert_id: str) -> bool:
        with SessionLocal() as session:
            alert = session.scalar(select(Alert).where(Alert.alert_id == alert_id.upper()))
            if alert is None:
                return False
            session.delete(alert)
            session.commit()
            return True

    def seed_demo_alerts(self) -> int:
        with SessionLocal() as session:
            existing_ids = set(session.scalars(select(Alert.alert_id)).all())
            new_alerts = [Alert(**item) for item in DEMO_ALERTS if item["alert_id"] not in existing_ids]
            if not new_alerts:
                return 0
            session.add_all(new_alerts)
            session.commit()
            return len(new_alerts)


alert_repository = AlertRepository()

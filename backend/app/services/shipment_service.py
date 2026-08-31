from typing import Optional
from app.repositories.shipment_repository import shipment_repository
from app.schemas.shipments import ShipmentCreate, ShipmentUpdate


class ShipmentService:
    def list_shipments(self) -> list[dict]:
        return shipment_repository.list()

    def get_shipment(self, shipment_id: str) -> dict | None:
        return shipment_repository.get(shipment_id)

    def create_shipment(self, shipment: ShipmentCreate) -> dict | None:
        if shipment_repository.get(shipment.shipment_id):
            return None
        created = shipment_repository.create(shipment)
        if created:
            try:
                from app.api import ws_manager
                ws_manager.publish_event("shipment.created", created)
            except Exception:
                pass
        return created

    def update_shipment(self, shipment_id: str, changes: ShipmentUpdate) -> dict | None:
        updated = shipment_repository.update(shipment_id, changes)
        if updated:
            try:
                from app.api import ws_manager
                ws_manager.publish_event("shipment.updated", updated)
            except Exception:
                pass
        return updated

    def delete_shipment(self, shipment_id: str) -> bool:
        success = shipment_repository.delete(shipment_id)
        if success:
            try:
                from app.api import ws_manager
                ws_manager.publish_event("shipment.deleted", {"shipment_id": shipment_id})
            except Exception:
                pass
        return success


shipment_service = ShipmentService()


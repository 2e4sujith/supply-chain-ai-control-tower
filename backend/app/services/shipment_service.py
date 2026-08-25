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
        return shipment_repository.create(shipment)

    def update_shipment(self, shipment_id: str, changes: ShipmentUpdate) -> dict | None:
        return shipment_repository.update(shipment_id, changes)

    def delete_shipment(self, shipment_id: str) -> bool:
        return shipment_repository.delete(shipment_id)


shipment_service = ShipmentService()

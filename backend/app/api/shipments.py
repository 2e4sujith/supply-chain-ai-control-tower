from fastapi import APIRouter, HTTPException, status

from app.schemas.shipments import ShipmentCreate, ShipmentResponse, ShipmentUpdate
from app.services.shipment_service import shipment_service

router = APIRouter(prefix="/shipments", tags=["shipments"])


@router.get("", response_model=list[ShipmentResponse], summary="List shipments")
def list_shipments() -> list[dict]:
	"""Return all shipment records from the PostgreSQL-backed shipment repository."""
	return shipment_service.list_shipments()


@router.get("/{shipment_id}", response_model=ShipmentResponse, summary="Get a shipment")
def get_shipment(shipment_id: str) -> dict:
	"""Return one shipment by its unique shipment ID."""
	shipment = shipment_service.get_shipment(shipment_id)
	if shipment is None:
		raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Shipment not found")
	return shipment


@router.post("", response_model=ShipmentResponse, status_code=status.HTTP_201_CREATED, summary="Create a shipment")
def create_shipment(shipment: ShipmentCreate) -> dict:
	"""Create a shipment in the PostgreSQL-backed shipment repository."""
	created = shipment_service.create_shipment(shipment)
	if created is None:
		raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Shipment ID already exists")
	return created


@router.put("/{shipment_id}", response_model=ShipmentResponse, summary="Update a shipment")
def update_shipment(shipment_id: str, changes: ShipmentUpdate) -> dict:
	"""Update supplied fields for an existing shipment."""
	updated = shipment_service.update_shipment(shipment_id, changes)
	if updated is None:
		raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Shipment not found")
	return updated


@router.delete("/{shipment_id}", status_code=status.HTTP_204_NO_CONTENT, summary="Delete a shipment")
def delete_shipment(shipment_id: str) -> None:
	"""Delete one shipment from the PostgreSQL-backed shipment repository."""
	if not shipment_service.delete_shipment(shipment_id):
		raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Shipment not found")

from collections import Counter

from app.services.shipment_service import shipment_service


class AnalyticsService:
    def _shipments(self) -> list[dict]:
        return shipment_service.list_shipments()

    def overview(self) -> dict:
        shipments = self._shipments()
        total = len(shipments)
        active = sum(shipment["status"] != "Booked" for shipment in shipments)
        high_risk = sum(shipment["risk_level"] in {"High", "Critical"} for shipment in shipments)
        on_time = ((total - sum(shipment["status"] == "Delayed" for shipment in shipments)) / total * 100) if total else 0
        return {"total_shipments": total, "active_shipments": active, "high_risk_shipments": high_risk, "on_time_delivery": round(on_time, 1)}

    def risk_distribution(self) -> dict:
        counts = Counter(shipment["risk_level"].lower() for shipment in self._shipments())
        return {level: counts.get(level, 0) for level in ("low", "medium", "high", "critical")}

    def activity(self) -> list[dict]:
        return [{"timestamp": timestamp, "shipments": shipments} for timestamp, shipments in (("09:00", 42), ("11:00", 58), ("13:00", 51), ("15:00", 67), ("17:00", 61), ("19:00", 73))]

    def performance(self) -> dict:
        shipments = self._shipments()
        delayed = sum(shipment["status"] in {"Delayed", "Rerouting", "Weather watch"} for shipment in shipments)
        average_delay = round((delayed * 12) / len(shipments), 1) if shipments else 0
        disruption_frequency = sum(shipment["risk_level"] in {"High", "Critical"} for shipment in shipments) + 3
        on_time = self.overview()["on_time_delivery"]
        route_performance = round(max(0, on_time - (delayed / len(shipments) * 4 if shipments else 0)), 1)
        return {"average_delay": average_delay, "disruption_frequency": disruption_frequency, "route_performance": route_performance}


analytics_service = AnalyticsService()

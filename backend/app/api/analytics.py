from fastapi import APIRouter

from app.schemas.analytics import AnalyticsOverview, ActivityPoint, PerformanceMetrics, RiskDistribution
from app.services.analytics_service import analytics_service

router = APIRouter(prefix="/analytics", tags=["analytics"])


@router.get("/overview", response_model=AnalyticsOverview, summary="Get shipment overview metrics")
@router.get("/kpis", response_model=AnalyticsOverview, summary="Get shipment KPI summary")
def get_overview() -> dict:
	"""Return headline metrics derived from the shipment repository."""
	return analytics_service.overview()



@router.get("/risk-distribution", response_model=RiskDistribution, summary="Get shipment risk distribution")
def get_risk_distribution() -> dict:
	"""Return shipment counts grouped by risk level."""
	return analytics_service.risk_distribution()


@router.get("/activity", response_model=list[ActivityPoint], summary="Get shipment activity")
def get_activity() -> list[dict]:
	"""Return time-based demo activity points ready for charting."""
	return analytics_service.activity()


@router.get("/performance", response_model=PerformanceMetrics, summary="Get performance metrics")
def get_performance() -> dict:
	"""Return operational performance metrics derived from demo shipments."""
	return analytics_service.performance()

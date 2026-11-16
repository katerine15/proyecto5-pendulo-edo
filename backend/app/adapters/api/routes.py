from __future__ import annotations

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, Field

from app.core.pendulum import Params
from app.models import registry
from app.models.base import validate_params
from app.services import simulation as svc

router = APIRouter(prefix="/api")


class SimulateIn(BaseModel):
    theta0_deg: float = Field(90, gt=0, le=170)
    L: float = Field(1.0, gt=0.05, le=20)
    g: float = Field(9.81, gt=0.1, le=30)
    t_max: float = Field(10.0, gt=0.5, le=120)
    n: int = Field(600, ge=50, le=4000)


@router.get("/health")
def health() -> dict:
    return {"status": "ok"}


@router.post("/simulate")
def simulate(body: SimulateIn) -> dict:
    return svc.simulate(Params(body.theta0_deg, body.L, body.g), body.t_max, body.n)


@router.get("/periods")
def periods(L: float = Query(1.0, gt=0.05, le=20), g: float = Query(9.81, gt=0.1, le=30)) -> dict:
    return {"rows": svc.period_table(svc.REFERENCE_ANGLES, L, g)}


@router.get("/error-curve")
def error_curve(L: float = Query(1.0, gt=0.05, le=20), g: float = Query(9.81, gt=0.1, le=30)) -> dict:
    return svc.error_curve(L, g)


@router.get("/predict")
def predict(theta0_deg: float = Query(60, gt=0, le=170),
            L: float = Query(1.0, gt=0.05, le=20), g: float = Query(9.81, gt=0.1, le=30)) -> dict:
    return svc.predict(theta0_deg, L, g)


class ModelSimulateIn(BaseModel):
    params: dict[str, float] = Field(default_factory=dict)
    t_max: float = Field(10.0, gt=0.5, le=300)
    n: int = Field(600, ge=50, le=4000)


@router.get("/models")
def list_models() -> dict:
    """Catálogo: cada modelo declara sus parámetros, para que la interfaz dibuje los controles sola."""
    return {"models": [m.spec.to_dict() for m in registry.all_models()]}


@router.post("/models/{model_id}/simulate")
def simulate_model(model_id: str, body: ModelSimulateIn) -> dict:
    try:
        model = registry.get(model_id)
    except KeyError as e:
        raise HTTPException(404, str(e)) from e
    try:
        validate_params(model.spec, body.params)
        return model.simulate(body.params, body.t_max, body.n).to_dict()
    except ValueError as e:
        raise HTTPException(422, str(e)) from e

"""Registro de modelos. Para añadir uno: crea su clase en app/models/ y llámalo en `register_defaults`."""
from __future__ import annotations

from app.models.base import PhysicalModel

_MODELS: dict[str, PhysicalModel] = {}


def register(model: PhysicalModel) -> None:
    if model.spec.id in _MODELS:
        raise ValueError(f"Modelo duplicado: {model.spec.id}")
    _MODELS[model.spec.id] = model


def get(model_id: str) -> PhysicalModel:
    try:
        return _MODELS[model_id]
    except KeyError:
        raise KeyError(f"Modelo desconocido: {model_id}") from None


def all_models() -> list[PhysicalModel]:
    return list(_MODELS.values())


def register_defaults() -> None:
    if _MODELS:
        return
    from app.models.pendulum import PendulumModel
    from app.models.spring_mass import SpringMassModel

    register(PendulumModel())
    register(SpringMassModel())

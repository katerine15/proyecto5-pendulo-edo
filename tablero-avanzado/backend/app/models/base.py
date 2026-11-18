"""Contrato común de los modelos físicos de la plataforma.

Un modelo es un adaptador entre el núcleo puro (app/core) y el resto del sistema. Declara sus parámetros
(para que la interfaz dibuje los controles sola) y devuelve resultados con una forma única, así la interfaz
no necesita saber qué modelo es.
"""
from __future__ import annotations

from dataclasses import asdict, dataclass, field
from typing import Any, Protocol


@dataclass(frozen=True)
class ParamSpec:
    key: str
    label: str
    unit: str
    min: float
    max: float
    step: float
    default: float


@dataclass(frozen=True)
class ModelSpec:
    id: str
    name: str
    summary: str       # qué estudia, en una frase
    equation: str      # la ecuación diferencial, en texto
    params: tuple[ParamSpec, ...]
    x_label: str = "Tiempo t"
    x_unit: str = "s"
    y_label: str = "Posición"
    y_unit: str = "m"
    t_max_default: float = 10.0

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


@dataclass
class Series:
    key: str
    label: str
    kind: str          # 'exact' | 'numeric' | 'approx': decide color y trazo en la interfaz
    values: list[float]


@dataclass
class Metric:
    key: str
    label: str
    value: float | str | None
    unit: str = ""


@dataclass
class SimulationResult:
    t: list[float]
    series: list[Series]
    metrics: list[Metric]
    verdict: str = ""  # una frase de lectura del resultado
    extra: dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


class PhysicalModel(Protocol):
    spec: ModelSpec

    def simulate(self, params: dict[str, float], t_max: float, n: int) -> SimulationResult: ...


def validate_params(spec: ModelSpec, raw: dict[str, float]) -> dict[str, float]:
    """Completa con valores por defecto y comprueba rangos. Lanza ValueError con un mensaje claro."""
    unknown = set(raw) - {p.key for p in spec.params}
    if unknown:
        raise ValueError(f"Parámetros desconocidos para {spec.id}: {sorted(unknown)}")
    out: dict[str, float] = {}
    for p in spec.params:
        v = float(raw.get(p.key, p.default))
        if not (p.min <= v <= p.max):
            raise ValueError(f"{p.label} ({p.key}) debe estar entre {p.min} y {p.max} {p.unit}; recibido {v}")
        out[p.key] = v
    return out

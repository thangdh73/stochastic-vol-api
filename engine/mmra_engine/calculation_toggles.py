"""Effective calculation toggles for optional oil HC yield and chance blocks."""

from __future__ import annotations

from typing import TYPE_CHECKING, Optional

if TYPE_CHECKING:
    from .simulation import SimulationInput


def _tri_state_flag(inp: "SimulationInput", name: str) -> Optional[bool]:
    """Explicit True/False from input, or None when unset (infer from distributions)."""
    value = getattr(inp, name, None)
    if value is None:
        return None
    return bool(value)


def requires_oil_recovery_dist(inp: "SimulationInput") -> bool:
    """True when validation must require oil_recovery_dist."""
    if inp.fluid_type.lower() != "oil":
        return False
    flag = _tri_state_flag(inp, "apply_oil_recovery")
    if flag is False:
        return False
    if flag is True:
        return True
    # Legacy / unset: require only when a recovery distribution is present
    return getattr(inp, "oil_recovery_dist", None) is not None


def apply_oil_recovery(inp: "SimulationInput") -> bool:
    """True when oil recovery should be sampled and applied in simulation."""
    if inp.fluid_type.lower() != "oil":
        return False
    if _tri_state_flag(inp, "apply_oil_recovery") is False:
        return False
    return getattr(inp, "oil_recovery_dist", None) is not None


def requires_solution_gas_dists(inp: "SimulationInput") -> bool:
    """True when validation must require gor_dist and solution_gas_recovery_dist."""
    if inp.fluid_type.lower() != "oil":
        return False
    flag = _tri_state_flag(inp, "include_solution_gas")
    if flag is False:
        return False
    if flag is True:
        return True
    return getattr(inp, "gor_dist", None) is not None


def include_solution_gas(inp: "SimulationInput") -> bool:
    """True when oil case should sample GOR and solution gas recovery."""
    if inp.fluid_type.lower() != "oil":
        return False
    if _tri_state_flag(inp, "include_solution_gas") is False:
        return False
    return (
        getattr(inp, "gor_dist", None) is not None
        and getattr(inp, "solution_gas_recovery_dist", None) is not None
    )


def is_ccop_risk_model(inp: "SimulationInput") -> bool:
    """True when UI selected CCOP (2000) risk model."""
    return getattr(inp, "risk_model", "legacy") == "ccop_v1"


def uses_ccop_risk(inp: "SimulationInput") -> bool:
    """True when CCOP (2000) four-factor risk model is active with data."""
    return is_ccop_risk_model(inp) and bool(getattr(inp, "ccop_risk", None))


def requires_chance_categories(inp: "SimulationInput") -> bool:
    """True when validation must require chance categories."""
    flag = _tri_state_flag(inp, "include_chance")
    if flag is False:
        return False
    if flag is True:
        return True
    if uses_ccop_risk(inp):
        return True
    cats = getattr(inp, "chance_categories", None) or {}
    return bool(cats)


def include_chance(inp: "SimulationInput") -> bool:
    """True when geologic chance / Pg should be evaluated."""
    if _tri_state_flag(inp, "include_chance") is False:
        return False
    if is_ccop_risk_model(inp):
        return True
    if _tri_state_flag(inp, "include_chance") is True:
        return True
    cats = getattr(inp, "chance_categories", None) or {}
    return bool(cats)


def sync_toggles_from_distributions(inp: "SimulationInput") -> "SimulationInput":
    """
    Align explicit toggle flags with cleared distributions.

    Clients may send null distributions without toggle fields (older UI / saved JSON).
    """
    if inp.fluid_type.lower() == "oil":
        if getattr(inp, "oil_recovery_dist", None) is None:
            inp.apply_oil_recovery = False
        if (
            getattr(inp, "gor_dist", None) is None
            and getattr(inp, "solution_gas_recovery_dist", None) is None
        ):
            inp.include_solution_gas = False
    cats = getattr(inp, "chance_categories", None) or {}
    if is_ccop_risk_model(inp):
        inp.include_chance = True
    elif not cats:
        inp.include_chance = False
    return inp


def gor_active_for_correlations(inp: "SimulationInput") -> bool:
    """GOR and solution gas recovery are correlatable when solution gas is included."""
    return include_solution_gas(inp)


def oil_recovery_active_for_correlations(inp: "SimulationInput") -> bool:
    return apply_oil_recovery(inp)

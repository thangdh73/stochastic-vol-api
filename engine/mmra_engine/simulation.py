"""
simulation.py – Monte Carlo simulation orchestration.

Single-zone oil (and gas) case simulation:
    1. Construct DistributionDef objects from input spec.
    2. Draw samples from each distribution in declared order (deterministic).
    3. Compute per-iteration volumetric quantities.
    4. Aggregate output vectors into PercentileSummary.
    5. Compute Pg and Pg-risked mean.
    6. Return SimulationResult.

Variable sampling order is fixed:
    0  area
    1  percent_fill
    2  net_pay
    3  geometric_correction
    4  porosity
    5  saturation
    6  recovery_efficiency  (oil) OR gas_recovery_efficiency (gas)
    7  fvf (oil) OR gef (gas)
    8  gor (oil, optional) OR condensate_yield (gas, optional)
    9  solution_gas_recovery (oil, optional)

Reproducibility: same seed + same engine version + same input → same output.
"""

from __future__ import annotations

import hashlib
import json
import time
from dataclasses import dataclass, field
from datetime import datetime, UTC
from typing import Any, Dict, List, Optional

import numpy as np

from .constants import DEFAULT_GAS_OIL_RATIO, DEFAULT_ITERATION_COUNT, DEFAULT_SEED
from .distributions import DistributionDef, DistributionType, apply_clips, sample_distribution
from .resource_units import gas_summary_for_display, oil_summary_for_display
from .stats import PercentileSummary, calculate_percentile_summary
from .nrv_crosscheck import cross_check_warnings
from .volumetrics import (
    calculate_condensate,
    calculate_giip,
    calculate_hcpv,
    calculate_mmboe,
    calculate_nrv,
    calculate_nrv_from_grv,
    calculate_productive_area,
    calculate_recoverable_gas,
    calculate_recoverable_oil,
    calculate_solution_gas,
    calculate_stoiip,
)
from .ccop_chance import calculate_pg_ccop_or_legacy
from .chance import calculate_pg_risked_mean, PgRiskedResult
from .complex_traps import (
    ComplexTrapConfig,
    apply_complex_trap_grv,
    apply_complex_trap_productive_area,
)
from .calculation_toggles import (
    apply_oil_recovery as toggle_apply_oil_recovery,
    include_chance as toggle_include_chance,
    include_solution_gas as toggle_include_solution_gas,
    requires_oil_recovery_dist,
    requires_solution_gas_dists,
)
from .correlation import CorrelationPair, apply_input_correlations, apply_pair_rank_correlation


# ---------------------------------------------------------------------------
# Input dataclass
# ---------------------------------------------------------------------------

@dataclass
class SimulationInput:
    """
    Full specification for a single-zone Monte Carlo simulation.

    All distribution parameters must already be in canonical units
    (fractions for percents, feet for thickness, acres for area).

    fluid_type : str
        "oil", "gas", or "gas_condensate"
    """

    # Prospect metadata
    prospect_name: str = "Unnamed Prospect"
    fluid_type: str = "oil"           # "oil", "gas", "gas_condensate"
    zone_name: str = "Zone 1"
    country: str = ""
    basin: str = ""
    formation: str = ""
    notes: str = ""

    # Simulation settings
    n_iterations: int = DEFAULT_ITERATION_COUNT
    seed: int = DEFAULT_SEED
    gas_oil_ratio: float = DEFAULT_GAS_OIL_RATIO

    # Distribution definitions (all in canonical units)
    area_dist: Optional[DistributionDef] = None
    percent_fill_dist: Optional[DistributionDef] = None
    net_pay_dist: Optional[DistributionDef] = None
    geometric_correction_dist: Optional[DistributionDef] = None
    porosity_dist: Optional[DistributionDef] = None
    saturation_dist: Optional[DistributionDef] = None

    # Oil-specific
    oil_recovery_dist: Optional[DistributionDef] = None
    fvf_dist: Optional[DistributionDef] = None
    gor_dist: Optional[DistributionDef] = None
    solution_gas_recovery_dist: Optional[DistributionDef] = None

    # Gas-specific
    gas_recovery_dist: Optional[DistributionDef] = None
    gef_dist: Optional[DistributionDef] = None

    # Gas-condensate
    condensate_yield_dist: Optional[DistributionDef] = None

    # Chance categories: {name: [sub_factor_fractions]}
    chance_categories: Dict[str, List[float]] = field(default_factory=dict)
    risk_model: str = "legacy"  # legacy | ccop_v1
    ccop_risk: Optional[Dict[str, Any]] = None

    # Rank correlation between input variables (Iman–Conover)
    correlation_mode: str = "independent"  # "independent" | "rank" | "gaussian_copula"
    correlations: List[CorrelationPair] = field(default_factory=list)

    # Downdip complex trap extension of productive area
    complex_trap: ComplexTrapConfig = field(default_factory=ComplexTrapConfig)

    # Estimating method (workbook Prospect Settings)
    estimating_method: str = "area_net_pay_yield"  # area_net_pay_yield | nrv_grv_yield

    # NRV route: GRV × % fill × net/gross (acre-ft throughout)
    nrv_entry_mode: str = "grv_fill_ntg"  # grv_fill_ntg | direct | petrel_marginals
    petrel_grv_marginals: Optional[Any] = None  # PetrelGrvMarginals or dict
    grv_dist: Optional[DistributionDef] = None
    grv_percent_fill_dist: Optional[DistributionDef] = None
    net_to_gross_dist: Optional[DistributionDef] = None
    nrv_direct_dist: Optional[DistributionDef] = None
    nrv_direct_multiplier_dist: Optional[DistributionDef] = None  # default fixed 1.0 = no change

    # Optional area–NP cross-check when using NRV method
    cross_check_enabled: bool = False
    cross_check_area_dist: Optional[DistributionDef] = None
    pet_evaluation_dist: Optional[DistributionDef] = None
    grv_ntg_correlation: float = 0.0

    # Workbook-style resource display units (canonical calc unchanged)
    oil_resource_unit: str = "MMBO"  # MMBO | MMSTB | MMscm
    gas_resource_unit: str = "BCF"  # BCF | MMSCF | Bscm
    total_resource_unit: str = "MMBOE"

    # User input/display unit preferences (canonical values in distributions)
    area_input_unit: str = "acres"  # acres | sq_km
    grv_input_unit: str = "acre_ft"  # acre_ft | thousand_* | ft3 | m3
    nrv_input_unit: str = "acre_ft"  # acre_ft | thousand_* | ft3 | m3

    # Optional calculation blocks (None = infer / legacy; JSON load defaults to on)
    include_solution_gas: Optional[bool] = None
    apply_oil_recovery: Optional[bool] = None
    include_chance: Optional[bool] = None


def _summary_unit(
    canonical_unit: str,
    product_key: str,
    inp: SimulationInput,
) -> str:
    """Map engine canonical units to workbook display labels."""
    u = canonical_unit
    if product_key in ("stoiip", "recoverable_oil", "condensate"):
        pref = getattr(inp, "oil_resource_unit", "MMBO") or "MMBO"
        if u in ("MMbbl", "MMBO", "MMSTB"):
            return pref
    if product_key in ("giip", "recoverable_gas", "solution_gas"):
        pref = getattr(inp, "gas_resource_unit", "BCF") or "BCF"
        if u in ("Bcf", "BCF", "MMSCF"):
            return pref
    if product_key == "total_mmboe":
        return getattr(inp, "total_resource_unit", "MMBOE") or "MMBOE"
    return u


# ---------------------------------------------------------------------------
# Output dataclass
# ---------------------------------------------------------------------------

@dataclass
class SimulationResult:
    """
    Full output from one simulation run.
    """
    prospect_name: str
    fluid_type: str
    zone_name: str

    # Simulation metadata
    seed: int
    n_iterations: int
    gas_oil_ratio: float
    run_timestamp: str
    engine_version: str
    input_hash: str
    correlation_mode: str = "independent"
    complex_trap_method: str = ""
    complex_trap_scenario_counts: Dict[str, int] = field(default_factory=dict)
    percentile_convention: str = "P10-large (P90=conservative, P10=upside)"
    unit_system_version: str = "canonical-v1"
    clipping_applied: bool = False

    # Output summaries (None if not applicable for fluid type)
    stoiip: Optional[PercentileSummary] = None
    recoverable_oil: Optional[PercentileSummary] = None
    solution_gas: Optional[PercentileSummary] = None
    giip: Optional[PercentileSummary] = None
    recoverable_gas: Optional[PercentileSummary] = None
    condensate: Optional[PercentileSummary] = None
    total_mmboe: Optional[PercentileSummary] = None

    # Chance outputs
    pg_result: Optional[PgRiskedResult] = None

    # Raw arrays (retained for charts / further analysis)
    arrays: Dict[str, np.ndarray] = field(default_factory=dict)

    # Warnings generated during simulation
    warnings: List[str] = field(default_factory=list)

    # Calculation toggle metadata (effective flags for this run)
    solution_gas_included: bool = True
    oil_recovery_applied: bool = True
    chance_applied: bool = True
    volume_basis: str = "recoverable"


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------

def _make_fixed(
    variable_id: str,
    display_name: str,
    value: float,
    unit: str = "",
    canonical_unit: str = "",
) -> DistributionDef:
    """Convenience: create a Fixed DistributionDef."""
    return DistributionDef(
        variable_id=variable_id,
        display_name=display_name,
        distribution_type=DistributionType.FIXED,
        fixed_value=value,
        unit=unit,
        canonical_unit=canonical_unit,
    )


def _sample(
    dist: Optional[DistributionDef],
    n: int,
    rng: np.random.Generator,
    default_value: Optional[float] = None,
) -> np.ndarray:
    """
    Sample from *dist* if provided, otherwise return array of *default_value*.
    Applies clips from the distribution definition.
    """
    if dist is None:
        if default_value is None:
            raise ValueError("Distribution not provided and no default value given.")
        return np.full(n, default_value)
    samples = sample_distribution(dist, n, rng)
    return apply_clips(samples, dist.low_clip, dist.high_clip)


def _estimating_method(inp: SimulationInput) -> str:
    m = getattr(inp, "estimating_method", "area_net_pay_yield") or "area_net_pay_yield"
    return m if m in ("area_net_pay_yield", "nrv_grv_yield") else "area_net_pay_yield"


def sample_nrv_direct_multiplier(
    inp: SimulationInput,
    n: int,
    rng: np.random.Generator,
) -> np.ndarray:
    """Per-iteration multiplier on direct NRV (fixed 1.0 = no change)."""
    dist = getattr(inp, "nrv_direct_multiplier_dist", None)
    if dist is not None:
        return _sample(dist, n, rng, default_value=1.0)
    legacy = float(getattr(inp, "nrv_direct_multiplier", 1.0) or 1.0)
    return np.full(n, legacy)


def nrv_direct_multiplier_scalar(inp: SimulationInput) -> float:
    """Representative multiplier for deterministic / OAT evaluation (P50 or fixed)."""
    from .distributions import DistributionType, distribution_repr_values

    dist = getattr(inp, "nrv_direct_multiplier_dist", None)
    if dist is not None:
        if dist.distribution_type == DistributionType.FIXED and dist.fixed_value is not None:
            return float(dist.fixed_value)
        return float(distribution_repr_values(dist)["p50"])
    return float(getattr(inp, "nrv_direct_multiplier", 1.0) or 1.0)


def _draw_independent_samples(
    inp: SimulationInput,
    n: int,
    rng: np.random.Generator,
) -> tuple[Dict[str, np.ndarray], bool, bool]:
    """Draw independent samples for all active input variables."""
    ft = inp.fluid_type.lower()
    method = _estimating_method(inp)
    samples: Dict[str, np.ndarray] = {}

    if method == "area_net_pay_yield":
        samples.update({
            "area": _sample(inp.area_dist, n, rng),
            "percent_fill": _sample(inp.percent_fill_dist, n, rng, default_value=1.0),
            "net_pay": _sample(inp.net_pay_dist, n, rng),
            "geometric_correction": _sample(
                inp.geometric_correction_dist, n, rng, default_value=1.0
            ),
        })
    elif getattr(inp, "nrv_entry_mode", "grv_fill_ntg") == "direct":
        samples["nrv_direct"] = (
            _sample(inp.nrv_direct_dist, n, rng) * sample_nrv_direct_multiplier(inp, n, rng)
        )
    elif getattr(inp, "nrv_entry_mode", "grv_fill_ntg") == "petrel_marginals":
        from .petrel_grv import petrel_marginals_from_dict, sample_petrel_grv

        raw = getattr(inp, "petrel_grv_marginals", None)
        pm = raw if hasattr(raw, "depth_grv") else petrel_marginals_from_dict(raw)
        if pm is None:
            raise ValueError("petrel_grv_marginals is required when nrv_entry_mode='petrel_marginals'.")
        grv, d_idx, c_idx, _ = sample_petrel_grv(pm, n, rng)
        samples["grv"] = grv
        samples["petrel_depth_case"] = d_idx.astype(float)
        samples["petrel_contact_case"] = c_idx.astype(float)
        samples["grv_percent_fill"] = np.ones(n, dtype=float)
        samples["net_to_gross"] = _sample(
            inp.net_to_gross_dist, n, rng, default_value=1.0
        )
    else:
        samples["grv"] = _sample(inp.grv_dist, n, rng)
        samples["grv_percent_fill"] = _sample(
            inp.grv_percent_fill_dist, n, rng, default_value=1.0
        )
        samples["net_to_gross"] = _sample(
            inp.net_to_gross_dist, n, rng, default_value=1.0
        )

    if method == "nrv_grv_yield" and inp.cross_check_enabled and inp.cross_check_area_dist:
        samples["cross_check_area"] = _sample(inp.cross_check_area_dist, n, rng)

    samples["porosity"] = _sample(inp.porosity_dist, n, rng)
    samples["saturation"] = _sample(inp.saturation_dist, n, rng)
    gor_present = False
    cond_present = False

    if ft == "oil":
        if toggle_apply_oil_recovery(inp):
            samples["oil_recovery"] = _sample(inp.oil_recovery_dist, n, rng)
        else:
            samples["oil_recovery"] = np.ones(n)
        samples["fvf"] = _sample(inp.fvf_dist, n, rng)
        if toggle_include_solution_gas(inp):
            samples["gor"] = _sample(inp.gor_dist, n, rng)
            samples["solution_gas_recovery"] = _sample(
                inp.solution_gas_recovery_dist, n, rng
            )
            gor_present = True
    elif ft in ("gas", "gas_condensate"):
        samples["gas_recovery"] = _sample(inp.gas_recovery_dist, n, rng)
        samples["gef"] = _sample(inp.gef_dist, n, rng)
        if ft == "gas_condensate" and inp.condensate_yield_dist is not None:
            samples["condensate_yield"] = _sample(inp.condensate_yield_dist, n, rng)
            cond_present = True

    return samples, gor_present, cond_present


def _input_hash(inp: SimulationInput) -> str:
    """Create a short hash of the simulation input for traceability."""
    # Serialize key fields to a stable string
    summary = {
        "prospect": inp.prospect_name,
        "fluid": inp.fluid_type,
        "n": inp.n_iterations,
        "seed": inp.seed,
        "gas_oil_ratio": inp.gas_oil_ratio,
    }
    raw = json.dumps(summary, sort_keys=True)
    return hashlib.sha256(raw.encode()).hexdigest()[:16]


# ---------------------------------------------------------------------------
# Main simulation function
# ---------------------------------------------------------------------------

def run_simulation(inp: SimulationInput) -> SimulationResult:
    """
    Run a Monte Carlo simulation for a single-zone prospect.

    Parameters
    ----------
    inp : SimulationInput
        Fully specified simulation inputs (all distributions in canonical units).

    Returns
    -------
    SimulationResult
        Contains output summary statistics, raw arrays, and metadata.

    Raises
    ------
    ValueError
        If required distributions are missing for the specified fluid type.
    """
    from . import ENGINE_VERSION

    warnings: List[str] = []

    # ------------------------------------------------------------------
    # Validation
    # ------------------------------------------------------------------
    ft = inp.fluid_type.lower()
    if ft not in ("oil", "gas", "gas_condensate"):
        raise ValueError(f"Unknown fluid_type '{inp.fluid_type}'. Use 'oil', 'gas', or 'gas_condensate'.")

    method = _estimating_method(inp)

    if method == "nrv_grv_yield":
        if getattr(inp, "nrv_entry_mode", "grv_fill_ntg") == "direct":
            if inp.nrv_direct_dist is None:
                raise ValueError("nrv_direct_dist is required for NRV direct entry mode.")
        else:
            for name in ("grv_dist", "grv_percent_fill_dist", "net_to_gross_dist"):
                if getattr(inp, name) is None:
                    raise ValueError(f"Required distribution '{name}' is not provided for NRV method.")
        if inp.cross_check_enabled and inp.cross_check_area_dist is None:
            raise ValueError("cross_check_area_dist is required when cross_check_enabled is true.")
    else:
        for name in ("area_dist", "net_pay_dist"):
            if getattr(inp, name) is None:
                raise ValueError(f"Required distribution '{name}' is not provided.")

    for name in ("porosity_dist", "saturation_dist"):
        if getattr(inp, name) is None:
            raise ValueError(f"Required distribution '{name}' is not provided.")

    if ft == "oil":
        if requires_oil_recovery_dist(inp) and inp.oil_recovery_dist is None:
            raise ValueError("oil_recovery_dist is required for fluid_type='oil'.")
        if requires_solution_gas_dists(inp):
            if inp.gor_dist is None:
                raise ValueError("gor_dist is required when include_solution_gas is true.")
            if inp.solution_gas_recovery_dist is None:
                raise ValueError(
                    "solution_gas_recovery_dist is required when include_solution_gas is true."
                )
        if inp.fvf_dist is None:
            raise ValueError("fvf_dist is required for fluid_type='oil'.")
    elif ft in ("gas", "gas_condensate"):
        if inp.gas_recovery_dist is None:
            raise ValueError("gas_recovery_dist is required for gas fluid types.")
        if inp.gef_dist is None:
            raise ValueError("gef_dist is required for gas fluid types.")

    if inp.n_iterations < 1000:
        raise ValueError(
            f"n_iterations={inp.n_iterations} is below the minimum of 1,000."
        )

    # ------------------------------------------------------------------
    # RNG setup
    # ------------------------------------------------------------------
    rng = np.random.default_rng(inp.seed)
    n = inp.n_iterations

    # ------------------------------------------------------------------
    # Sample input variables (independent draws, then optional rank correlation)
    # ------------------------------------------------------------------
    sample_overrides: Optional[Dict[str, np.ndarray]] = getattr(inp, "_sample_overrides", None)
    skip_input_correlations: bool = bool(getattr(inp, "_skip_input_correlations", False))
    clipping_applied = False
    samples, gor_present, cond_present = _draw_independent_samples(inp, n, rng)
    if sample_overrides:
        for key, arr in sample_overrides.items():
            if key not in samples:
                continue
            v = np.asarray(arr, dtype=float)
            if len(v) != n:
                raise ValueError(f"Sample override for {key!r} must have length {n}.")
            samples[key] = v

    if (
        not skip_input_correlations
        and method == "nrv_grv_yield"
        and "grv" in samples
        and "net_to_gross" in samples
    ):
        rho_gn = float(getattr(inp, "grv_ntg_correlation", 0.0) or 0.0)
        if abs(rho_gn) > 1e-12:
            samples = apply_pair_rank_correlation(
                samples, "grv", "net_to_gross", rho_gn, rng
            )

    clip_keys = (
        "area_dist",
        "percent_fill_dist",
        "net_pay_dist",
        "porosity_dist",
        "saturation_dist",
        "grv_dist",
        "grv_percent_fill_dist",
        "net_to_gross_dist",
        "nrv_direct_dist",
        "nrv_direct_multiplier_dist",
    )
    for dist_key in clip_keys:
        dist = getattr(inp, dist_key, None)
        if dist and (dist.low_clip is not None or dist.high_clip is not None):
            clipping_applied = True

    if skip_input_correlations:
        corr_mode_label = "independent"
    else:
        samples, corr_mode_label = apply_input_correlations(
            samples,
            ft,
            inp.correlation_mode,
            inp.correlations,
            rng,
            gor_present=gor_present,
            condensate_present=cond_present,
            estimating_method=getattr(inp, "estimating_method", "area_net_pay_yield"),
            nrv_entry_mode=getattr(inp, "nrv_entry_mode", "grv_fill_ntg"),
            oil_recovery_present=toggle_apply_oil_recovery(inp),
        )

    phi_samples = samples["porosity"]
    sat_samples = samples["saturation"]
    ct_config = getattr(inp, "complex_trap", None)
    ct_scenario = None

    # ------------------------------------------------------------------
    # Volumetric chain (per iteration)
    # ------------------------------------------------------------------
    if method == "nrv_grv_yield":
        ct_active = (
            ct_config is not None
            and ct_config.enabled
            and ct_config.active_element_count() > 0
            and not inp.cross_check_enabled
        )
        if "nrv_direct" in samples:
            nrv_base = samples["nrv_direct"]
            fill_samples = np.ones(n)
            ntg_samples = np.ones(n)
            if ct_active:
                nrv_samples, grv_samples, ct_scenario = apply_complex_trap_grv(
                    nrv_base,
                    fill_samples,
                    ntg_samples,
                    ct_config,
                    rng,
                    direct_nrv=True,
                )
            else:
                nrv_samples = nrv_base
                grv_samples = nrv_base
        else:
            grv_samples = samples["grv"]
            fill_samples = samples["grv_percent_fill"]
            ntg_samples = samples["net_to_gross"]
            if ct_active:
                grv_samples, nrv_samples, ct_scenario = apply_complex_trap_grv(
                    grv_samples,
                    fill_samples,
                    ntg_samples,
                    ct_config,
                    rng,
                    direct_nrv=False,
                )
            else:
                nrv_samples = calculate_nrv_from_grv(
                    grv_samples, fill_samples, ntg_samples
                )

        arrays: Dict[str, np.ndarray] = {
            "grv_acft": grv_samples,
            "grv_percent_fill": fill_samples,
            "net_to_gross": ntg_samples,
            "nrv_acft": nrv_samples,
            "porosity": phi_samples,
            "saturation": sat_samples,
        }
        if ct_scenario is not None:
            arrays["complex_trap_scenario"] = ct_scenario.astype(float)
        if inp.cross_check_enabled and "cross_check_area" in samples:
            cc_area = samples["cross_check_area"]
            arrays["cross_check_area_acres"] = cc_area
            cc_warns, _ = cross_check_warnings(nrv_samples, cc_area)
            warnings.extend(cc_warns)
        hcpv_samples = calculate_hcpv(nrv_samples, phi_samples, sat_samples)
        arrays["hcpv_acft"] = hcpv_samples
    else:
        area_samples = samples["area"]
        pf_samples = samples["percent_fill"]
        np_samples = samples["net_pay"]
        gcf_samples = samples["geometric_correction"]

        if ct_config is not None and ct_config.enabled and ct_config.active_element_count() > 0:
            pa_samples, ct_scenario = apply_complex_trap_productive_area(
                area_samples, pf_samples, ct_config, rng
            )
        else:
            pa_samples = calculate_productive_area(area_samples, pf_samples)
        nrv_samples = calculate_nrv(pa_samples, np_samples, gcf_samples)
        hcpv_samples = calculate_hcpv(nrv_samples, phi_samples, sat_samples)

        arrays = {
            "area": area_samples,
            "percent_fill": pf_samples,
            "net_pay_ft": np_samples,
            "geometric_correction": gcf_samples,
            "productive_area": pa_samples,
            "nrv_acft": nrv_samples,
            "porosity": phi_samples,
            "saturation": sat_samples,
            "hcpv_acft": hcpv_samples,
        }

    stoiip_sum = None
    rec_oil_sum = None
    sol_gas_sum = None
    giip_sum = None
    rec_gas_sum = None
    cond_sum = None

    solution_gas_included = toggle_include_solution_gas(inp) if ft == "oil" else False
    oil_recovery_applied = toggle_apply_oil_recovery(inp) if ft == "oil" else True
    volume_basis = "recoverable" if oil_recovery_applied else "in_place_proxy"

    if ft == "oil":
        re_oil = samples["oil_recovery"]
        fvf_samples = samples["fvf"]
        gor_samples = samples.get("gor")

        stoiip_vec = calculate_stoiip(hcpv_samples, fvf_samples)
        rec_oil_vec = calculate_recoverable_oil(stoiip_vec, re_oil)

        arrays["fvf"] = fvf_samples
        arrays["oil_recovery"] = re_oil
        arrays["stoiip_mmbbl"] = stoiip_vec
        arrays["recoverable_oil_mmbbl"] = rec_oil_vec

        stoiip_sum = oil_summary_for_display(
            calculate_percentile_summary(stoiip_vec, "STOIIP", "MMbbl"),
            inp,
        )
        rec_oil_sum = oil_summary_for_display(
            calculate_percentile_summary(rec_oil_vec, "Recoverable Oil", "MMbbl"),
            inp,
        )

        if solution_gas_included and gor_samples is not None:
            sgre_samples = samples["solution_gas_recovery"]
            sol_gas_vec = calculate_solution_gas(rec_oil_vec, gor_samples, sgre_samples)
            arrays["gor"] = gor_samples
            arrays["solution_gas_recovery"] = sgre_samples
            arrays["solution_gas_bcf"] = sol_gas_vec
            sol_gas_sum = gas_summary_for_display(
                calculate_percentile_summary(sol_gas_vec, "Solution Gas", "Bcf"),
                inp,
            )
            mmboe_vec = calculate_mmboe(
                rec_oil_vec,
                sol_gas_vec,
                inp.gas_oil_ratio,
            )
        else:
            mmboe_vec = calculate_mmboe(rec_oil_vec, np.zeros(n), inp.gas_oil_ratio)

        arrays["total_mmboe"] = mmboe_vec
        total_mmboe_sum = calculate_percentile_summary(
            mmboe_vec,
            "Total Geologic Pre-drill",
            _summary_unit("MMBOE", "total_mmboe", inp),
        )

    elif ft in ("gas", "gas_condensate"):
        re_gas = samples["gas_recovery"]
        gef_samples = samples["gef"]
        cy_samples = samples.get("condensate_yield")

        giip_vec = calculate_giip(hcpv_samples, gef_samples)
        rec_gas_vec = calculate_recoverable_gas(giip_vec, re_gas)

        arrays["gef"] = gef_samples
        arrays["gas_recovery"] = re_gas
        arrays["giip_bcf"] = giip_vec
        arrays["recoverable_gas_bcf"] = rec_gas_vec

        giip_sum = gas_summary_for_display(
            calculate_percentile_summary(giip_vec, "GIIP", "Bcf"),
            inp,
        )
        rec_gas_sum = gas_summary_for_display(
            calculate_percentile_summary(rec_gas_vec, "Recoverable Gas", "Bcf"),
            inp,
        )

        if cy_samples is not None:
            cond_vec = calculate_condensate(rec_gas_vec, cy_samples)
            arrays["condensate_yield"] = cy_samples
            arrays["condensate_mmbbl"] = cond_vec
            cond_sum = oil_summary_for_display(
                calculate_percentile_summary(cond_vec, "Condensate", "MMbbl"),
                inp,
            )
            mmboe_vec = calculate_mmboe(cond_vec, rec_gas_vec, inp.gas_oil_ratio)
        else:
            mmboe_vec = calculate_mmboe(np.zeros(n), rec_gas_vec, inp.gas_oil_ratio)

        arrays["total_mmboe"] = mmboe_vec
        total_mmboe_sum = calculate_percentile_summary(
            mmboe_vec,
            "Total Geologic Pre-drill",
            _summary_unit("MMBOE", "total_mmboe", inp),
        )

    else:
        raise ValueError(f"Unsupported fluid_type: {ft}")

    # ------------------------------------------------------------------
    # Chance / Pg
    # ------------------------------------------------------------------
    chance_applied = toggle_include_chance(inp)
    pg_result: Optional[PgRiskedResult] = None
    use_ccop = getattr(inp, "risk_model", "legacy") == "ccop_v1"
    has_ccop = use_ccop and getattr(inp, "ccop_risk", None)
    has_legacy = not use_ccop and inp.chance_categories
    if chance_applied and (has_ccop or has_legacy):
        try:
            pg_result = calculate_pg_ccop_or_legacy(
                inp.chance_categories,
                inp.ccop_risk if use_ccop else None,
                total_mmboe_sum.mean_trimmed,
                resource_unit=getattr(inp, "total_resource_unit", "MMBOE") or "MMBOE",
            )
        except Exception as e:
            warnings.append(f"Chance calculation error: {e}")

    # ------------------------------------------------------------------
    # Complex trap metadata
    # ------------------------------------------------------------------
    ct_method_label = ""
    ct_counts: Dict[str, int] = {}
    if ct_scenario is not None:
        from .complex_traps import SCENARIO_LABELS

        ct_method_label = f"complex_trap_method_{(ct_config.method or 'A').upper()}_workbook"
        arrays["complex_trap_scenario"] = ct_scenario.astype(float)
        for code in (0, 1, 2):
            ct_counts[SCENARIO_LABELS[code]] = int(np.sum(ct_scenario == code))

    # ------------------------------------------------------------------
    # Build result
    # ------------------------------------------------------------------
    return SimulationResult(
        prospect_name=inp.prospect_name,
        fluid_type=ft,
        zone_name=inp.zone_name,
        seed=inp.seed,
        n_iterations=n,
        gas_oil_ratio=inp.gas_oil_ratio,
        run_timestamp=datetime.now(UTC).isoformat().replace("+00:00", "Z"),
        engine_version=ENGINE_VERSION,
        input_hash=_input_hash(inp),
        correlation_mode=corr_mode_label,
        complex_trap_method=ct_method_label,
        complex_trap_scenario_counts=ct_counts,
        percentile_convention="P10-large (P90=conservative, P10=upside)",
        unit_system_version="canonical-v1",
        clipping_applied=clipping_applied,
        stoiip=stoiip_sum,
        recoverable_oil=rec_oil_sum,
        solution_gas=sol_gas_sum,
        giip=giip_sum,
        recoverable_gas=rec_gas_sum,
        condensate=cond_sum,
        total_mmboe=total_mmboe_sum,
        pg_result=pg_result,
        arrays=arrays,
        warnings=warnings,
        solution_gas_included=solution_gas_included,
        oil_recovery_applied=oil_recovery_applied,
        chance_applied=chance_applied,
        volume_basis=volume_basis,
    )

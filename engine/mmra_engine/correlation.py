"""
correlation.py – Partial correlation between Monte Carlo input variables.

Methods (partial matrix — only enabled pairs are non-zero):
    rank            – Iman–Conover (Spearman rank correlation)
    gaussian_copula – Gaussian copula (Pearson on normal scores; marginals preserved)
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Callable, Dict, List, Optional, Sequence, Tuple

import numpy as np
from numpy.random import Generator
from scipy import stats

# Canonical variable IDs used in simulation sampling (before volumetrics).
COMMON_VARIABLES = (
    "area",
    "percent_fill",
    "net_pay",
    "geometric_correction",
    "porosity",
    "saturation",
)

OIL_VARIABLES = (
    "oil_recovery",
    "fvf",
    "gor",
    "solution_gas_recovery",
)

GAS_VARIABLES = (
    "gas_recovery",
    "gef",
    "condensate_yield",
)

# Recommended pairs from MMRA app / technical specifications.
RECOMMENDED_PAIRS: Tuple[Tuple[str, str], ...] = (
    ("area", "net_pay"),
    ("porosity", "saturation"),
    ("porosity", "oil_recovery"),
    ("fvf", "gor"),
)

NRV_RECOMMENDED_PAIRS: Tuple[Tuple[str, str], ...] = (
    ("grv", "net_to_gross"),
    ("porosity", "saturation"),
    ("porosity", "oil_recovery"),
    ("fvf", "gor"),
)

NRV_VOLUMETRIC_GRV = ("grv", "grv_percent_fill", "net_to_gross")
NRV_VOLUMETRIC_PETREL = ("petrel_grv_depth", "petrel_grv_contact", "net_to_gross")
NRV_VOLUMETRIC_DIRECT = ("nrv_direct",)


CORRELATION_MODES = ("independent", "rank", "gaussian_copula")


def normalize_correlation_mode(mode: str) -> str:
    """Map API aliases to canonical correlation_mode values."""
    key = (mode or "independent").lower().strip()
    if key in ("independent", "none", ""):
        return "independent"
    if key in ("rank", "rank_correlation", "spearman", "iman_conover"):
        return "rank"
    if key in ("gaussian_copula", "gaussian", "copula", "normal_copula"):
        return "gaussian_copula"
    return key


@dataclass
class CorrelationPair:
    """Linear correlation coefficient ρ for a pair (interpretation depends on mode)."""

    variable_a: str
    variable_b: str
    rho: float
    enabled: bool = True
    notes: str = ""


@dataclass
class CorrelationMatrix:
    """
    Symmetric correlation matrix R (unit diagonal).

    Off-diagonal ρ defines pair correlations; zeros mean independent.
    Serialized alongside ``correlations`` pairs for matrix-style I/O.
    """

    variables: List[str] = field(default_factory=list)
    values: List[List[float]] = field(default_factory=list)

    def to_dict(self) -> Dict[str, Any]:
        return {"variables": list(self.variables), "values": self.values}

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "CorrelationMatrix":
        return cls(
            variables=list(data.get("variables", [])),
            values=data.get("values", []),
        )


def _hc_variables_for_fluid(
    fluid_type: str,
    *,
    gor_present: bool = True,
    condensate_present: bool = True,
) -> List[str]:
    """HC yield variable IDs (shared by area and NRV estimating methods)."""
    ft = fluid_type.lower()
    if ft == "oil":
        ids = list(OIL_VARIABLES)
        if not gor_present:
            ids = [v for v in ids if v not in ("gor", "solution_gas_recovery")]
        return ids
    if ft in ("gas", "gas_condensate"):
        ids = list(GAS_VARIABLES)
        if not condensate_present:
            ids = [v for v in ids if v != "condensate_yield"]
        return ids
    return list(OIL_VARIABLES)


def correlatable_variables_for_input(
    fluid_type: str,
    *,
    estimating_method: str = "area_net_pay_yield",
    nrv_entry_mode: str = "grv_fill_ntg",
    gor_present: bool = True,
    condensate_present: bool = True,
    oil_recovery_present: bool = True,
) -> List[str]:
    """Variable IDs that may appear in the correlation matrix for a case."""
    method = estimating_method or "area_net_pay_yield"
    if method == "nrv_grv_yield":
        mode = nrv_entry_mode or "grv_fill_ntg"
        if mode == "direct":
            vol = list(NRV_VOLUMETRIC_DIRECT)
        elif mode == "petrel_marginals":
            vol = list(NRV_VOLUMETRIC_PETREL)
        else:
            vol = list(NRV_VOLUMETRIC_GRV)
        hc = _hc_variables_for_fluid(
            fluid_type, gor_present=gor_present, condensate_present=condensate_present
        )
        if fluid_type.lower() == "oil" and not oil_recovery_present:
            hc = [v for v in hc if v != "oil_recovery"]
        return vol + hc
    active = variables_for_fluid(fluid_type)
    if fluid_type.lower() == "oil" and not gor_present:
        active = [v for v in active if v not in ("gor", "solution_gas_recovery")]
    if fluid_type.lower() == "oil" and not oil_recovery_present:
        active = [v for v in active if v != "oil_recovery"]
    if fluid_type.lower() in ("gas", "gas_condensate") and not condensate_present:
        active = [v for v in active if v != "condensate_yield"]
    return active


def recommended_pairs_for_input(
    fluid_type: str,
    *,
    estimating_method: str = "area_net_pay_yield",
) -> Tuple[Tuple[str, str], ...]:
    """Workbook-style recommended ρ pairs for the active estimating method."""
    if (estimating_method or "area_net_pay_yield") == "nrv_grv_yield":
        ft = fluid_type.lower()
        if ft in ("gas", "gas_condensate"):
            return (("grv", "net_to_gross"), ("porosity", "saturation"))
        return NRV_RECOMMENDED_PAIRS
    return RECOMMENDED_PAIRS


def matrix_rho_at(values: Sequence[Sequence[float]], i: int, j: int) -> float:
    if i == j:
        return 1.0
    return float(values[i][j])


def pairs_from_matrix(
    variables: Sequence[str],
    values: Sequence[Sequence[float]],
    *,
    epsilon: float = 1e-9,
) -> List[CorrelationPair]:
    """
    Extract enabled correlation pairs from a symmetric matrix.

    Each non-zero off-diagonal becomes an enabled pair; zeros are omitted.
    """
    k = len(variables)
    if len(values) != k or any(len(row) != k for row in values):
        raise ValueError(
            f"correlation_matrix must be {k}x{k}; got inconsistent dimensions."
        )

    pairs: List[CorrelationPair] = []
    for i in range(k):
        if not np.isclose(values[i][i], 1.0, atol=1e-6):
            raise ValueError(
                f"correlation_matrix diagonal at {variables[i]!r} must be 1.0."
            )
        for j in range(i + 1, k):
            rho = float(values[i][j])
            if abs(rho) <= epsilon:
                continue
            if rho < -1.0 or rho > 1.0:
                raise ValueError(f"Correlation coefficient must be in [-1, 1]; got {rho}.")
            pairs.append(
                CorrelationPair(
                    variable_a=variables[i],
                    variable_b=variables[j],
                    rho=rho,
                    enabled=True,
                )
            )
    return pairs


def filter_pairs_to_variables(
    pairs: Sequence[CorrelationPair],
    variable_ids: Sequence[str],
) -> List[CorrelationPair]:
    """Keep only pairs whose variables are in *variable_ids* (method-aware matrix)."""
    active = set(variable_ids)
    return [
        p
        for p in pairs
        if p.variable_a in active and p.variable_b in active
    ]


def matrix_from_pairs(
    variables: Sequence[str],
    pairs: Sequence[CorrelationPair],
) -> CorrelationMatrix:
    """Build a full matrix view from pair list (disabled / missing pairs → 0)."""
    R = build_correlation_matrix(list(variables), pairs)
    return CorrelationMatrix(
        variables=list(variables),
        values=R.tolist(),
    )


def merge_pairs_with_matrix(
    existing: Sequence[CorrelationPair],
    variables: Sequence[str],
    values: Sequence[Sequence[float]],
    *,
    epsilon: float = 1e-9,
) -> List[CorrelationPair]:
    """
    Apply matrix values to the pair list.

    Matrix wins for cells among ``variables``; other pairs are kept unchanged.
    """
    from_matrix = pairs_from_matrix(variables, values, epsilon=epsilon)
    keyed: Dict[Tuple[str, str], CorrelationPair] = {}
    for p in existing:
        key = tuple(sorted((p.variable_a, p.variable_b)))
        keyed[key] = p

    k = len(variables)
    for i in range(k):
        for j in range(i + 1, k):
            key = tuple(sorted((variables[i], variables[j])))
            rho = float(values[i][j])
            if abs(rho) <= epsilon:
                if key in keyed:
                    old = keyed[key]
                    keyed[key] = CorrelationPair(
                        variable_a=old.variable_a,
                        variable_b=old.variable_b,
                        rho=old.rho,
                        enabled=False,
                        notes=old.notes,
                    )
            else:
                prev = keyed.get(key)
                keyed[key] = CorrelationPair(
                    variable_a=variables[i],
                    variable_b=variables[j],
                    rho=rho,
                    enabled=True,
                    notes=prev.notes if prev else "",
                )

    for p in from_matrix:
        key = tuple(sorted((p.variable_a, p.variable_b)))
        if key not in keyed:
            keyed[key] = p

    return list(keyed.values())


def variables_for_fluid(fluid_type: str, include_optional: bool = True) -> List[str]:
    """Return correlatable variable IDs for a fluid type."""
    ft = fluid_type.lower()
    ids = list(COMMON_VARIABLES)
    if ft == "oil":
        ids.extend(OIL_VARIABLES)
    elif ft in ("gas", "gas_condensate"):
        ids.extend(GAS_VARIABLES)
        if not include_optional and ft == "gas":
            ids = [v for v in ids if v != "condensate_yield"]
    return ids


def build_correlation_matrix(
    variable_ids: Sequence[str],
    pairs: Sequence[CorrelationPair],
) -> np.ndarray:
    """
    Build a symmetric correlation matrix from enabled pairs.

    Unspecified off-diagonal entries are zero (independent).
    """
    k = len(variable_ids)
    index = {vid: i for i, vid in enumerate(variable_ids)}
    R = np.eye(k, dtype=float)

    for pair in pairs:
        if not pair.enabled:
            continue
        if pair.variable_a not in index or pair.variable_b not in index:
            # Stale pairs (e.g. area/net_pay after switching to NRV) are ignored.
            continue
        if pair.variable_a == pair.variable_b:
            raise ValueError("Correlation pair cannot link a variable to itself.")
        i, j = index[pair.variable_a], index[pair.variable_b]
        rho = float(pair.rho)
        if rho < -1.0 or rho > 1.0:
            raise ValueError(f"Correlation coefficient must be in [-1, 1]; got {rho}.")
        R[i, j] = rho
        R[j, i] = rho

    return R


def validate_correlation_matrix(R: np.ndarray) -> None:
    """
    Ensure R is symmetric positive semi-definite (Cholesky factorisable).

    Raises
    ------
    ValueError
        If the matrix is not PSD.
    """
    if R.shape[0] != R.shape[1]:
        raise ValueError("Correlation matrix must be square.")
    if not np.allclose(R, R.T):
        raise ValueError("Correlation matrix must be symmetric.")
    if not np.allclose(np.diag(R), 1.0):
        raise ValueError("Correlation matrix diagonal must be 1.0.")
    try:
        np.linalg.cholesky(R)
    except np.linalg.LinAlgError as exc:
        raise ValueError(
            "Correlation matrix is not positive semi-definite. "
            "Reduce coefficients or remove conflicting pairs."
        ) from exc


def _correlate_samples(
    samples: Dict[str, np.ndarray],
    variable_ids: Sequence[str],
    correlation_matrix: np.ndarray,
    rng: Generator,
    score_fn: Callable[[np.ndarray], np.ndarray],
) -> Dict[str, np.ndarray]:
    """
    Correlate marginals by matching ranks of score_fn(Z_j) to sorted original samples.

    Z is drawn as N(0, R) via Cholesky; score_fn maps each column to a sort key.
    """
    validate_correlation_matrix(correlation_matrix)

    k = len(variable_ids)
    if k < 2:
        return dict(samples)

    n = len(samples[variable_ids[0]])
    for vid in variable_ids:
        if len(samples[vid]) != n:
            raise ValueError(f"Sample length mismatch for variable {vid!r}.")

    X = np.column_stack([samples[vid].astype(float, copy=True) for vid in variable_ids])
    L = np.linalg.cholesky(correlation_matrix)
    Z = rng.standard_normal((n, k)) @ L.T

    out = X.copy()
    for j in range(k):
        scores = score_fn(Z[:, j])
        ranks = np.argsort(np.argsort(scores, kind="mergesort"), kind="mergesort")
        out[:, j] = np.sort(X[:, j])[ranks]

    result = dict(samples)
    for j, vid in enumerate(variable_ids):
        result[vid] = out[:, j]
    return result


def apply_pair_rank_correlation(
    samples: Dict[str, np.ndarray],
    variable_a: str,
    variable_b: str,
    rho: float,
    rng: Generator,
) -> Dict[str, np.ndarray]:
    """
    Iman–Conover rank correlation for a single pair (e.g. GRV vs net-to-gross).

    ``rho`` is clamped to [-1, 1]. No-op when |rho| is negligible or either key is missing.
    """
    rho = float(max(-1.0, min(1.0, rho)))
    if abs(rho) < 1e-12:
        return samples
    if variable_a not in samples or variable_b not in samples:
        return samples
    R = np.array([[1.0, rho], [rho, 1.0]], dtype=float)
    return iman_conover(samples, [variable_a, variable_b], R, rng)


def iman_conover(
    samples: Dict[str, np.ndarray],
    variable_ids: Sequence[str],
    correlation_matrix: np.ndarray,
    rng: Generator,
) -> Dict[str, np.ndarray]:
    """Iman–Conover: Spearman rank correlation (sort keys = correlated normal scores)."""
    return _correlate_samples(
        samples, variable_ids, correlation_matrix, rng, score_fn=lambda z: z
    )


def gaussian_copula(
    samples: Dict[str, np.ndarray],
    variable_ids: Sequence[str],
    correlation_matrix: np.ndarray,
    rng: Generator,
) -> Dict[str, np.ndarray]:
    """
    Gaussian copula: impose Pearson correlation R on normal scores.

    Sort keys are Φ(Z_j); marginals are preserved by rank matching to the
    independent sample order statistics.
    """
    return _correlate_samples(
        samples,
        variable_ids,
        correlation_matrix,
        rng,
        score_fn=lambda z: stats.norm.cdf(z),
    )


def spearman_rho(x: np.ndarray, y: np.ndarray) -> float:
    """Sample Spearman correlation (for tests)."""
    rx = np.argsort(np.argsort(x, kind="mergesort"), kind="mergesort").astype(float)
    ry = np.argsort(np.argsort(y, kind="mergesort"), kind="mergesort").astype(float)
    return float(np.corrcoef(rx, ry)[0, 1])


def pearson_rho(x: np.ndarray, y: np.ndarray) -> float:
    """Sample Pearson correlation (for tests)."""
    return float(np.corrcoef(x.astype(float), y.astype(float))[0, 1])


def normal_scores(x: np.ndarray) -> np.ndarray:
    """Empirical normal scores Φ^{-1}((rank - 0.5) / n)."""
    n = len(x)
    ranks = np.argsort(np.argsort(x, kind="mergesort"), kind="mergesort").astype(float) + 0.5
    u = ranks / n
    return stats.norm.ppf(u)


def apply_input_correlations(
    samples: Dict[str, np.ndarray],
    fluid_type: str,
    correlation_mode: str,
    pairs: Sequence[CorrelationPair],
    rng: Generator,
    gor_present: bool = True,
    condensate_present: bool = True,
    estimating_method: str = "area_net_pay_yield",
    nrv_entry_mode: str = "grv_fill_ntg",
    oil_recovery_present: bool = True,
) -> Tuple[Dict[str, np.ndarray], str]:
    """
    Apply partial correlation if enabled; return updated samples and mode label.
    """
    mode = normalize_correlation_mode(correlation_mode)
    if mode not in CORRELATION_MODES:
        raise ValueError(
            f"Unknown correlation_mode {correlation_mode!r}. "
            "Use 'independent', 'rank', or 'gaussian_copula'."
        )

    if mode == "independent":
        return samples, "independent"

    enabled_pairs = [p for p in pairs if p.enabled]
    if not enabled_pairs:
        return samples, "independent"

    active = correlatable_variables_for_input(
        fluid_type,
        estimating_method=estimating_method,
        nrv_entry_mode=nrv_entry_mode,
        gor_present=gor_present,
        condensate_present=condensate_present,
        oil_recovery_present=oil_recovery_present,
    )

    used_in_pairs = set()
    for p in enabled_pairs:
        used_in_pairs.add(p.variable_a)
        used_in_pairs.add(p.variable_b)

    correlate_ids = [v for v in active if v in samples and v in used_in_pairs]
    if len(correlate_ids) < 2:
        return samples, "independent"

    R = build_correlation_matrix(correlate_ids, enabled_pairs)
    if mode == "rank":
        updated = iman_conover(samples, correlate_ids, R, rng)
        label = f"rank (Iman–Conover, {len(enabled_pairs)} pair(s))"
    else:
        updated = gaussian_copula(samples, correlate_ids, R, rng)
        label = f"gaussian_copula ({len(enabled_pairs)} pair(s))"
    return updated, label

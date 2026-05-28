"""
volumetrics.py – Deterministic volumetric formula functions.

All functions accept scalar float or numpy array arguments.
All inputs must already be in canonical units:
    area          → acres
    net_pay_ft    → feet
    porosity      → fraction (0–1)
    saturation    → fraction (0–1)
    recovery_eff  → fraction (0–1)
    bo            → rb/stb
    gor           → scf/stb
    gef           → scf/reservoir ft³
    condensate_yield → bbl/MMscf
    gas_oil_ratio → mcf/bbl (default 6)

Oil volumetric chain:
    PA = A × PF
    NRV = PA × NP × GCF
    HCPV = NRV × φ × Shc
    STOIIP [MMbbl] = HCPV [acre-ft] × 7758.36735 / Bo / 1e6
    RecOil [MMbbl] = STOIIP × RE_oil
    SolGas [Bcf]  = RecOil [MMbbl] × GOR [scf/stb] / 1000

Gas volumetric chain:
    GIIP [Bcf] = HCPV [acre-ft] × 43560 × GEF / 1e9
    RecGas [Bcf] = GIIP × RE_gas
    Condensate [MMbbl] = RecGas [Bcf] × CY [bbl/MMscf] / 1000

Total MMBOE:
    MMBOE = Liquids [MMbbl] + Gas [Bcf] / GORatio
"""

from __future__ import annotations

from typing import Union

import numpy as np

from .constants import BBL_PER_ACFT, ACFT_TO_RESERVOIR_FT3, DEFAULT_GAS_OIL_RATIO

# Type alias for scalar or vector inputs
Numeric = Union[float, np.ndarray]


# ---------------------------------------------------------------------------
# Area / NRV / HCPV
# ---------------------------------------------------------------------------

def calculate_productive_area(area_acres: Numeric, percent_fill: Numeric) -> Numeric:
    """
    Productive Area = Closed Area × Percent Fill

    Parameters
    ----------
    area_acres : float or ndarray
        Closed area in acres.
    percent_fill : float or ndarray
        Percent fill as a fraction (e.g. 1.0 for 100%, 0.75 for 75%).

    Returns
    -------
    Productive area in acres.
    """
    return area_acres * percent_fill


def calculate_nrv_from_grv(
    grv_acft: Numeric,
    percent_fill: Numeric,
    net_to_gross: Numeric,
) -> Numeric:
    """
    Net Rock Volume from gross rock volume route (acre-ft).

    NRV = GRV × percent trap fill × net-to-gross ratio (all fractions 0–1 for fill and N/G).
    """
    return grv_acft * percent_fill * net_to_gross


def calculate_nrv(
    productive_area_acres: Numeric,
    net_pay_ft: Numeric,
    geometric_correction: Numeric = 1.0,
) -> Numeric:
    """
    Net Rock Volume (acre-ft) = PA × NP × GCF

    Parameters
    ----------
    productive_area_acres : float or ndarray
        Productive area in acres.
    net_pay_ft : float or ndarray
        Average net pay in feet.
    geometric_correction : float or ndarray
        Geometric correction factor as a fraction (default 1.0 = 100%).

    Returns
    -------
    NRV in acre-ft.
    """
    return productive_area_acres * net_pay_ft * geometric_correction


def calculate_hcpv(
    nrv_acft: Numeric,
    porosity: Numeric,
    saturation: Numeric,
) -> Numeric:
    """
    Hydrocarbon Pore Volume (acre-ft) = NRV × φ × Shc

    Parameters
    ----------
    nrv_acft : float or ndarray
        Net Rock Volume in acre-ft.
    porosity : float or ndarray
        Porosity as a fraction (0–1).
    saturation : float or ndarray
        Hydrocarbon saturation as a fraction (0–1).

    Returns
    -------
    HCPV in acre-ft.
    """
    return nrv_acft * porosity * saturation


# ---------------------------------------------------------------------------
# Oil calculations
# ---------------------------------------------------------------------------

def calculate_stoiip(hcpv_acft: Numeric, bo: Numeric) -> Numeric:
    """
    Stock-Tank Oil Initially In Place (MMbbl).

    STOIIP [bbl] = HCPV [acre-ft] × 7758.36735 / Bo
    STOIIP [MMbbl] = STOIIP [bbl] / 1,000,000

    Parameters
    ----------
    hcpv_acft : float or ndarray
        Hydrocarbon pore volume in acre-ft.
    bo : float or ndarray
        Oil formation volume factor in rb/stb.

    Returns
    -------
    STOIIP in MMbbl.
    """
    stoiip_bbl = hcpv_acft * BBL_PER_ACFT / bo
    return stoiip_bbl * 1.0e-6   # convert to MMbbl


def calculate_recoverable_oil(
    stoiip_mmbbl: Numeric, recovery_efficiency: Numeric
) -> Numeric:
    """
    Recoverable Oil (MMbbl) = STOIIP [MMbbl] × RE_oil

    Parameters
    ----------
    stoiip_mmbbl : float or ndarray
    recovery_efficiency : float or ndarray
        Oil recovery efficiency as a fraction (0–1).

    Returns
    -------
    Recoverable oil in MMbbl.
    """
    return stoiip_mmbbl * recovery_efficiency


def calculate_solution_gas(
    recoverable_oil_mmbbl: Numeric,
    gor: Numeric,
    solution_gas_recovery: Numeric = 1.0,
) -> Numeric:
    """
    Solution Gas (Bcf).

    Derivation:
        1 MMbbl = 1e6 stb
        scf = MMbbl × 1e6 × GOR
        Bcf = scf / 1e9
        ∴ Bcf = MMbbl × GOR / 1000

    Parameters
    ----------
    recoverable_oil_mmbbl : float or ndarray
        Recoverable oil in MMbbl.
    gor : float or ndarray
        Solution gas yield (GOR) in scf/stb.
    solution_gas_recovery : float or ndarray
        Solution gas recovery efficiency as a fraction (default 1.0 = 100%).

    Returns
    -------
    Solution gas in Bcf.
    """
    return recoverable_oil_mmbbl * gor * solution_gas_recovery / 1000.0


# ---------------------------------------------------------------------------
# Gas calculations
# ---------------------------------------------------------------------------

def calculate_giip(hcpv_acft: Numeric, gas_expansion_factor: Numeric) -> Numeric:
    """
    Gas Initially In Place (Bcf).

    GIIP [scf] = HCPV [acre-ft] × 43,560 [ft³/acre-ft] × GEF [scf/reservoir ft³]
    GIIP [Bcf] = GIIP [scf] / 1e9

    Parameters
    ----------
    hcpv_acft : float or ndarray
        Hydrocarbon pore volume in acre-ft.
    gas_expansion_factor : float or ndarray
        Gas expansion factor in scf/reservoir ft³.

    Returns
    -------
    GIIP in Bcf.
    """
    giip_scf = hcpv_acft * ACFT_TO_RESERVOIR_FT3 * gas_expansion_factor
    return giip_scf * 1.0e-9   # convert to Bcf


def calculate_recoverable_gas(giip_bcf: Numeric, gas_recovery_efficiency: Numeric) -> Numeric:
    """
    Recoverable Gas (Bcf) = GIIP [Bcf] × RE_gas

    Parameters
    ----------
    giip_bcf : float or ndarray
    gas_recovery_efficiency : float or ndarray
        Gas recovery efficiency as a fraction (0–1).

    Returns
    -------
    Recoverable gas in Bcf.
    """
    return giip_bcf * gas_recovery_efficiency


def calculate_condensate(
    recoverable_gas_bcf: Numeric,
    condensate_yield: Numeric,
) -> Numeric:
    """
    Condensate (MMbbl).

    Derivation:
        1 Bcf = 1,000 MMscf
        bbl condensate = Bcf × 1,000 × CY [bbl/MMscf]
        MMbbl = bbl / 1e6
        ∴ MMbbl = Bcf × CY / 1000

    Parameters
    ----------
    recoverable_gas_bcf : float or ndarray
        Recoverable gas in Bcf.
    condensate_yield : float or ndarray
        Condensate yield in bbl/MMscf.

    Returns
    -------
    Condensate in MMbbl.
    """
    return recoverable_gas_bcf * condensate_yield / 1000.0


# ---------------------------------------------------------------------------
# MMBOE
# ---------------------------------------------------------------------------

def calculate_mmboe(
    liquids_mmbbl: Numeric,
    gas_bcf: Numeric,
    gas_oil_ratio: float = DEFAULT_GAS_OIL_RATIO,
) -> Numeric:
    """
    Total resource in MMBOE.

    MMBOE = Liquids [MMbbl] + Gas [Bcf] / GORatio

    Parameters
    ----------
    liquids_mmbbl : float or ndarray
        Total liquids (oil + condensate) in MMbbl.
    gas_bcf : float or ndarray
        Total gas (recoverable gas + solution gas) in Bcf.
    gas_oil_ratio : float
        Gas-oil conversion ratio in mcf/bbl (default 6).

    Returns
    -------
    Total resource in MMBOE.
    """
    return liquids_mmbbl + gas_bcf / gas_oil_ratio

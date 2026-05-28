"""
Build CCOP-aligned prospect risk workbook (.xls).

Run from project root:
    python docs/templates/build_ccop_risk_template.py

Output:
    docs/templates/risk_template_CCOP.xls
"""

from __future__ import annotations

import os
from typing import List, Tuple

import xlwt
from xlwt import Workbook

OUT_PATH = os.path.join(os.path.dirname(__file__), "risk_template_CCOP.xls")

# Descriptor table rows: (P, range, label) – CCOP Fig. 3.7
DESC_ROWS: List[Tuple[float, str, str]] = [
    (1.0, "0.95–1.00", "Virtually to absolutely certain (excellent data)"),
    (0.8, "0.65–0.95", "Most probable (good data, likely interpretation)"),
    (0.6, "0.40–0.65", "Probable (fair data control)"),
    (0.3, "0.05–0.35", "Possible (poor–fair data)"),
    (0.1, "0.00–0.05", "Unlikely (unfavourable models likely)"),
    (0.0, "0.00", "Virtually to absolutely impossible"),
]


def _style_header():
    s = xlwt.easyxf("font: bold on; align: wrap on, vert centre;")
    return s


def _style_title():
    return xlwt.easyxf("font: bold on, height 280;")


def write_descriptor_block(
    ws,
    start_row: int,
    col_prob: int,
    col_range: int,
    col_label: int,
    question: str,
) -> int:
    """Write CCOP lookup table; return first data row index."""
    ws.write(start_row, col_prob, "Probability", _style_header())
    ws.write(start_row, col_range, "Range", _style_header())
    ws.write(start_row, col_label, question, _style_header())
    r = start_row + 1
    for p, rng, label in DESC_ROWS:
        ws.write(r, col_prob, p)
        ws.write(r, col_range, rng)
        ws.write(r, col_label, label)
        r += 1
    return start_row + 1


def write_selection_row(
    ws,
    row: int,
    label: str,
    value_col: int,
    default_p: float | str = 0.8,
):
    ws.write(row, 0, label, _style_header())
    if default_p != "":
        ws.write(row, value_col, default_p)
    ws.write(row, value_col + 1, "(pick P from table above or type value 0–1)")


def build_lookup_sheet(wb: Workbook):
    ws = wb.add_sheet("CCOP Lookup")
    ws.write(0, 0, "CCOP Fig. 3.7 – General probability scale", _style_title())
    ws.write(1, 0, "Use P column values in factor sheets, or type custom 0–1.")
    write_descriptor_block(
        ws,
        3,
        0,
        1,
        2,
        "Descriptor (proven geological model)",
    )
    ws.write(12, 0, "Combination (OR) for multiple sources:", _style_header())
    ws.write(13, 0, "P_combined = 1 - (1-P_A)*(1-P_B)*...")
    ws.write(14, 0, "Example: P_A=0.6, P_B=0.3 -> P=0.72", _style_header())


def build_factor_sheet(
    wb: Workbook,
    name: str,
    factor_title: str,
    question: str,
    selection_label: str,
    default_p: float,
):
    ws = wb.add_sheet(name)
    ws.write(0, 0, "COUNTRY", _style_header())
    ws.write(0, 1, "Malaysia")
    ws.write(0, 2, "PROSPECT", _style_header())
    ws.write(0, 3, "")
    ws.write(1, 0, "LICENSE", _style_header())
    ws.write(1, 1, "")
    ws.write(1, 2, "Reservoir Level", _style_header())
    ws.write(1, 3, "")
    ws.write(3, 1, factor_title, _style_title())
    data_start = write_descriptor_block(ws, 5, 1, 2, 3, question)
    sel_row = data_start + len(DESC_ROWS) + 2
    write_selection_row(ws, sel_row, selection_label, 1, default_p)
    ws.write(sel_row + 2, 0, "Comments")
    return ws, sel_row


def build_source_sheet(wb: Workbook):
    ws, sel = build_factor_sheet(
        wb,
        "Source A",
        "SOURCE ROCK A",
        "Probability of mature adequate source (CCOP P3a)",
        "P_source_A",
        1.0,
    )
    ws2 = wb.add_sheet("Source B")
    ws2.write(0, 0, "Optional second source (CCOP combination OR)", _style_title())
    data_start = write_descriptor_block(
        ws2,
        3,
        1,
        2,
        3,
        "Probability of mature adequate source B (leave blank if N/A)",
    )
    sel_b = data_start + len(DESC_ROWS) + 2
    write_selection_row(ws2, sel_b, "P_source_B (optional)", 1, "")
    ws2.write(sel_b + 1, 1, "")
    ws2.write(sel_b + 3, 0, "P_source_combined (OR)")
    ws2.write(
        sel_b + 3,
        1,
        xlwt.Formula(f"IF(B{sel_b+1}=\"\",B{sel+1},1-(1-B{sel+1})*(1-B{sel_b+1}))"),
    )
    return sel, sel_b


def build_charge_sheet(wb: Workbook, p_source_formula: str):
    ws = wb.add_sheet("Migration")
    ws.write(3, 1, "MIGRATION & TIMING (CCOP P3b)", _style_title())
    data_start = write_descriptor_block(
        ws,
        5,
        1,
        2,
        3,
        "Probability of timely effective migration",
    )
    sel = data_start + len(DESC_ROWS) + 2
    write_selection_row(ws, sel, "P_migration", 1, 1.0)
    ws.write(sel + 3, 0, "P_charge", _style_header())
    ws.write(sel + 3, 1, xlwt.Formula(f"{p_source_formula}*B{sel+1}"))
    return sel


def build_trap_sheet(wb: Workbook):
    ws = wb.add_sheet("Trap")
    ws.write(3, 1, "TRAP (CCOP P2 = structure × seal)", _style_title())
    ws.write(4, 1, "P2a structure × P2b seal (seal = min top, lateral)")
    data_start = write_descriptor_block(
        ws,
        6,
        1,
        2,
        3,
        "Probability of valid mapped closure (minimum volume)",
    )
    sel_s = data_start + len(DESC_ROWS) + 2
    write_selection_row(ws, sel_s, "P_structure", 1, 1.0)
    data2 = write_descriptor_block(
        ws,
        sel_s + 4,
        1,
        2,
        3,
        "Top seal effectiveness",
    )
    sel_top = data2 + len(DESC_ROWS) + 2
    write_selection_row(ws, sel_top, "P_top_seal", 1, 1.0)
    data3 = write_descriptor_block(
        ws,
        sel_top + 4,
        1,
        2,
        3,
        "Lateral (fault) seal – use only if fault is trap element",
    )
    sel_lat = data3 + len(DESC_ROWS) + 2
    write_selection_row(ws, sel_lat, "P_lateral_seal (optional)", 1, 0.3)
    ws.write(sel_lat + 3, 0, "P_seal (weak-link)", _style_header())
    ws.write(
        sel_lat + 3,
        1,
        xlwt.Formula(f"MIN(B{sel_top+1},IF(B{sel_lat+1}=\"\",B{sel_top+1},B{sel_lat+1}))"),
    )
    ws.write(sel_lat + 4, 0, "P_trap", _style_header())
    ws.write(sel_lat + 4, 1, xlwt.Formula(f"B{sel_s+1}*B{sel_lat+4}"))
    return sel_s, sel_lat + 4


def build_reservoir_sheet(wb: Workbook):
    ws = wb.add_sheet("Reservoir")
    ws.write(3, 1, "RESERVOIR (CCOP P1 = facies × effectiveness)", _style_title())
    d1 = write_descriptor_block(
        ws,
        5,
        1,
        2,
        3,
        "P1a – Probability of reservoir facies (min thickness / N/G)",
    )
    sel_a = d1 + len(DESC_ROWS) + 2
    write_selection_row(ws, sel_a, "P_facies", 1, 0.8)
    d2 = write_descriptor_block(
        ws,
        sel_a + 4,
        1,
        2,
        3,
        "P1b – Effectiveness (porosity, perm, saturation)",
    )
    sel_b = d2 + len(DESC_ROWS) + 2
    write_selection_row(ws, sel_b, "P_effectiveness", 1, 1.0)
    ws.write(sel_b + 3, 0, "P_reservoir", _style_header())
    ws.write(sel_b + 3, 1, xlwt.Formula(f"B{sel_a+1}*B{sel_b+1}"))
    return sel_b + 3


def build_retention_sheet(wb: Workbook):
    ws = wb.add_sheet("Retention")
    ws.write(3, 1, "RETENTION (CCOP P4)", _style_title())
    d = write_descriptor_block(
        ws,
        5,
        1,
        2,
        3,
        "Probability of hydrocarbon retention after accumulation",
    )
    sel = d + len(DESC_ROWS) + 2
    write_selection_row(ws, sel, "P_retention", 1, 1.0)
    return sel


def build_summary(
    wb: Workbook,
    ref_reservoir: str,
    ref_trap: str,
    ref_charge: str,
    ref_retention: str,
):
    ws = wb.add_sheet("Risk Summary")
    ws.write(0, 0, "CCOP probability of discovery", _style_title())
    ws.write(2, 0, "Factor", _style_header())
    ws.write(2, 1, "Symbol", _style_header())
    ws.write(2, 2, "P", _style_header())
    ws.write(2, 3, "Formula")
    rows = [
        ("Reservoir", "P1", ref_reservoir, "P_facies × P_effectiveness"),
        ("Trap", "P2", ref_trap, "P_structure × P_seal"),
        ("Charge", "P3", ref_charge, "P_source_OR × P_migration"),
        ("Retention", "P4", ref_retention, "P_retention"),
    ]
    r = 3
    for label, sym, ref, note in rows:
        ws.write(r, 0, label)
        ws.write(r, 1, sym)
        ws.write(r, 2, xlwt.Formula(ref))
        ws.write(r, 3, note)
        r += 1
    ws.write(r + 1, 0, "Pg (COSg)", _style_header())
    ws.write(
        r + 1,
        2,
        xlwt.Formula(f"C4*C5*C6*C7"),
    )
    ws.write(r + 2, 0, "1 in")
    ws.write(r + 2, 2, xlwt.Formula(f"IF(C{r+2}=0,\"\",1/C{r+2})"))


def build_start_here(wb: Workbook):
    ws = wb.add_sheet("Start Here")
    ws.write(0, 0, "MMRA – CCOP Risk Template", _style_title())
    lines = [
        "Based on CCOP Guidelines for Risk Assessment of Petroleum Prospects (2000).",
        "",
        "Pg = P_reservoir × P_trap × P_charge × P_retention",
        "",
        "Sheets:",
        "  CCOP Lookup – descriptor scale (Fig. 3.7)",
        "  Source A / Source B – mature source; OR combination if two kitchens",
        "  Migration – charge timing / pathway",
        "  Trap – structure × seal (weak-link top / lateral)",
        "  Reservoir – facies × effectiveness",
        "  Retention – post-accumulation preservation",
        "  Risk Summary – Pg and 1-in-N",
        "",
        "Enter P values in column B on each sheet (use lookup table or custom).",
    ]
    for i, line in enumerate(lines):
        ws.write(2 + i, 0, line)


def main():
    wb = Workbook()
    build_start_here(wb)
    build_lookup_sheet(wb)
    sel_a, sel_b = build_source_sheet(wb)
    # Source combined on Source B sheet row sel_b+4 col B (1-based row in formula)
    p_src = f"'Source B'!B{sel_b + 4}"
    mig_sel = build_charge_sheet(wb, p_src)
    p_charge = f"Migration!B{mig_sel + 4}"
    _, p_trap = build_trap_sheet(wb)
    p_res = build_reservoir_sheet(wb)
    ret_sel = build_retention_sheet(wb)
    build_summary(
        wb,
        f"Reservoir!B{p_res + 1}",
        f"Trap!B{p_trap + 1}",
        p_charge,
        f"Retention!B{ret_sel + 1}",
    )
    wb.save(OUT_PATH)
    print(f"Wrote {OUT_PATH}")


if __name__ == "__main__":
    main()

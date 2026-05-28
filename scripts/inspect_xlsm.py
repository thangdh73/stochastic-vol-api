"""Inspect MMRA.xlsm sheets and chart references."""
import re
import sys
import zipfile
from pathlib import Path

path = Path(sys.argv[1] if len(sys.argv) > 1 else r"d:\3-tmp\MMRA.xlsm")
with zipfile.ZipFile(path) as z:
    names = z.namelist()
    print("file:", path)
    print("entries:", len(names))
    if "xl/workbook.xml" in names:
        wb = z.read("xl/workbook.xml").decode("utf-8", errors="ignore")
        sheets = re.findall(r'name="([^"]+)"', wb)
        # filter sheet names from sheet elements
        sheet_names = re.findall(r"<sheet[^>]+name=\"([^\"]+)\"", wb)
        print("SHEETS:", sheet_names)
    chart_files = [n for n in names if "chart" in n.lower()]
    print("chart xml files:", len(chart_files))
    drawing = [n for n in names if "drawing" in n.lower()]
    print("drawing files:", len(drawing))
    for n in sorted(chart_files)[:40]:
        print(" ", n)
    # scan worksheet xml for chart refs
    for n in names:
        if n.startswith("xl/worksheets/sheet") and n.endswith(".xml"):
            data = z.read(n).decode("utf-8", errors="ignore")
            if "chart" in data.lower() or "drawing" in data.lower():
                print("worksheet with drawing/chart:", n)

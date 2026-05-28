"""Parse chart titles/types from MMRA.xlsm."""
import re
import sys
import zipfile
from pathlib import Path

path = Path(sys.argv[1] if len(sys.argv) > 1 else r"d:\3-tmp\MMRA.xlsm")
with zipfile.ZipFile(path) as z:
    # sheet index -> name
    wb = z.read("xl/workbook.xml").decode("utf-8", errors="ignore")
    sheets = re.findall(r"<sheet[^>]+name=\"([^\"]+)\"", wb)
    sheet_ids = re.findall(r"<sheet[^>]+sheetId=\"(\d+)\"[^>]+name=\"([^\"]+)\"", wb)
    print("SHEETS:")
    for sid, name in sheet_ids:
        print(f"  {sid}: {name.replace('&amp;', '&')}")

    print("\nCHARTS:")
    chart_files = sorted(n for n in z.namelist() if re.match(r"xl/charts/chart\d+\.xml$", n))
    for cf in chart_files:
        data = z.read(cf).decode("utf-8", errors="ignore")
        title = ""
        m = re.search(r"<c:title>.*?<t>([^<]*)</t>", data, re.DOTALL)
        if m:
            title = m.group(1).strip()
        if not title:
            m = re.search(r"<c:v>([^<]+)</c:v>", data)
            if m and len(m.group(1)) < 80:
                title = m.group(1)
        chart_type = "unknown"
        if "barChart" in data:
            chart_type = "bar"
        elif "lineChart" in data:
            chart_type = "line"
        elif "scatterChart" in data:
            chart_type = "scatter"
        elif "areaChart" in data:
            chart_type = "area"
        elif "pieChart" in data:
            chart_type = "pie"
        # parent sheet via rels if possible
        rel = cf.replace("charts/chart", "charts/_rels/chart").replace(".xml", ".xml.rels")
        parent_hint = ""
        if rel in z.namelist():
            rel_data = z.read(rel).decode("utf-8", errors="ignore")
            parent_hint = rel_data[:200]
        print(f"  {Path(cf).name}: type={chart_type} title={title!r}")

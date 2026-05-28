import argparse
import re
from pathlib import Path

import fitz  # PyMuPDF
import easyocr


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--start", type=int, default=1, help="1-based start page")
    parser.add_argument("--end", type=int, default=20, help="1-based end page (inclusive)")
    args = parser.parse_args()

    pdf_path = Path(
        r"c:\Users\thang\OneDrive\Documents\1-Books\2_Books\8-Risk&Uncertainty\2-Risk&Uncertainty\GeoX_Advance_Resize_SmallSize.pdf"
    )
    out_path = Path(r"C:\Users\thang\AppData\Local\Temp\geox_ocr_extract.txt")

    keywords = [
        "stack",
        "stacked",
        "multi",
        "multiple",
        "zone",
        "zones",
        "layer",
        "depend",
        "dependency",
        "correlation",
        "correlated",
        "copula",
        "sum",
        "aggregation",
        "aggregate",
        "portfolio",
        "risked",
        "pg",
    ]
    kw_re = re.compile(
        r"\b(" + "|".join(map(re.escape, keywords)) + r")\b", re.IGNORECASE
    )

    start_pno = max(args.start - 1, 0)
    end_pno = max(args.end - 1, start_pno)
    pages = list(range(start_pno, end_pno + 1))

    # `verbose=False` avoids printing a unicode progress bar on Windows cp1252 consoles.
    reader = easyocr.Reader(["en"], gpu=False, verbose=False)

    doc = fitz.open(pdf_path)
    hits: list[int] = []

    out_path.parent.mkdir(parents=True, exist_ok=True)
    with out_path.open("w", encoding="utf-8") as f:
        f.write(f"PDF: {pdf_path}\nPages: {doc.page_count}\n\n")

        for pno in pages:
            if pno >= doc.page_count:
                break

            page = doc.load_page(pno)
            # Scale 2x for OCR readability without being too slow.
            pix = page.get_pixmap(matrix=fitz.Matrix(2, 2), alpha=False)
            tmp_img = out_path.parent / f"_geox_page_{pno + 1}.png"
            tmp_img.write_bytes(pix.tobytes("png"))

            try:
                results = reader.readtext(str(tmp_img), detail=0, paragraph=True)
            finally:
                tmp_img.unlink(missing_ok=True)

            text = "\n".join(results).strip()
            if not text:
                continue

            if kw_re.search(text):
                hits.append(pno)
                f.write(f"--- Page {pno + 1} ---\n{text}\n\n")

    print(f"Wrote OCR keyword hits for {len(hits)} pages to: {out_path}")
    print("Hit pages (1-based):", [p + 1 for p in hits])


if __name__ == "__main__":
    main()


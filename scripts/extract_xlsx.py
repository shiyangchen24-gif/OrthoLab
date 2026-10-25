"""Extract the OrthoLab source workbook into a clean JSON file.

Usage: python3 -I scripts/extract_xlsx.py <input.xlsx> <output.json>

- Reads all 10 worksheets.
- Drops trailing empty rows / columns and blank header columns.
- Keeps original IDs and text verbatim (only trims surrounding whitespace).
- Converts age / weight / BCS / score columns to numbers; blank scores stay null.
- Parses tolerance strings into numeric thresholds while keeping raw text.
"""
import json
import re
import sys
import datetime

import openpyxl

SHEETS = [
    ("diseases", "疾病庫"),
    ("cases", "病例庫"),
    ("clues", "檢查線索庫"),
    ("treatments", "處置判定表"),
    ("steps", "術式與步驟表"),
    ("resources", "術後與資源表"),
    ("modules", "術式模組"),
    ("references", "參考資料"),
    ("tolerances", "骨折微調與數值容差表"),
    ("artStyles", "美術風格與圖片規範表"),
]

NUMERIC_COLUMNS = {
    "cases": ["月齡", "體重kg", "BCS_9分"],
    "treatments": ["處置分_提案"],
}


def clean(value):
    if value is None:
        return None
    if isinstance(value, datetime.datetime):
        return value.date().isoformat()
    if isinstance(value, str):
        v = value.strip()
        return v if v != "" else None
    return value


def to_number(value):
    if value is None:
        return None
    if isinstance(value, (int, float)):
        return float(value)
    m = re.search(r"-?\d+(?:\.\d+)?", str(value))
    return float(m.group(0)) if m else None


def read_sheet(ws):
    rows = [[clean(c) for c in r] for r in ws.iter_rows(values_only=True)]
    rows = [r for r in rows if any(c is not None for c in r)]
    if not rows:
        return []
    header = rows[0]
    keep = [i for i, h in enumerate(header) if h is not None]
    out = []
    for r in rows[1:]:
        rec = {header[i]: (r[i] if i < len(r) else None) for i in keep}
        if all(v is None for v in rec.values()):
            continue
        out.append(rec)
    return out


def parse_tolerance(rec):
    """Turn the free-text tolerance cells into numbers (raw text retained)."""
    nums = lambda s: [float(x) for x in re.findall(r"\d+(?:\.\d+)?", s or "")]
    parsed = {
        "ideal": nums(rec.get("臨床理想標準")),
        "pass": nums(rec.get("及格合格容差 (Pass)")),
        "perfect": nums(rec.get("完美評價容差 (Perfect)")),
        "fail": nums(rec.get("失敗/扣分條件 (Fail)")),
        "points": nums(rec.get("評分配分")),
    }
    return parsed


def main(src, dst):
    wb = openpyxl.load_workbook(src, data_only=True)
    names = [ws.title for ws in wb.worksheets]
    data = {"_meta": {"sourceFile": src.split("/")[-1], "sheetNames": names}}
    for key, title in SHEETS:
        if title not in names:
            raise SystemExit(f"missing sheet: {title}")
        recs = read_sheet(wb[title])
        for rec in recs:
            for col in NUMERIC_COLUMNS.get(key, []):
                rec[col] = to_number(rec.get(col))
            if key == "tolerances":
                rec["_parsed"] = parse_tolerance(rec)
        data[key] = recs
    with open(dst, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=1)
    print({k: len(v) for k, v in data.items() if k != "_meta"})


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2])

#!/usr/bin/env python3
"""Validate hand-painted PNG layers before they are committed.

    python3 -I scripts/check_patient_assets.py

Checks every expected file (mirrors src/components/patientAssets.ts and
src/scenes/sceneAssets.ts; a unit test keeps the lists in sync):
  * present, PNG, RGBA with a real alpha channel (scene background may be opaque)
  * canvas size matches the manifest; all poses of a character share one canvas
  * transparent border (no cropped background rectangle)
  * no light halo: semi-transparent edge pixels must not be near-white
  * paw baseline: the lowest opaque row of every pose sits at the manifest
    baseline (±12 px) and the poses agree with each other (±4 px)
Exit code 1 when anything is missing or wrong.
"""
from __future__ import annotations

import sys
from pathlib import Path

try:
    from PIL import Image
except ImportError:  # pragma: no cover
    sys.exit("Pillow is required: pip install pillow")

ROOT = Path(__file__).resolve().parent.parent

CHARACTERS = {
    "maltese": {"canvas": (1020, 1140), "baseline_y": 1002, "poses": ["sit.png", "lift-LF.png", "withdraw-LF.png"]},
}
SCENE = {
    "clinic-room.png": {"canvas": (1536, 864), "opaque": True},
    "owner.png": {"canvas": (660, 1260), "opaque": False},
    "vet.png": {"canvas": (660, 1260), "opaque": False},
    "exam-table.png": {"canvas": (1920, 690), "opaque": False},
}


def alpha_checks(img: Image.Image, name: str) -> list[str]:
    errs: list[str] = []
    if img.mode != "RGBA":
        return [f"{name}: not RGBA (mode {img.mode}); needs a real transparent background"]
    w, h = img.size
    a = img.getchannel("A")
    border = [a.getpixel((x, 0)) for x in range(w)] + [a.getpixel((x, h - 1)) for x in range(w)]
    border += [a.getpixel((0, y)) for y in range(h)] + [a.getpixel((w - 1, y)) for y in range(h)]
    if max(border) > 8:
        errs.append(f"{name}: border is not transparent (cropped background rectangle?)")
    px = img.load()
    edge = halo = 0
    for y in range(0, h, 2):
        for x in range(0, w, 2):
            r, g, b, al = px[x, y]
            if 20 < al < 200:
                edge += 1
                if min(r, g, b) > 238:
                    halo += 1
    if edge and halo / edge > 0.35:
        errs.append(f"{name}: {halo}/{edge} soft-edge pixels are near-white (white halo from background removal)")
    return errs


def lowest_opaque_row(img: Image.Image) -> int | None:
    bbox = img.getchannel("A").point(lambda v: 255 if v > 128 else 0).getbbox()
    return None if bbox is None else bbox[3] - 1


def main() -> int:
    errs: list[str] = []
    for cid, spec in CHARACTERS.items():
        base = ROOT / "src/assets/patients" / cid
        rows: dict[str, int] = {}
        for f in spec["poses"]:
            p = base / f
            name = f"patients/{cid}/{f}"
            if not p.exists():
                errs.append(f"{name}: missing")
                continue
            img = Image.open(p)
            if img.size != spec["canvas"]:
                errs.append(f"{name}: canvas {img.size}, expected {spec['canvas']}")
            img = img.convert("RGBA") if img.mode == "LA" else img
            errs += alpha_checks(img, name)
            row = lowest_opaque_row(img) if img.mode == "RGBA" else None
            if row is not None:
                rows[f] = row
                if abs(row - spec["baseline_y"]) > 12:
                    errs.append(f"{name}: paw baseline at y={row}, expected {spec['baseline_y']} ±12")
        if len(rows) > 1 and max(rows.values()) - min(rows.values()) > 4:
            errs.append(f"patients/{cid}: poses disagree on the paw baseline {rows} (pose swap would jump)")
    for f, spec in SCENE.items():
        p = ROOT / "src/assets/scene" / f
        name = f"scene/{f}"
        if not p.exists():
            errs.append(f"{name}: missing")
            continue
        img = Image.open(p)
        if img.size != spec["canvas"]:
            errs.append(f"{name}: canvas {img.size}, expected {spec['canvas']}")
        if not spec["opaque"]:
            errs += alpha_checks(img, name)
    for e in errs:
        print("✗", e)
    if not errs:
        print("✓ all patient and scene layers present and valid")
    return 1 if errs else 0


if __name__ == "__main__":
    sys.exit(main())

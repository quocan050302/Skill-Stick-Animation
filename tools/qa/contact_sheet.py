"""Contact sheet builder preserving original tools/sheet.py 270x480 grid dimensions
with atomic output write and Pillow verification.

Provenance: NEW IMPLEMENTATION (matching original tools/sheet.py 270x480 tile spec,
supporting both f*.jpg and frame_*.jpg/png naming with optional frame-number labels).
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "tools" / "setup"))
from safe_path import atomic_write_bytes  # noqa: E402


def build_contact_sheet(
    in_dir: Path | str,
    out_jpg: Path | str,
    cols: int = 7,
    tile_w: int = 270,
    tile_h: int = 480,
    quality: int = 88,
    label_frames: bool = False,
) -> dict:
    src_dir = Path(in_dir).resolve()
    files = sorted(
        list(src_dir.glob("frame_*.jpg"))
        + list(src_dir.glob("frame_*.png"))
        + list(src_dir.glob("f*.jpg"))
    )
    # Deduplicate preserving sort order
    seen = set()
    unique_files = []
    for f in files:
        if f.name not in seen:
            seen.add(f.name)
            unique_files.append(f)

    if not unique_files:
        raise FileNotFoundError(f"No frame images found in {src_dir}")

    n = len(unique_files)
    grid_cols = min(cols, n)
    grid_rows = (n + cols - 1) // cols
    sheet = Image.new("RGB", (tile_w * grid_cols, tile_h * grid_rows), (18, 18, 22))
    draw = ImageDraw.Draw(sheet)

    for idx, fp in enumerate(unique_files):
        with Image.open(fp) as im:
            tile = im.convert("RGB").resize((tile_w, tile_h), Image.Resampling.LANCZOS)
        x = (idx % cols) * tile_w
        y = (idx // cols) * tile_h
        sheet.paste(tile, (x, y))
        if label_frames:
            draw.rectangle([x + 6, y + 6, x + 118, y + 28], fill=(0, 0, 0))
            draw.text((x + 12, y + 10), fp.stem, fill=(255, 255, 255))

    out_p = Path(out_jpg).resolve()
    out_p.parent.mkdir(parents=True, exist_ok=True)
    import io
    buf = io.BytesIO()
    sheet.save(buf, format="JPEG", quality=quality)
    atomic_write_bytes(out_p, buf.getvalue())
    return {
        "out_jpg": str(out_p),
        "tile_count": n,
        "width": sheet.width,
        "height": sheet.height,
        "bytes": out_p.stat().st_size,
    }


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("in_dir")
    ap.add_argument("out_jpg")
    ap.add_argument("--cols", type=int, default=7)
    ap.add_argument("--label", action="store_true")
    args = ap.parse_args(argv)
    import json
    print(json.dumps(build_contact_sheet(args.in_dir, args.out_jpg, cols=args.cols, label_frames=args.label), indent=2))
    return 0


if __name__ == "__main__":
    sys.exit(main())

"""Publish local-art/ to public/ and write src/data/published-art.json.

Usage: npm run publish:art
"""

import hashlib
import io
import json
import re
import sys
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
CHAR_SRC = ROOT / "local-art" / "tekken8"
STAGE_SRC = ROOT / "local-art" / "tekken8-stages"
CHAR_OUT = ROOT / "public" / "art" / "tekken8"
STAGE_OUT = ROOT / "public" / "stages"
MANIFEST = ROOT / "src" / "data" / "published-art.json"
STAGE_NAMES = json.loads((ROOT / "src" / "data" / "tekken8-stage-names.json").read_text("utf8"))["stages"]

CHAR_MAX_SIDE = 1600
# Face thumbnails for the character picker, framed like the app's art tiles
FACE_SIDE = 160
FACE_FILL = 0.55  # how much of the tile height the face takes up
FACE_ANCHOR_Y = 0.48  # where the face centre sits, as a share of the tile height
DEFAULT_FRAME = {"focusX": 50, "focusY": 20, "face": 0.12}
STAGE_COVER = (2400, 1350)  # big enough for both export formats
THUMB_W = 480
IMAGE_EXT = {".png", ".jpg", ".jpeg", ".webp"}


def slugify(s: str) -> str:
    return re.sub(r"^-|-$", "", re.sub(r"[^a-z0-9]+", "-", s.lower()))


def stage_for(filename: str) -> tuple[str, str]:
    base = slugify(Path(filename).stem)
    for s in STAGE_NAMES:
        if base == s["slug"] or base.startswith(s["slug"] + "-"):
            return s["slug"], s["name"]
    return base, " ".join(w.capitalize() for w in base.split("-") if w)


def encode(img: Image.Image, fmt: str, **opts) -> bytes:
    buf = io.BytesIO()
    img.save(buf, fmt, **opts)
    return buf.getvalue()


def write_hashed(out_dir: Path, stem: str, data: bytes, ext: str) -> str:
    name = f"{stem}.{hashlib.sha1(data).hexdigest()[:8]}{ext}"
    (out_dir / name).write_bytes(data)
    return name


def prune(out_dir: Path, keep: set[str]) -> None:
    for f in out_dir.iterdir():
        if f.is_file() and f.name not in keep:
            f.unlink()


def face_thumb(img: Image.Image, frame: dict) -> Image.Image:
    side = frame["face"] * img.height / FACE_FILL
    cx = frame["focusX"] / 100 * img.width
    cy = frame["focusY"] / 100 * img.height
    left, top = cx - side / 2, cy - FACE_ANCHOR_Y * side
    box = tuple(round(v) for v in (left, top, left + side, top + side))
    return img.crop(box).resize((FACE_SIDE, FACE_SIDE), Image.Resampling.LANCZOS)


def publish_characters() -> dict:
    CHAR_OUT.mkdir(parents=True, exist_ok=True)
    frames = json.loads((CHAR_SRC / "frames.json").read_text("utf8")) if (CHAR_SRC / "frames.json").exists() else {}
    out, keep, unframed = {}, set(), []
    for png in sorted(CHAR_SRC.glob("*.png")):
        slug = png.stem
        img = Image.open(png).convert("RGBA")
        scale = min(1.0, CHAR_MAX_SIDE / max(img.size))
        if scale < 1:
            img = img.resize((round(img.width * scale), round(img.height * scale)), Image.Resampling.LANCZOS)
        name = write_hashed(CHAR_OUT, slug, encode(img, "WEBP", quality=86, method=6), ".webp")
        keep.add(name)
        frame = frames.get(slug)
        if not frame:
            unframed.append(slug)
        thumb = write_hashed(
            CHAR_OUT, f"{slug}.face", encode(face_thumb(img, frame or DEFAULT_FRAME), "WEBP", quality=82, method=6), ".webp"
        )
        keep.add(thumb)
        # Frames are percentages, so resizing doesn't change them
        entry = {"src": f"/art/tekken8/{name}", "thumb": f"/art/tekken8/{thumb}"}
        if frame:
            entry.update({k: frame[k] for k in ("focusX", "focusY", "face")})
        out[slug] = entry
    prune(CHAR_OUT, keep)
    if unframed:
        print(f"no frame in frames.json (the app will detect one): {', '.join(unframed)}")
    return out


def publish_stages() -> list:
    STAGE_OUT.mkdir(parents=True, exist_ok=True)
    out, keep, seen = [], set(), set()
    files = sorted(p for p in STAGE_SRC.glob("*") if p.suffix.lower() in IMAGE_EXT) if STAGE_SRC.exists() else []
    for f in files:
        slug, name = stage_for(f.name)
        if slug in seen:
            print(f"skipped {f.name}: another file is already {name}")
            continue
        seen.add(slug)
        img = Image.open(f).convert("RGB")
        scale = min(1.0, max(STAGE_COVER[0] / img.width, STAGE_COVER[1] / img.height))
        if scale < 1:
            img = img.resize((round(img.width * scale), round(img.height * scale)), Image.Resampling.LANCZOS)
        full = write_hashed(STAGE_OUT, slug, encode(img, "JPEG", quality=85, optimize=True, progressive=True), ".jpg")
        thumb_img = img.resize((THUMB_W, round(img.height * THUMB_W / img.width)), Image.Resampling.LANCZOS)
        thumb = write_hashed(STAGE_OUT, f"{slug}.thumb", encode(thumb_img, "JPEG", quality=80, optimize=True), ".jpg")
        keep |= {full, thumb}
        out.append({"slug": slug, "name": name, "src": f"/stages/{full}", "thumb": f"/stages/{thumb}"})
    prune(STAGE_OUT, keep)
    known = {s["slug"] for s in STAGE_NAMES}
    missing = [s["name"] for s in STAGE_NAMES if s["slug"] not in seen]
    unknown = [s["name"] for s in out if s["slug"] not in known]
    if unknown:
        print(f"stages not in tekken8-stage-names.json (named from the file): {', '.join(unknown)}")
    if missing:
        print(f"stages without a screenshot ({len(missing)}): {', '.join(missing)}")
    return sorted(out, key=lambda s: s["name"])


def folder_mb(d: Path) -> float:
    return sum(f.stat().st_size for f in d.iterdir()) / 1e6


def main() -> None:
    chars = publish_characters()
    stages = publish_stages()
    MANIFEST.write_text(json.dumps({"characters": chars, "stages": stages}, indent=2) + "\n", "utf8")
    print(
        f"published {len(chars)} characters ({folder_mb(CHAR_OUT):.1f} MB)"
        f" and {len(stages)} stages ({folder_mb(STAGE_OUT):.1f} MB)"
    )


if __name__ == "__main__":
    sys.exit(main())

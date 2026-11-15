"""Cut out raw renders in local-art/tekken8/_raw into transparent PNGs.

npm run cutout                  # new or changed renders
npm run cutout -- --force       # redo everything
npm run cutout -- reina nina    # only these slugs
"""

from __future__ import annotations

import argparse
import json
import sys
import time
from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
RAW = ROOT / "local-art" / "tekken8" / "_raw"
OUT = ROOT / "local-art" / "tekken8"
ROSTER = ROOT / "src" / "data" / "tekken8-roster.json"

MAX_SIDE = 2400
PAD = 8
EXTS = {".png", ".jpg", ".jpeg", ".webp"}
ALIASES: dict[str, str] = {"fengwei": "feng", "feng-wei": "feng", "jack8": "jack-8", "devil_jin": "devil-jin"}


def has_cutout(img: Image.Image) -> bool:
    # Already has real transparency?
    if "A" not in img.getbands() and "transparency" not in img.info:
        return False
    a = np.asarray(img.convert("RGBA").getchannel("A"))
    return (a < 16).mean() > 0.08


def border_colour(rgb: np.ndarray) -> tuple[np.ndarray, float]:
    # The border colour, and how even it is
    h, w, _ = rgb.shape
    s = max(2, round(min(h, w) * 0.01))
    strip = np.concatenate(
        [rgb[:s].reshape(-1, 3), rgb[-s:].reshape(-1, 3), rgb[:, :s].reshape(-1, 3), rgb[:, -s:].reshape(-1, 3)]
    ).astype(np.float32)
    med = np.median(strip, axis=0)
    return med, float(np.abs(strip - med).mean())


def decontaminate(rgb: np.ndarray, alpha: np.ndarray, bg: np.ndarray) -> np.ndarray:
    # Take out background colour that bleeds into soft edges: F = (C - B(1 - a)) / a
    a = alpha.astype(np.float32)[..., None] / 255.0
    c = rgb.astype(np.float32)
    edge = (a > 0) & (a < 0.98)
    f = (c - bg * (1 - a)) / np.maximum(a, 0.08)
    out = np.where(edge, np.clip(f, 0, 255), c)
    return out.astype(np.uint8)


def fit(img: Image.Image) -> Image.Image:
    scale = MAX_SIDE / max(img.size)
    if scale >= 1:
        return img
    return img.resize((round(img.width * scale), round(img.height * scale)), Image.Resampling.LANCZOS)


def trim(img: Image.Image) -> Image.Image:
    a = np.asarray(img.getchannel("A"))
    ys, xs = np.nonzero(a >= 8)
    if not len(ys):
        return img
    box = (
        max(0, xs.min() - PAD),
        max(0, ys.min() - PAD),
        min(img.width, xs.max() + 1 + PAD),
        min(img.height, ys.max() + 1 + PAD),
    )
    return img.crop(box)


def process(src: Path, dst: Path, session) -> str:
    from rembg import remove

    img = Image.open(src)
    img.load()
    if has_cutout(img):
        out = fit(img.convert("RGBA"))
        note = "already transparent, copied"
    else:
        rgb_img = fit(img.convert("RGB"))
        mask = remove(rgb_img, session=session, only_mask=True, post_process_mask=False)
        assert isinstance(mask, Image.Image)
        alpha = np.asarray(mask.convert("L"))
        rgb = np.asarray(rgb_img)
        bg, spread = border_colour(rgb)
        if spread < 12:  # a flat background
            rgb = decontaminate(rgb, alpha, bg)
            note = f"bg rgb({bg[0]:.0f},{bg[1]:.0f},{bg[2]:.0f}) removed from edges"
        else:
            note = f"busy background (spread {spread:.0f}), edges left as-is - check this one"
        out = Image.fromarray(np.dstack([rgb, alpha]), "RGBA")
    out = trim(out)
    out.save(dst, optimize=True)
    return f"{out.width}x{out.height}, {note}"


FRAMES = OUT / "frames.json"
YUNET = ROOT / ".venv" / "models" / "yunet.onnx"
YUNET_URL = (
    "https://github.com/opencv/opencv_zoo/raw/main/models/face_detection_yunet/face_detection_yunet_2023mar.onnx"
)
# The face is 0.98 of the box height, centred 22% of the way down
FACE_PER_BOX = 0.98
FOCUS_DOWN_BOX = 0.22


def detect_frame(path: Path) -> dict | None:
    # Finds the face with OpenCV YuNet, or gives up and returns None
    import cv2

    img = Image.open(path).convert("RGBA")
    bg = Image.new("RGBA", img.size, (128, 128, 128, 255))
    bg.alpha_composite(img)
    a = cv2.cvtColor(np.asarray(bg.convert("RGB")), cv2.COLOR_RGB2BGR)
    s = min(1.0, 1600 / max(a.shape[:2]))
    a = cv2.resize(a, (round(a.shape[1] * s), round(a.shape[0] * s)))
    h, w = a.shape[:2]
    det = cv2.FaceDetectorYN.create(str(YUNET), "", (w, h), 0.8, 0.3, 50)
    _, faces = det.detect(a)
    if faces is None:
        return None
    x, y, bw, bh = max(faces, key=lambda f: f[-1])[:4]
    return {
        "focusX": round(float(x + bw / 2) / w * 100, 1),
        "focusY": round(float(y + FOCUS_DOWN_BOX * bh) / h * 100, 1),
        "face": round(FACE_PER_BOX * float(bh) / h, 3),
    }


def add_missing_frames() -> None:
    # Detects frames for any cutouts that aren't in frames.json yet
    frames = json.loads(FRAMES.read_text(encoding="utf-8")) if FRAMES.exists() else {}
    missing = [p for p in sorted(OUT.glob("*.png")) if p.stem not in frames]
    if not missing:
        return
    try:
        import cv2  # noqa: F401
    except ImportError:
        print("No frames added: install OpenCV with .venv\\Scripts\\pip install opencv-python-headless")
        return
    if not YUNET.exists():
        import urllib.request

        YUNET.parent.mkdir(parents=True, exist_ok=True)
        urllib.request.urlretrieve(YUNET_URL, YUNET)
    added, failed = [], []
    for p in missing:
        f = detect_frame(p)
        if f:
            frames[p.stem] = f
            added.append(p.stem)
        else:
            failed.append(p.stem)
    FRAMES.write_text(json.dumps(dict(sorted(frames.items())), indent=1) + "\n", encoding="utf-8")
    if added:
        print("Frames detected (publish, then check them with node scripts/check-art.mjs):", ", ".join(added))
    if failed:
        print("No face found, frame these by hand in frames.json:", ", ".join(failed))


def is_stale(slug: str, src: Path) -> bool:
    dst = OUT / f"{slug}.png"
    return not dst.exists() or dst.stat().st_mtime < src.stat().st_mtime


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("slugs", nargs="*", help="only process these slugs")
    ap.add_argument("--force", action="store_true", help="redo cutouts that are already up to date")
    ap.add_argument("--model", default="birefnet-general", help="rembg model (default: birefnet-general)")
    args = ap.parse_args()

    if not RAW.is_dir():
        print(f"No input folder: {RAW}")
        return 1

    jobs: dict[str, Path] = {}
    for p in sorted(RAW.iterdir()):
        if p.suffix.lower() in EXTS:
            slug = ALIASES.get(p.stem.lower(), p.stem.lower())
            jobs[slug] = p
    slugs: list[str] = args.slugs
    if slugs:
        want = {ALIASES.get(s.lower(), s.lower()) for s in slugs}
        missing = want - jobs.keys()
        if missing:
            print("Not in _raw:", ", ".join(sorted(missing)))
        jobs = {s: p for s, p in jobs.items() if s in want}

    todo = {s: p for s, p in jobs.items() if args.force or slugs or is_stale(s, p)}
    print(f"{len(jobs)} raw images, {len(todo)} to cut out (model: {args.model})")

    session = None
    if todo:
        from rembg import new_session

        session = new_session(args.model)

    failed = 0
    for i, (slug, src) in enumerate(todo.items(), 1):
        t = time.time()
        try:
            info = process(src, OUT / f"{slug}.png", session)
            print(f"[{i}/{len(todo)}] {slug}: {info} ({time.time() - t:.1f}s)", flush=True)
        except Exception as e:
            failed += 1
            print(f"[{i}/{len(todo)}] {slug}: FAILED {e}", flush=True)

    add_missing_frames()

    roster = {c["slug"] for c in json.loads(ROSTER.read_text(encoding="utf-8"))["characters"]}
    have = {p.stem for p in OUT.glob("*.png")}
    if roster - have:
        print("Roster characters with no local art:", ", ".join(sorted(roster - have)))
    if have - roster:
        extra = ", ".join(sorted(have - roster))
        print(f"Local art not in the roster (typo, or run `npm run sync:roster`): {extra}")
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())

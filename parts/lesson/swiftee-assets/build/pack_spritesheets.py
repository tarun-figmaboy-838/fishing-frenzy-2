#!/usr/bin/env python3
"""
Packs the rendered Swiftee frames into engine-agnostic sprite sheets.

The whole design serves one guarantee: ANY frame of ANY animation is
interchangeable with any other.

  * Every frame lives in an identical square cell.
  * Every cell shares one pivot - the exact centre - which is also the
    artboard centre the character was authored around. That means engine
    defaults already do the right thing (Unity pivot Center, Godot
    centered=true, Phaser setOrigin(0.5), CSS background-position center).
  * Frames are laid out on a strict uniform grid, left-to-right then
    top-to-bottom, so an engine can slice a sheet knowing only the cell size -
    the JSON is a convenience, never a requirement.
  * No per-frame trimming. Trimming saves atlas space but destroys exactly the
    property we want, because every frame would then need its own offset.

Outputs
-------
  spritesheets/<scale>/swiftee_<anim>@<scale>.png   uniform-grid sheet per animation
  atlas/<scale>/swiftee_<anim>@<scale>.json         TexturePacker JSON-Hash
  atlas/swiftee.manifest.json                       master index: states, fps, pivot
  poses/swiftee_poses@2x.png + .json                one frame per state, single sheet
  poses/png/swiftee_<state>.png                     individual aligned pose PNGs
  preview/index.html                                local player/scrubber

Usage
-----
  node build/render_rive.mjs      # must run first
  python3 build/pack_spritesheets.py
  python3 build/pack_spritesheets.py --lossless --max-texture 2048
"""

from __future__ import annotations

import argparse
import json
import math
import shutil
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
CACHE = ROOT / "build" / ".cache" / "frames"   # overridden by --cache-dir
PREFIX = ""                                    # set by --prefix; nests all output

# Delivered scales, as multiples of the @1x cell from render.json.
SCALES = {"2x": 2, "1x": 1}

LOSSLESS = False
EXT = "webp"


# --- image helpers ---------------------------------------------------------

def save_image(img: Image.Image, path: Path) -> int:
    """Write a sprite sheet, palettised and losslessly compressed.

    Two decisions worth knowing about:

    * **Palettise first.** The character is flat-shaded vector art, so a
      256-entry palette with per-entry alpha is visually indistinguishable from
      RGBA8888 - and it also compresses far better downstream. Measured on one
      sheet: quantise then lossless WebP is 60 KB, raw RGBA then lossless WebP
      is 124 KB.
    * **Lossless, never lossy.** Counter-intuitive for WebP, but these sheets
      are flat colour over mostly-transparent cells, and lossy VP8 spends bits
      on DCT blocks inside fully transparent regions. Measured on real sheets,
      lossy WebP came out 2-4x LARGER than palettised PNG and visibly worse
      (rms 22-38). Lossless WebP is identical pixels at ~65% of the PNG size.

    --lossless keeps true RGBA (no palette); --format png emits PNG instead.
    """
    path.parent.mkdir(parents=True, exist_ok=True)
    out = img if LOSSLESS else img.quantize(colors=256, method=Image.Quantize.FASTOCTREE)
    if path.suffix == ".webp":
        # WebP has no palette mode, so hand it RGBA. The palette still did its
        # job by collapsing the colour count the encoder has to model.
        out.convert("RGBA").save(path, "WEBP", lossless=True, method=6)
    else:
        out.save(path, optimize=True)
    return path.stat().st_size


# Crossfade transitions leave ghost copies at alpha 1-3, which are invisible but
# would otherwise dominate every bounds measurement. Ignore anything that faint.
VISIBLE_ALPHA = 8


def opaque_box(img: Image.Image) -> tuple[int, int, int, int]:
    mask = img.getchannel("A").point(lambda v: 255 if v >= VISIBLE_ALPHA else 0)
    b = mask.getbbox()
    return b if b else (0, 0, 0, 0)


def union(boxes) -> tuple[int, int, int, int]:
    live = [b for b in boxes if b[2] > b[0]]
    if not live:
        return (0, 0, 0, 0)
    return (min(b[0] for b in live), min(b[1] for b in live),
            max(b[2] for b in live), max(b[3] for b in live))


def grid_for(n: int, cell: int, max_texture: int) -> tuple[int, int]:
    """Near-square grid whose sheet stays inside the texture limit."""
    per_row_cap = max(1, max_texture // cell)
    cols = min(max(1, math.ceil(math.sqrt(n))), per_row_cap)
    rows = math.ceil(n / cols)
    while rows * cell > max_texture and cols < per_row_cap:
        cols += 1
        rows = math.ceil(n / cols)
    if rows * cell > max_texture:
        raise SystemExit(f"{n} frames of {cell}px exceed a {max_texture}px sheet")
    return cols, rows


def paginate(n: int, cell: int, max_texture: int) -> list[tuple[int, int]]:
    """Split n frames into pages that each fit the texture limit.

    A 4096px sheet holds 8x8 cells at 512px, so a long animation at a high fps
    needs more than one page. Splitting beats the alternatives - dropping frames
    or shrinking the cell - because it leaves the cell size, and therefore the
    shared pivot, untouched.
    """
    cap = max(1, max_texture // cell) ** 2
    return [(i, min(cap, n - i)) for i in range(0, n, cap)]


# --- state grouping --------------------------------------------------------

def group_states(anims: dict) -> tuple[dict, list]:
    """Pair each base animation with its start/stop transitions.

    The rig names transitions inconsistently - "Wave start" for "Waving",
    "Callstart" for "Calling", "Sleep Start" for "Sleeping" - so no suffix rule
    works. Match on longest common prefix against the base names instead.
    """
    def role_of(k: str) -> str | None:
        return "start" if k.endswith("start") else "stop" if k.endswith("stop") else None

    bases = {k: v for k, v in anims.items() if role_of(k) is None}
    transitions = {k: v for k, v in anims.items() if role_of(k) is not None}

    def lcp(a: str, b: str) -> int:
        n = 0
        for x, y in zip(a, b):
            if x != y:
                break
            n += 1
        return n

    states: dict[str, dict] = {k: {"loop": k, "start": None, "stop": None} for k in bases}
    standalone: list[str] = []

    for key in transitions:
        role = role_of(key)
        stem = key[: -len(role)].rstrip("_")
        best, score = None, 0
        for bk in bases:
            n = lcp(stem, bk)
            # Require a real overlap so "reset" never captures "reading".
            if n >= 3 and n > score:
                best, score = bk, n
        if best is None:
            standalone.append(key)
        else:
            states[best][role] = key

    # A base with no transitions at all is just a standalone clip.
    lone = [k for k, v in states.items()
            if v["start"] is None and v["stop"] is None]
    for k in lone:
        del states[k]
        standalone.append(k)

    return states, sorted(standalone)


# --- main ------------------------------------------------------------------

def rel(*parts: str) -> str:
    """Project-relative POSIX path for the manifest, prefix included."""
    head, *tail = parts
    return "/".join([head] + ([PREFIX] if PREFIX else []) + list(tail))


def out(*parts: str) -> Path:
    """Output path, nested under --prefix so several .riv sources can coexist."""
    return ROOT.joinpath(parts[0], *( [PREFIX] if PREFIX else [] ), *parts[1:])


def main(max_texture: int, write_frames: bool, poses_only: bool) -> None:
    render = json.loads((CACHE / "render.json").read_text())
    base_cell = render["cell"]
    render_cell = render["renderCell"]
    anims = render["animations"]

    for d in ("spritesheets", "atlas", "poses", "preview", "frames"):
        shutil.rmtree(out(d), ignore_errors=True)

    states, standalone = group_states(anims)

    manifest = {
        "name": "swiftee",
        "source": render["riv"],
        "artboard": render["artboard"],
        "generatedBy": "build/render_rive.mjs + build/pack_spritesheets.py",
        "fps": render["fps"],
        "pivot": {"x": 0.5, "y": 0.5,
                  "note": "exact cell centre for every frame of every animation; "
                          "matches engine defaults, so poses are interchangeable"},
        "cell": {s: base_cell * m for s, m in SCALES.items()},
        "contentBox": render["contentBox"],
        "artboardSize": render["artboardSize"],
        "scales": {s: {"cell": base_cell * m, "sheets": {}} for s, m in SCALES.items()},
        "animations": {},
        "states": {},
        "standalone": standalone,
    }

    all_boxes: list[tuple[int, int, int, int]] = []
    boxes_by_anim: list[tuple[str, tuple[int, int, int, int]]] = []
    exits_by_anim: dict[str, bool] = {}
    pose_images: dict[str, Image.Image] = {}

    keys = sorted(anims)
    for key in keys:
        meta = anims[key]
        files = sorted((CACHE / meta["dir"]).glob("*.png"))
        if not files:
            raise SystemExit(f"no rendered frames for {key}; re-run render_rive.mjs")
        native = [Image.open(f).convert("RGBA") for f in files]
        boxes = [opaque_box(i) for i in native]
        all_boxes.extend(boxes)
        u = union(boxes)
        boxes_by_anim.append((key, u))
        # Determined from the rendered frames, not the renderer's coarse measure
        # pass: an animation "exits" only if visible art meets a cell edge.
        exits = any(b[2] > b[0] and (b[0] <= 0 or b[1] <= 0
                                     or b[2] >= render_cell or b[3] >= render_cell)
                    for b in boxes)
        exits_by_anim[key] = exits
        manifest["animations"][key] = {
            "name": meta["name"],
            "frames": meta["frames"],
            "fps": render["fps"],
            "durationMs": round(meta["durationSec"] * 1000),
            "loop": meta["loop"],
            "pingpong": meta["pingpong"],
            "timeline": {"frames": meta["timelineFrames"], "fps": meta["timelineFps"]},
            # Opaque bounds across the animation, in @2x cell pixels. Handy for
            # tight collision boxes or for aligning the character to a floor.
            "opaqueBoundsUnion": {"x": u[0], "y": u[1], "w": u[2] - u[0], "h": u[3] - u[1]},
            "exitsCell": exits_by_anim[key],
        }

        # Middle frame reads as the most characteristic still for a loop.
        pose_images[key] = native[len(native) // 2 if meta["loop"] else 0].copy()

        if poses_only:
            for i in native:
                i.close()
            continue

        for scale, mult in SCALES.items():
            cell = base_cell * mult
            cells = native if cell == render_cell else [
                i.resize((cell, cell), Image.LANCZOS) for i in native
            ]
            pages = paginate(len(cells), cell, max_texture)
            page_meta = []
            for pi, (start, count) in enumerate(pages):
                cols, rows = grid_for(count, cell, max_texture)
                sheet = Image.new("RGBA", (cols * cell, rows * cell), (0, 0, 0, 0))
                for i in range(count):
                    sheet.paste(cells[start + i], ((i % cols) * cell, (i // cols) * cell))

                suffix = "" if len(pages) == 1 else f"_p{pi}"
                name = f"swiftee_{key}{suffix}@{scale}.{EXT}"
                size = save_image(sheet, out("spritesheets", scale, name))

                frames_json = {}
                for i in range(count):
                    x, y = (i % cols) * cell, (i // cols) * cell
                    bx = tuple(round(v * cell / render_cell) for v in boxes[start + i])
                    frames_json[f"{key}_{start + i:03d}"] = {
                        "frame": {"x": x, "y": y, "w": cell, "h": cell},
                        "rotated": False,
                        "trimmed": False,
                        "spriteSourceSize": {"x": 0, "y": 0, "w": cell, "h": cell},
                        "sourceSize": {"w": cell, "h": cell},
                        "pivot": {"x": 0.5, "y": 0.5},
                        "opaqueBounds": {"x": bx[0], "y": bx[1],
                                         "w": max(0, bx[2] - bx[0]), "h": max(0, bx[3] - bx[1])},
                    }
                atlas = {
                    "frames": frames_json,
                    "animations": {key: list(frames_json)},
                    "meta": {
                        "app": "swiftee asset pipeline",
                        "version": "1.0",
                        "image": f"../../spritesheets/{scale}/{name}" if not PREFIX else f"../../../spritesheets/{PREFIX}/{scale}/{name}",
                        "format": "RGBA8888",
                        "size": {"w": sheet.width, "h": sheet.height},
                        "scale": "1",
                        "fps": render["fps"],
                        "grid": {"cols": cols, "rows": rows, "cell": cell},
                        "page": pi, "pages": len(pages),
                        "frameTags": [{"name": key, "from": start, "to": start + count - 1,
                                       "direction": "pingpong" if meta["pingpong"] else "forward"}],
                    },
                }
                ap_ = out("atlas", scale, f"swiftee_{key}{suffix}@{scale}.json")
                ap_.parent.mkdir(parents=True, exist_ok=True)
                # Machine-read, 164 of them - compact JSON saves ~60% of the bytes.
                ap_.write_text(json.dumps(atlas, separators=(",", ":")))
                page_meta.append({
                    "image": rel("spritesheets", scale, name),
                    "atlas": rel("atlas", scale, f"swiftee_{key}{suffix}@{scale}.json"),
                    "cols": cols, "rows": rows,
                    "firstFrame": start, "frames": count,
                    "sheetSize": {"w": sheet.width, "h": sheet.height},
                    "bytes": size,
                })
                sheet.close()

            entry = {
                "cell": cell,
                "frames": len(cells),
                "pages": len(pages),
                "bytes": sum(p["bytes"] for p in page_meta),
            }
            # Single page is the overwhelmingly common case - keep it flat so
            # consumers do not have to reach into a pages array for every anim.
            if len(page_meta) == 1:
                entry.update({k: v for k, v in page_meta[0].items()
                              if k not in ("firstFrame", "frames", "bytes")})
            else:
                entry["pageList"] = page_meta
            manifest["scales"][scale]["sheets"][key] = entry

            if write_frames and cell == render_cell:
                for i, c in enumerate(cells):
                    save_image(c, out("frames", key, f"{key}_{i:03d}.{EXT}"))

            if cells is not native:
                for c in cells:
                    c.close()
            sheet.close()

        for i in native:
            i.close()

    # states, resolved to real animation keys
    for loop_key, parts in sorted(states.items()):
        manifest["states"][loop_key] = {
            "start": parts["start"], "loop": parts["loop"], "stop": parts["stop"],
            "play": [p for p in (parts["start"], parts["loop"], parts["stop"]) if p],
        }

    # Bounds over the animations that stay in frame. The handful of travel
    # animations (driving, peeping transitions) deliberately leave the cell, so
    # including them would just report "the whole cell" and tell you nothing.
    stationary = union([b for k, b in boxes_by_anim if not exits_by_anim[k]])
    cu = union(all_boxes)
    manifest["contentUnion"] = {
        "x": stationary[0], "y": stationary[1],
        "w": stationary[2] - stationary[0], "h": stationary[3] - stationary[1],
        "space": f"@2x cell ({base_cell * 2}px)",
        "note": "footprint of every in-frame pose; travel animations "
                "(see exitsCell) reach past it by design",
    }
    manifest["contentUnionAll"] = {
        "x": cu[0], "y": cu[1], "w": cu[2] - cu[0], "h": cu[3] - cu[1],
        "space": f"@2x cell ({base_cell * 2}px)",
    }
    manifest["exitsCell"] = sorted(k for k, v in exits_by_anim.items() if v)
    # The floor line, taken from the neutral standing idle. Measuring it across
    # all animations would be useless - peeping runs to the bottom of the cell
    # and sleeping curls up well above it - so anchor it to one reference pose
    # and say which. Align this to your ground and the character stands on it.
    ref = next((k for k in ("blinking", "waving", "happy") if k in dict(boxes_by_anim)), None)
    if ref is None:
        ref = next(k for k, _ in boxes_by_anim if not exits_by_anim[k])
    rb = dict(boxes_by_anim)[ref]
    manifest["baselineY"] = {
        "y": rb[3],
        "reference": ref,
        "space": f"@2x cell ({base_cell * 2}px)",
        "normalized": round(rb[3] / (base_cell * 2), 4),
        "note": "bottom of the standing idle; sleeping/peeping poses sit "
                "elsewhere by design",
    }

    # ---- pose sheet: one still per animation ----
    # Built at the @1x cell so all 82 stills fit a single 4096px texture; the
    # full-resolution version of each pose lives in poses/png/.
    pose_keys = sorted(pose_images)
    cell = base_cell
    cols, rows = grid_for(len(pose_keys), cell, max_texture)
    ps = Image.new("RGBA", (cols * cell, rows * cell), (0, 0, 0, 0))
    pose_json = {}
    for i, k in enumerate(pose_keys):
        x, y = (i % cols) * cell, (i // cols) * cell
        ps.paste(pose_images[k].resize((cell, cell), Image.LANCZOS), (x, y))
        pose_json[k] = {
            "frame": {"x": x, "y": y, "w": cell, "h": cell},
            "rotated": False, "trimmed": False,
            "spriteSourceSize": {"x": 0, "y": 0, "w": cell, "h": cell},
            "sourceSize": {"w": cell, "h": cell},
            "pivot": {"x": 0.5, "y": 0.5},
        }
        save_image(pose_images[k], out("poses", "still", f"swiftee_{k}.{EXT}"))
    pose_bytes = save_image(ps, out("poses", f"swiftee_poses@1x.{EXT}"))
    out("poses", "swiftee_poses@1x.json").write_text(json.dumps({
        "frames": pose_json,
        "meta": {"app": "swiftee asset pipeline", "image": f"swiftee_poses@1x.{EXT}",
                 "format": "RGBA8888", "size": {"w": ps.width, "h": ps.height},
                 "scale": "1", "grid": {"cols": cols, "rows": rows, "cell": cell},
                 "note": "one representative still per animation, same cell and pivot "
                         "as every sprite sheet"},
    }, separators=(",", ":")))
    manifest["poseSheet"] = {
        "image": rel("poses", f"swiftee_poses@1x.{EXT}"),
        "atlas": rel("poses", "swiftee_poses@1x.json"),
        "individual": rel("poses", "still", f"swiftee_<state>.{EXT}") + "  (full @2x resolution)",
        "cell": cell, "cols": cols, "rows": rows, "count": len(pose_keys),
        "bytes": pose_bytes,
    }

    out("atlas").mkdir(parents=True, exist_ok=True)
    out("atlas", "swiftee.manifest.json").write_text(json.dumps(manifest, indent=2))

    # ---- report ----
    print(f"cell {base_cell*2}px @2x / {base_cell}px @1x   pivot centre   "
          f"{render['fps']}fps   .{EXT}")
    print(f"{len(keys)} animations, {len(states)} states, {len(standalone)} standalone")
    if not poses_only:
        for scale in SCALES:
            sheets = manifest["scales"][scale]["sheets"]
            tot = sum(s["bytes"] for s in sheets.values())
            fr = sum(s["frames"] for s in sheets.values())
            print(f"  @{scale}: {len(sheets)} sheets, {fr} frames, {tot/1024/1024:.1f} MB")
    print(f"  poses: {len(pose_keys)} stills, {pose_bytes/1024:.0f} KB sheet")
    print(f"  in-frame content occupies x {stationary[0]}-{stationary[2]}, "
          f"y {stationary[1]}-{stationary[3]} of the {base_cell*2}px cell")
    if manifest["exitsCell"]:
        print(f"  leaves the cell by design: {', '.join(manifest['exitsCell'])}")


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--max-texture", type=int, default=4096,
                    help="max sheet dimension in px (default 4096, safe on mobile GPUs)")
    ap.add_argument("--frames", action="store_true",
                    help="also write individual @2x PNG frames (large)")
    ap.add_argument("--poses-only", action="store_true",
                    help="rebuild just the pose sheet, skip sprite sheets")
    ap.add_argument("--format", default="webp", choices=("webp", "png"),
                    help="sheet format (default webp: identical pixels at ~65%% of "
                         "PNG; use png for Unity / Unreal / GameMaker, which have "
                         "no native WebP import)")
    ap.add_argument("--lossless", action="store_true",
                    help="skip palettisation and keep true RGBA (much bigger)")
    ap.add_argument("--cache-dir", default=None,
                    help="rendered-frame directory (default build/.cache/frames)")
    ap.add_argument("--prefix", default="",
                    help="nest output under this name, e.g. --prefix jump; use one "
                         "per .riv source since each artboard has its own cell")
    a = ap.parse_args()
    if a.cache_dir:
        globals()["CACHE"] = Path(a.cache_dir).resolve()
    globals()["PREFIX"] = a.prefix
    globals()["EXT"] = a.format
    LOSSLESS = a.lossless
    globals()["LOSSLESS"] = a.lossless
    main(a.max_texture, a.frames, a.poses_only)

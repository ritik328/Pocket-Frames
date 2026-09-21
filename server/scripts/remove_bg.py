#!/usr/bin/env python3
"""
Pocket Frames — Sticker Background Remover powered by danielgatis/rembg
Repository: https://github.com/danielgatis/rembg.git
========================================================================
Uses the official rembg tool by Daniel Gatis for state-of-the-art
AI background removal, optimized for sticker generation:

- Primary: rembg (danielgatis/rembg) with U2Net ONNX neural network model
- Mask post-processing: enabled by default for artifact-free sticker contours
- Fallback 1: OpenCV GrabCut with Gaussian edge feathering
- Fallback 2: Color-flood fill with boundary alpha matting

Usage:
    python remove_bg.py <input_path> <output_path> [--model u2net]
    python remove_bg.py - -  (reads raw bytes from stdin, writes PNG to stdout)
"""

import sys
import os
import io
import argparse
import traceback

import numpy as np
from PIL import Image

# Global cached rembg sessions by model name
_SESSIONS = {}


def get_rembg_session(model_name: str = "u2net"):
    """Get or create cached rembg ONNX session."""
    global _SESSIONS
    if model_name not in _SESSIONS:
        from rembg import new_session
        _SESSIONS[model_name] = new_session(model_name)
    return _SESSIONS[model_name]


# ─── PRIMARY ENGINE: danielgatis/rembg ─────────────────────────────────────────
def remove_bg_rembg(
    img_bytes: bytes,
    model_name: str = "u2net",
    post_process_mask: bool = True,
    alpha_matting: bool = False
) -> bytes:
    """
    Execute background removal using danielgatis/rembg.
    Returns transparent PNG bytes.
    """
    from rembg import remove as rembg_remove

    session = get_rembg_session(model_name)
    result_bytes = rembg_remove(
        img_bytes,
        session=session,
        post_process_mask=post_process_mask,
        alpha_matting=alpha_matting,
        force_return_bytes=True
    )

    # Tight crop around transparent bounding box
    try:
        pil_img = Image.open(io.BytesIO(result_bytes)).convert("RGBA")
        bbox = pil_img.getbbox()
        if bbox:
            pad = 2
            left = max(0, bbox[0] - pad)
            top = max(0, bbox[1] - pad)
            right = min(pil_img.width, bbox[2] + pad)
            bottom = min(pil_img.height, bbox[3] + pad)
            pil_img = pil_img.crop((left, top, right, bottom))

        # Constrain max dimension to 512 for responsive canvas sticker rendering
        if pil_img.width > 512 or pil_img.height > 512:
            pil_img.thumbnail((512, 512), Image.LANCZOS)

        buf = io.BytesIO()
        pil_img.save(buf, format="PNG", optimize=True)
        return buf.getvalue()
    except Exception as crop_err:
        print(f"[rembg] Crop warning: {crop_err}", file=sys.stderr)
        return result_bytes


# ─── FALLBACK 1: OpenCV GrabCut Segmentation ──────────────────────────────────
def remove_bg_grabcut(img_bytes: bytes) -> bytes:
    """
    Multi-pass GrabCut segmentation with edge softening (OpenCV fallback).
    """
    import cv2

    nparr = np.frombuffer(img_bytes, np.uint8)
    bgr = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
    if bgr is None:
        raise ValueError("OpenCV could not decode image")

    h, w = bgr.shape[:2]
    margin_x = max(5, int(w * 0.10))
    margin_y = max(5, int(h * 0.10))
    rect = (margin_x, margin_y, w - 2 * margin_x, h - 2 * margin_y)

    mask = np.zeros((h, w), np.uint8)
    bg_model = np.zeros((1, 65), np.float64)
    fg_model = np.zeros((1, 65), np.float64)

    cv2.grabCut(bgr, mask, rect, bg_model, fg_model, 10, cv2.GC_INIT_WITH_RECT)

    # Second pass with centre-region hint
    center_mask = np.zeros((h, w), np.uint8)
    cx, cy = w // 2, h // 2
    cw, ch = int(w * 0.35), int(h * 0.35)
    center_mask[cy - ch:cy + ch, cx - cw:cx + cw] = cv2.GC_FG
    mask2 = mask.copy()
    mask2[center_mask == cv2.GC_FG] = cv2.GC_FG
    cv2.grabCut(bgr, mask2, None, bg_model, fg_model, 5, cv2.GC_INIT_WITH_MASK)

    alpha = np.where((mask2 == cv2.GC_FGD) | (mask2 == cv2.GC_PR_FGD), 255, 0).astype(np.uint8)

    # Morphological cleanup
    kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (5, 5))
    alpha = cv2.morphologyEx(alpha, cv2.MORPH_CLOSE, kernel, iterations=2)
    alpha = cv2.morphologyEx(alpha, cv2.MORPH_OPEN, kernel, iterations=1)

    # Soft feathered edges
    eroded = cv2.erode(alpha, kernel, iterations=3)
    edge_band = cv2.subtract(alpha, eroded)
    blurred_edge = cv2.GaussianBlur(edge_band, (15, 15), 0)
    soft_alpha = np.clip(eroded.astype(int) + blurred_edge.astype(int), 0, 255).astype(np.uint8)

    rgb = cv2.cvtColor(bgr, cv2.COLOR_BGR2RGB)
    rgba = np.dstack([rgb, soft_alpha])
    pil_img = Image.fromarray(rgba, "RGBA")

    bbox = pil_img.getbbox()
    if bbox:
        pad = 4
        left = max(0, bbox[0] - pad)
        top = max(0, bbox[1] - pad)
        right = min(pil_img.width, bbox[2] + pad)
        bottom = min(pil_img.height, bbox[3] + pad)
        pil_img = pil_img.crop((left, top, right, bottom))

    pil_img.thumbnail((512, 512), Image.LANCZOS)

    buf = io.BytesIO()
    pil_img.save(buf, format="PNG", optimize=True)
    return buf.getvalue()


# ─── FALLBACK 2: Color Flood-Fill ─────────────────────────────────────────────
def remove_bg_colorfill(img_bytes: bytes) -> bytes:
    """
    Corner-color sampling + alpha thresholding for flat/solid backgrounds.
    """
    pil_img = Image.open(io.BytesIO(img_bytes)).convert("RGBA")
    w, h = pil_img.size
    data = np.array(pil_img, dtype=np.float32)

    sample_coords = [
        (0, 0), (w - 1, 0), (0, h - 1), (w - 1, h - 1),
        (w // 2, 0), (w // 2, h - 1), (0, h // 2), (w - 1, h // 2),
    ]
    samples = [data[y, x, :3] for x, y in sample_coords if 0 <= x < w and 0 <= y < h]
    bg_colour = np.mean(samples, axis=0)

    rgb = data[:, :, :3]
    diff = np.sqrt(np.sum((rgb - bg_colour) ** 2, axis=2))

    hard_threshold = 40
    soft_threshold = 65

    hard_mask = diff <= hard_threshold
    soft_mask = diff <= soft_threshold

    alpha = data[:, :, 3].copy()
    alpha[hard_mask] = 0
    feather_zone = soft_mask & ~hard_mask
    feather_alpha = (diff[feather_zone] - hard_threshold) / (soft_threshold - hard_threshold)
    alpha[feather_zone] = (feather_alpha * alpha[feather_zone]).astype(np.float32)

    data[:, :, 3] = alpha
    result_img = Image.fromarray(data.astype(np.uint8), "RGBA")

    bbox = result_img.getbbox()
    if bbox:
        result_img = result_img.crop(bbox)
    result_img.thumbnail((512, 512), Image.LANCZOS)

    buf = io.BytesIO()
    result_img.save(buf, format="PNG", optimize=True)
    return buf.getvalue()


# ─── Main Pipeline ────────────────────────────────────────────────────────────
def process_image(
    img_bytes: bytes,
    model_name: str = "u2net",
    alpha_matting: bool = False
) -> bytes:
    """Process image through danielgatis/rembg with fallbacks."""
    # Stage 1: Official danielgatis/rembg tool
    try:
        result = remove_bg_rembg(
            img_bytes,
            model_name=model_name,
            post_process_mask=True,
            alpha_matting=alpha_matting
        )
        print(f"[rembg] danielgatis/rembg ({model_name}): SUCCESS", file=sys.stderr)
        return result
    except Exception as e:
        print(f"[rembg] danielgatis/rembg ({model_name}) error: {e}", file=sys.stderr)

    # Stage 2: OpenCV GrabCut
    try:
        result = remove_bg_grabcut(img_bytes)
        print("[rembg] Stage 2 GrabCut fallback: SUCCESS", file=sys.stderr)
        return result
    except Exception as e:
        print(f"[rembg] Stage 2 GrabCut failed: {e}", file=sys.stderr)

    # Stage 3: Color flood-fill
    try:
        result = remove_bg_colorfill(img_bytes)
        print("[rembg] Stage 3 ColorFill fallback: SUCCESS", file=sys.stderr)
        return result
    except Exception as e:
        print(f"[rembg] Stage 3 ColorFill failed: {e}", file=sys.stderr)
        raise RuntimeError("All background removal stages failed") from e


def main():
    parser = argparse.ArgumentParser(
        description="Pocket Frames Sticker Background Remover (powered by danielgatis/rembg)"
    )
    parser.add_argument("input", nargs="?", default="-", help="Input image path or - for stdin")
    parser.add_argument("output", nargs="?", default="-", help="Output PNG path or - for stdout")
    parser.add_argument(
        "--model",
        default=os.environ.get("REMBG_MODEL", "u2net"),
        help="rembg model name (default: u2net)"
    )
    parser.add_argument(
        "--alpha-matting",
        action="store_true",
        help="Use alpha matting post-processing"
    )
    args = parser.parse_args()

    try:
        if args.input == "-":
            img_bytes = sys.stdin.buffer.read()
        else:
            with open(args.input, "rb") as f:
                img_bytes = f.read()

        if len(img_bytes) == 0:
            raise ValueError("Input image data is empty")

        result = process_image(
            img_bytes,
            model_name=args.model,
            alpha_matting=args.alpha_matting
        )

        if args.output == "-":
            sys.stdout.buffer.write(result)
        else:
            with open(args.output, "wb") as f:
                f.write(result)
            print(f"[rembg] Saved output to {args.output}", file=sys.stderr)

        sys.exit(0)

    except Exception as e:
        print(f"[rembg] FATAL ERROR: {e}", file=sys.stderr)
        traceback.print_exc(file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()

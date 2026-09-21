#!/usr/bin/env python3
"""
Pocket Frames — Advanced Sticker Background Remover
====================================================
Uses a multi-stage approach for professional-quality background removal:

Stage 1: rembg (U2Net AI model) — best quality, neural net matting
Stage 2: OpenCV GrabCut + Pillow alpha matting — fast, geometry-based fallback
Stage 3: Edge-aware color-flood fill — basic guaranteed fallback

Usage:
    python remove_bg.py <input_path> <output_path>
    python remove_bg.py - -   (reads raw bytes from stdin, writes PNG to stdout)
"""

import sys
import os
import io
import base64
import argparse
import traceback

import numpy as np
from PIL import Image, ImageFilter


# ─── STAGE 1: rembg (U2Net AI neural net) ─────────────────────────────────────
def remove_bg_rembg(img_bytes: bytes) -> bytes:
    """Use rembg U2Net model for state-of-the-art background removal."""
    from rembg import remove as rembg_remove, new_session
    session = new_session("u2net")
    result = rembg_remove(img_bytes, session=session)
    return result


# ─── STAGE 2: OpenCV GrabCut + Pillow matting ─────────────────────────────────
def remove_bg_grabcut(img_bytes: bytes) -> bytes:
    """
    Multi-pass GrabCut segmentation with:
    - Automatic foreground rectangle estimation
    - Iterative refinement (10 passes)
    - Alpha matting with Gaussian edge softening
    - Morphological cleanup (erosion/dilation)
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
    pil_img = Image.fromarray(rgba, 'RGBA')

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
    pil_img.save(buf, format='PNG', optimize=True)
    return buf.getvalue()


# ─── STAGE 3: Color flood-fill fallback ──────────────────────────────────────
def remove_bg_colorfill(img_bytes: bytes) -> bytes:
    """
    Background removal using corner-color sampling + alpha thresholding.
    Works best for stickers with solid/uniform backgrounds.
    """
    pil_img = Image.open(io.BytesIO(img_bytes)).convert('RGBA')
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
    result_img = Image.fromarray(data.astype(np.uint8), 'RGBA')

    bbox = result_img.getbbox()
    if bbox:
        result_img = result_img.crop(bbox)
    result_img.thumbnail((512, 512), Image.LANCZOS)

    buf = io.BytesIO()
    result_img.save(buf, format='PNG', optimize=True)
    return buf.getvalue()


# ─── Main pipeline ────────────────────────────────────────────────────────────
def process_image(img_bytes: bytes) -> bytes:
    """Try background removal stages in order of quality."""
    # Stage 1: rembg neural net (best quality)
    try:
        result = remove_bg_rembg(img_bytes)
        print("[BgRemover] Stage 1 (rembg U2Net): SUCCESS", file=sys.stderr)
        return result
    except Exception as e:
        print(f"[BgRemover] Stage 1 (rembg) failed: {e}", file=sys.stderr)

    # Stage 2: GrabCut segmentation
    try:
        result = remove_bg_grabcut(img_bytes)
        print("[BgRemover] Stage 2 (GrabCut): SUCCESS", file=sys.stderr)
        return result
    except Exception as e:
        print(f"[BgRemover] Stage 2 (GrabCut) failed: {e}", file=sys.stderr)

    # Stage 3: Colour flood-fill (always works)
    try:
        result = remove_bg_colorfill(img_bytes)
        print("[BgRemover] Stage 3 (ColorFill): SUCCESS", file=sys.stderr)
        return result
    except Exception as e:
        print(f"[BgRemover] Stage 3 (ColorFill) failed: {e}", file=sys.stderr)
        raise RuntimeError("All background removal stages failed") from e


def main():
    parser = argparse.ArgumentParser(description='Pocket Frames background remover')
    parser.add_argument('input', nargs='?', default='-', help='Input image path or - for stdin')
    parser.add_argument('output', nargs='?', default='-', help='Output PNG path or - for stdout')
    args = parser.parse_args()

    try:
        if args.input == '-':
            img_bytes = sys.stdin.buffer.read()
        else:
            with open(args.input, 'rb') as f:
                img_bytes = f.read()

        result = process_image(img_bytes)

        if args.output == '-':
            sys.stdout.buffer.write(result)
        else:
            with open(args.output, 'wb') as f:
                f.write(result)
            print(f"[BgRemover] Saved to {args.output}", file=sys.stderr)

        sys.exit(0)

    except Exception as e:
        print(f"[BgRemover] FATAL ERROR: {e}", file=sys.stderr)
        traceback.print_exc(file=sys.stderr)
        sys.exit(1)


if __name__ == '__main__':
    main()

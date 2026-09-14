# Pocket Frames

A minimalist, high-resolution photography framing web application designed to frame photographs inside a fixed, deterministic Polaroid frame with clean Hasselblad-style typography and camera EXIF metadata.

Optimized for Instagram 4:5 portrait format at **2160 × 2700 px** (2× master) with zero unnecessary quality loss.

---

## Features

- **Deterministic Frame Geometry**: Fixed 4:5 aspect ratio with classic medium-format aperture ($1960 \times 1720\text{ px}$ in export space) and authentic Polaroid proportions.
- **Hasselblad & Camera Typography**: Wide-spaced italic branding (`H A S S E L B L A D`) and clean geometric sans-serif for Device (`OPPO Find X9`) and EXIF details (`FL`, `Aperture`, `Shutter`, `ISO`).
- **Canonical Coordinate System**: Transforms ($x$, $y$, scale) are maintained in export space ($2160 \times 2700$). What you see in preview matches the master export 1:1.
- **Dynamic Alignment & Red Crosshair**:
  - Center guides turn **Vivid Red (`#E53935`)** when the image is centered horizontally or vertically.
  - Magnetic snapping to center within $\pm 18\text{ px}$ (toggleable).
- **Client-Side EXIF & Orientation**:
  - Automatically reads camera parameters directly from uploaded photos via `exifr`.
  - Zero server uploads; 100% private and offline-capable.
  - Automatically normalizes EXIF orientation tags (1–8) for upright phone and camera shots.
- **Interactive Gestures & Presets**:
  - Smooth pan/drag, continuous zoom slider ($0.1\times$ – $5.0\times$), mouse wheel zoom, and touch pinch-to-zoom anchored at the gesture midpoint.
  - Mathematical **Fit**, **Fill**, and **Reset** presets.
- **Production Master Export**:
  - Master $2160 \times 2700\text{ px}$ (2×) and $1080 \times 1350\text{ px}$ (1×).
  - High-quality bicubic smoothing with deterministic font readiness check.
  - Dynamic filenames: `PocketFrames_[DEVICE]_[RESOLUTION].[EXT]`.
- **Workflow Tools**:
  - 30-step **Undo / Redo** (`Ctrl+Z` / `Ctrl+Y`).
  - IndexedDB auto-save to persist your session locally.
  - Clean preview mode (`Space`) to inspect frames without UI distractions.

---

## Getting Started

### Prerequisites
- Node.js (v18+)
- npm or pnpm

### Installation

```bash
# Clone the repository
git clone https://github.com/ritik328/Pocket-Frames.git
cd Pocket-Frames

# Install dependencies
npm install

# Start local dev server
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) in your browser.

### Build for Production

```bash
npm run build
```

---

## Keyboard Shortcuts

| Key | Action |
| --- | --- |
| `Arrow Keys` | Nudge photograph (export coordinates) |
| `Shift + Arrow Keys` | Fast nudge (40px) |
| `+` / `-` | Zoom in / Zoom out |
| `R` | Reset position & Fill aperture |
| `G` | Toggle alignment guides |
| `Space` | Toggle clean preview mode |
| `Ctrl + Z` | Undo |
| `Ctrl + Y` | Redo |
| `Esc` | Exit clean preview mode |

---

## License

MIT

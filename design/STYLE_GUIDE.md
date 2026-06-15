# Command Central — UI Style Guide

**System name: Organic Soft UI** — a calm, tactile interface using soft elevation,
muted organic colors, rounded surfaces, and nature-inspired data viz.

Feel: **calm, premium, soft, organic, tactile, slightly futuristic.** Not flat,
not corporate, not neon-cyberpunk. Physical cards, soft materials, glassy
surfaces, nature-inspired data objects in a polished dashboard.

## Chosen palette — Option A (Dark Organic Dashboard)
| Role | Hex |
| --- | --- |
| Background Deep | `#172126` |
| Background Raised (cards) | `#202C30` |
| Surface Soft | `#2B373A` |
| Border Subtle | `#3B4749` |
| Text Primary | `#E7ECE7` |
| Text Secondary | `#AAB5AD` |
| Green Accent (primary/charts) | `#A9D99B` |
| Mint Glow (focus/active) | `#BFFFD7` |
| Warm Sand (2nd chart accent) | `#D8B77F` |
| Soft Peach (alerts) | `#E9B38D` |
| Soft Blue (signal) | `#9EBECC` |

(Option B = light "Soft Material" alt, kept in reserve.)

## Principles
- **Soft dimensionality** — layered shadows, soft bevels, inner highlights, gentle
  glow on active states, rounded corners, raised surfaces. Nothing sharp/harsh.
- **Organic data viz** — waveforms, terrain-like area charts, rounded bars, radial/
  circular progress, soft layered shapes. Avoid harsh technical grids.
- **Calm contrast** — readable but softened; never harsh high-contrast.
- **Premium restraint** — mostly neutral, one or two accent colors used intentionally.

## Shape (radius)
small controls 8px · buttons/inputs 14–18px · cards 22–28px · large panels 32px ·
pills 999px. Generous but polished, not childish.

## Elevation (dark) — layered, not hard drop shadows
```
box-shadow: 0 22px 45px rgba(0,0,0,.35), 0 6px 16px rgba(0,0,0,.28),
            inset 0 1px 1px rgba(255,255,255,.08);
```
Active glow: `0 0 0 1px rgba(190,255,215,.7), 0 0 18px rgba(190,255,215,.45)` (soft, not RGB-gamer).

## Type
Sans (Inter / SF Pro / Satoshi / Geist / Manrope). Display 48–64/700, H1 36–44/700,
H2 28–32/600, H3 20–24/600, Body 15–17/400, Small 13–14/400, Caption 11–12/500.
Tabular numbers for data values.

## Spacing — 8px system
xs4 · sm8 · md16 · lg24 · xl32 · 2xl48 · 3xl64. Card padding 24–32px.

## Icons
Rounded, line-based, 1.5–2px stroke, minimal. Active icons can sit in small raised
circles/pills.

## Avoid
Pure black bg · pure white cards · harsh neon · flat Material defaults · heavy
glassmorphism blur everywhere · sharp 4px enterprise corners · generic blue primary
buttons · over-using the 3D/nature metaphor as decorative clutter.

---
*Implementation lives in `app/globals.css` (dark token block + `.soft-card`/`.hud-module`
elevation). This file is the reference; update both together.*

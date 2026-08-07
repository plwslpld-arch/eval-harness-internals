# Evalorium Brand Guide

## Evidence Gate

Evalorium’s formal mark is named **Evidence Gate**. It represents the product’s central promise: quality decisions must be based on measured evidence before release.

- The outer square is a controlled evaluation environment and a stable system boundary.
- The three negative-space channels are independent quality signals converging toward one decision.
- The iris gate is the release decision produced after calibration.
- The complete silhouette subtly references the letter **E** without reducing the mark to a literal monogram.

The generated exploration image in [`source-concept.png`](assets/brand/source-concept.png) records design provenance only. It is not a production logo and must not be used in project surfaces.

## Source of truth

SVG files are the only editable brand sources:

- [`evalorium-logo.svg`](assets/brand/evalorium-logo.svg) — primary horizontal lockup for light backgrounds.
- [`evalorium-logo-dark.svg`](assets/brand/evalorium-logo-dark.svg) — horizontal lockup for dark backgrounds.
- [`evalorium-mark.svg`](assets/brand/evalorium-mark.svg) — standalone primary mark.
- [`evalorium-mark-mono.svg`](assets/brand/evalorium-mark-mono.svg) — one-color mark.

PNG files are generated from the approved SVG sources with `npm run brand:render`. Never edit PNG derivatives directly.

## Palette

| Role | Name | Hex |
|---|---|---|
| Foundation | Midnight Navy | `#0B1020` |
| Primary accent | Electric Iris | `#6C63FF` |
| Auxiliary product color | Signal Mint | `#2DD4BF` |
| Dark-background foreground | Cloud White | `#F8FAFC` |

Signal Mint belongs to data visualization and product interfaces. It is not part of the primary logo.

## Clear space and minimum size

Keep clear space equal to at least one quarter of the mark width on every side. The standalone mark may be used down to 16 CSS pixels. The horizontal lockup must be at least 120 CSS pixels wide. At smaller sizes, use the mark alone.

## Approved usage

- Use the primary lockup on white and other light neutral backgrounds.
- Use the dark variant on Midnight Navy or similarly dark neutral backgrounds.
- Use the monochrome mark when only one ink or color is available.
- Preserve the supplied aspect ratio and clear space.

## Prohibited usage

Do not stretch, rotate, skew, outline, shadow, recolor, animate, or rearrange the mark. Do not add decorative gradients, separate the evidence channels, replace the wordmark, or use the generated exploration image as the logo.

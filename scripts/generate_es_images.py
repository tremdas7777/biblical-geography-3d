#!/usr/bin/env python3
"""
Spanish assets in assets/es/ are high-fidelity recreations of the English originals.

They were generated from the EN reference images with all visible text translated
to Spanish while preserving layout, typography and 3D style.

To regenerate (requires an image model with reference-image support):
  1. Use each file in assets/ as visual reference
  2. Recreate the image with identical composition
  3. Translate every label, title and caption to Spanish
  4. Save as WEBP quality 92 into assets/es/

Expected outputs (23 files):
  chapter-1.webp … chapter-9.webp
  bonus-1.webp, bonus-2.webp, bonus-3.webp, bonus-4.webp, bonus-6.webp
  bonus-tents-altars.webp, bonus-noahs-ark.webp, bonus-paul-journeys.webp
  hero-book.webp
  preview-1.webp, preview-6.webp, preview-9.webp
  visual-2.webp, visual-4.webp

Images without text (readers, caesarea-philippi) are shared between languages.
"""

from pathlib import Path

ES = Path(__file__).resolve().parents[1] / "assets" / "es"
EXPECTED = 23

if __name__ == "__main__":
    count = len(list(ES.glob("*.webp")))
    print(f"assets/es/: {count}/{EXPECTED} webp files")
    if count < EXPECTED:
        raise SystemExit("Missing Spanish assets — regenerate from EN references.")

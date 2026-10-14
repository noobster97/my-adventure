#!/usr/bin/env python3
"""Add a professional watermark to the resume PDF.

What it adds to every page:
  * a very faint diagonal name mark, embedded as an *image* so applicant
    tracking systems (ATS) that read the PDF's text never pick it up
  * a small footer line: name, link to the official copy, page number
It also sets the PDF's title/author details. The text layer of the resume is
left untouched, so it stays searchable and ATS-friendly.

Usage (run from the repo root, with your fresh, un-watermarked resume):
    pip install pypdf reportlab pillow
    python3 scripts/watermark-resume.py path/to/new-resume.pdf

It writes muhammad-syafiq-resume.pdf and public/muhammad-syafiq-resume.pdf.
"""

import io
import sys
from datetime import date
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont
from pypdf import PdfReader, PdfWriter
from reportlab.lib.colors import Color
from reportlab.lib.utils import ImageReader
from reportlab.pdfgen import canvas

NAME = "Muhammad Syafiq Md Asri"
MARK = "MUHAMMAD SYAFIQ"
SITE = "noobster97.github.io/my-adventure"
OUTPUTS = [Path("muhammad-syafiq-resume.pdf"), Path("public/muhammad-syafiq-resume.pdf")]
FONT_CANDIDATES = [
    "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
    "/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf",
    "/Library/Fonts/Arial Bold.ttf",
    "C:/Windows/Fonts/arialbd.ttf",
]


def mark_image(width_pt: float, height_pt: float) -> ImageReader:
    """Transparent PNG with one faint diagonal name mark across the page."""
    scale = 3
    w, h = int(width_pt * scale), int(height_pt * scale)
    font_path = next((p for p in FONT_CANDIDATES if Path(p).exists()), None)
    font = ImageFont.truetype(font_path, 50 * scale) if font_path else ImageFont.load_default()

    text_layer = Image.new("RGBA", (w * 2, h), (0, 0, 0, 0))
    draw = ImageDraw.Draw(text_layer)
    box = draw.textbbox((0, 0), MARK, font=font)
    tw, th = box[2] - box[0], box[3] - box[1]
    draw.text(((w * 2 - tw) / 2, (h - th) / 2), MARK, font=font, fill=(44, 62, 80, 14))

    rotated = text_layer.rotate(35, resample=Image.BICUBIC, expand=False)
    page = rotated.crop((w // 2, 0, w // 2 + w, h))
    buf = io.BytesIO()
    page.save(buf, format="PNG")
    buf.seek(0)
    return ImageReader(buf)


def overlay(width: float, height: float, page_no: int, pages: int) -> PdfReader:
    buf = io.BytesIO()
    c = canvas.Canvas(buf, pagesize=(width, height))
    c.drawImage(mark_image(width, height), 0, 0, width=width, height=height, mask="auto")

    grey = Color(0.47, 0.53, 0.57)
    c.setStrokeColor(Color(0.85, 0.87, 0.89))
    c.setLineWidth(0.5)
    c.line(42, 30, width - 42, 30)
    c.setFillColor(grey)
    c.setFont("Helvetica", 7.2)
    c.drawString(42, 19, f"{NAME}  |  Official copy: {SITE}")
    c.drawRightString(width - 42, 19, f"Page {page_no} of {pages}")
    c.save()
    buf.seek(0)
    return PdfReader(buf)


def main() -> None:
    if len(sys.argv) != 2:
        sys.exit(__doc__)
    source = PdfReader(sys.argv[1])
    writer = PdfWriter()
    pages = len(source.pages)
    for i, page in enumerate(source.pages, start=1):
        width, height = float(page.mediabox.width), float(page.mediabox.height)
        page.merge_page(overlay(width, height, i, pages).pages[0])
        writer.add_page(page)

    meta = dict(source.metadata or {})
    meta.update({
        "/Title": f"{NAME} - Software Developer Resume",
        "/Author": NAME,
        "/Subject": f"Resume of {NAME}. Official copy: https://{SITE}/",
        "/Keywords": "Software Developer, Full Stack, Laravel, PHP, MySQL, PostgreSQL, React, Malaysia",
        "/Creator": f"{NAME} ({date.today().isoformat()})",
    })
    writer.add_metadata(meta)

    for out in OUTPUTS:
        out.parent.mkdir(parents=True, exist_ok=True)
        with out.open("wb") as fh:
            writer.write(fh)
        print(f"wrote {out}")


if __name__ == "__main__":
    main()

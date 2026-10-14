#!/usr/bin/env python3
"""Stamp a new ?v= version on the site's own CSS/JS links.

Browsers (especially on phones) keep old copies of style.css, rate-card.js,
etc. A new ?v= value makes them fetch the fresh files right after a release.
Run it whenever you change any .css or .js file, then commit:

    python3 scripts/bump-version.py
"""

import re
from datetime import datetime
from pathlib import Path

FILES = [Path("index.html"), Path("rate-card-editor.html")]
LOCAL_ASSET = re.compile(r'((?:href|src)="(?!https?:)[\w./-]+\.(?:css|js|pdf))(?:\?v=[\w.-]+)?"')

version = datetime.now().strftime("%Y%m%d%H%M")
for path in FILES:
    text = path.read_text(encoding="utf-8")
    updated, count = LOCAL_ASSET.subn(rf'\1?v={version}"', text)
    path.write_text(updated, encoding="utf-8")
    print(f"{path}: {count} asset links -> v={version}")

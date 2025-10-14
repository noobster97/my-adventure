# Muhammad Syafiq – Portfolio

Static portfolio optimized for GitHub Pages.

## Run locally
This site loads content from JSON files in `data/`. Browsers block JSON fetches on `file://`, so run a local server:

- Python 3: `python -m http.server 5500`
- Node (serve): `npm i -g serve && serve .`
- VS Code: Live Server extension

Then open `http://localhost:5500` (or the URL you see) to preview.

### Using Laragon (Windows)
1. Place the project folder inside your Laragon `www` directory (e.g. `C:\laragon\www\my-adventure`).
2. Start Laragon and click Start All.
3. Access the site via `http://my-adventure.test/` (Auto Virtual Hosts must be enabled) or `http://localhost/my-adventure/`.

## Deploy to GitHub Pages
1. Create a new public repository named `noobster97.github.io` (or your `username.github.io`).
2. Add these files to the repo root: `index.html`, `404.html`, `profile.jpg`, and your resume PDF.
3. Commit and push to `main`. Pages will be live at `https://username.github.io/`.

Alternatively, for a project site:
- Push to any repo, then enable Pages: Settings → Pages → Deploy from branch → `main`/`root`.

## Customize
- Update `data/profile.json`, `data/experience.json`, `data/projects.json`, `data/skills.json`.
- Replace the resume PDF file name or path in `index.html` if needed.

## Notes
- No build tools needed. Fully static, fast, accessible, and mobile-friendly.
- Works without JS; progressive enhancements for cursor, animations, and typewriter.

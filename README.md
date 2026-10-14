# Muhammad Syafiq Portfolio

Static portfolio site for Muhammad Syafiq bin Md Asri.

## Local Development

Fastest Windows option:

```text
Double-click start-local.cmd
```

Keep the terminal window open while viewing the site. If the terminal is closed, `127.0.0.1` will refuse the connection because the local server has stopped.

Install dependencies:

```bash
npm install
```

On Windows PowerShell, use `npm.cmd install` if script execution policy blocks `npm`.

Run the local dev server:

```bash
npm run dev
```

On Windows PowerShell, use `npm.cmd run dev`.

Open:

```text
http://127.0.0.1:4173
```

## Build

```bash
npm run build
```

## Pages

The site is a single `index.html` that works like an app: `router.js` shows one page at a time
using hash links, so it runs on GitHub Pages with no server config and the back button works.

| Page | Link |
| --- | --- |
| Home | `#/` |
| Work | `#/work` |
| Rates | `#/rates` |
| About | `#/about` |
| Contact | `#/contact` |

Old one-page links (`#projects`, `#experience`, `#rates`, ...) still redirect to the right page.

## Rate Card

The rate card page (`#/rates`) is built from one file: **`data/rate-card.json`**.
There is no database. Visitors can build an estimate, send it on WhatsApp/email and
download the rate card as an image, but they can't change prices. Only someone with write access to this
GitHub repo can publish changes.

### Edit prices: option A, visual editor (on your computer)

1. `npm run dev` (or double-click `start-local.cmd`)
2. Open `http://127.0.0.1:4173/rate-card-editor.html`
3. Change packages, prices, add-ons and notes. The preview updates as you type.
4. Click **Save to file** and pick `data/rate-card.json` (Chrome/Edge), or **Download** and replace that file.
5. Commit and push. GitHub Pages publishes it.

The editor only works on `localhost`. On the live site it shows an "Owner only" screen.

### Edit prices: option B, straight on GitHub (works from your phone)

Open `data/rate-card.json` on GitHub, click the ✏️ pencil, edit the numbers and **Commit changes**.

Field reference:

| Field | Meaning |
| --- | --- |
| `price` | Number only, in your main currency (`meta.currency`) |
| `prefix` | Small text above the price, e.g. `"From"` (or `""`) |
| `suffix` / `unit` | Text after the price. `/month` or `/year` = recurring. Anything else (e.g. `/page`, `/hour`) gets a quantity stepper in the estimate |
| `popular` | `true` highlights the card as "Most popular" |
| `meta.secondaryCurrency` | Optional. Add `{ "code": "USD", "symbol": "$", "rate": 0.21 }` to show a currency toggle (off by default, RM only) |
| `meta.updated` | "Updated" date shown on the page and in the rate card image's reference |

The **Download rate card** button makes a one-page PNG in the browser from the same JSON, so it
always matches the site. A visitor's estimate is saved separately with **Save quote** (a PNG marked
"ESTIMATE" with a reference number that also appears in their WhatsApp message). Both images carry a
faint website watermark and a footer with a reference and the `validUntil` date.

## Resume watermark

The resume download carries a faint name watermark (embedded as an image, so ATS resume readers
ignore it), a footer with a link to the official copy, and proper PDF details. When you update your
resume, run the script on the new, un-watermarked file:

```bash
pip install pypdf reportlab pillow
python3 scripts/watermark-resume.py path/to/new-resume.pdf
```

It writes both `muhammad-syafiq-resume.pdf` and `public/muhammad-syafiq-resume.pdf`.

## Releasing changes (cache-busting)

Browsers, especially on phones, keep old copies of the site's CSS/JS for a while. Every CSS, JS
and resume link in `index.html` carries a `?v=` version so a new release is picked up straight
away. After changing any `.css`, `.js` or the resume PDF, run this before committing:

```bash
python3 scripts/bump-version.py
```

(Price changes in `data/rate-card.json` don't need it; that file is always fetched fresh.)

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

## Resume

The resume is **not** published on the site. The "Request my resume" buttons open WhatsApp with a
ready-made message, so you choose who receives it. Keep the PDF on your own computer.

Before sending it, you can add a faint name watermark (embedded as an image, so ATS resume
readers never see it):

```bash
pip install pypdf reportlab pillow
python3 scripts/watermark-resume.py path/to/new-resume.pdf
```

The script writes `muhammad-syafiq-resume.pdf` and `public/muhammad-syafiq-resume.pdf`. Send one
of them and do not commit either.

## Releasing changes (cache-busting)

Browsers, especially on phones, keep old copies of the site's CSS/JS for a while. Every CSS, JS
link in `index.html` carries a `?v=` version so a new release is picked up straight
away. After changing any `.css` or `.js` file, run this before committing:

```bash
python3 scripts/bump-version.py
```

(Price changes in `data/rate-card.json` don't need it; that file is always fetched fresh.)

## Paper Themes & Playful Bits

`themes.css` and `playful.js` add the interactive layer; the site works the same without them.

- **Paper switcher** (the "Paper" button in the top bar, or the round button on phones): Graph,
  Kraft, Blueprint and Chalkboard. The choice is saved in the browser. To add a paper, add a
  `html[data-paper="..."]` block in `themes.css` and an entry in `PAPERS` in `playful.js`.
- **Kertas the paper buddy** (bottom-left): its eyes follow the cursor, it waves when you come
  close and talks when clicked. Edit its lines in `LINES` in `playful.js`.
- **Hero doodles** drift with the cursor and dodge it; section title highlights redraw on hover.

All motion is switched off for visitors who ask for reduced motion.

On phones the doodles scatter from a tap, slide apart as you scroll and lean when the phone is
tilted (Android; iPhones don't share tilt without a permission pop-up, so we don't ask). Tapping
empty paper leaves a small ink burst, and first-time visitors get a one-off "Change the paper!" nudge.

## 3D Desk Tour (home page)

`desk.js` and `desk.css` turn the top of the home page into a 3D paper desk built with
[Three.js](https://threejs.org) (loaded from jsDelivr only on the home page, no build step).

- The page opens looking straight down at the desk (a flat 2D flat-lay beside the hero text). Scrolling
  tilts it into 3D and visits one object per stop, each with one card:
  **The desk → Work (photo stack) → Rates (price tag) → About (ID card) → Contact (paper plane)**.
- The desk is the current paper (Graph, Kraft, Blueprint, Chalkboard) drawn in 3D, fading into the distance.
- The object in focus gets the desk to itself: the others slide aside. Clicking an object scrolls to it.
- **Work:** the photos play each app's preview video (`assets/*-preview.mp4`). Videos only download
  at that stop, and never with reduced motion or Data Saver.
- **Rates:** tap the tag to flip it. The back shows the most popular package in each category, read
  from `data/rate-card.json`, so it always matches your prices.
- **Contact:** tap the plane or "WhatsApp me" and the plane flies off with your message.
- **Time of day:** the visitor's own clock sets the light. Evenings and nights switch on the desk lamp.
  Preview another time with `?desk-time=morning`, `day`, `evening` or `night` in the address.
- **Kertas** walks along as the tour guide: eyes follow the cursor, it blinks and waves, hops and talks
  when poked (three quick pokes = backflip), comments when you change the paper, welcomes returning
  visitors ("Welcome back! It's been 2 days"), and waves goodbye at the bottom of a page. Visits are
  counted only in the visitor's own browser.
- Edit the cards in `index.html` (`.tour-step` sections). Edit Kertas' lines in `STOP_LINES`,
  `POKE_LINES`, `PAPER_LINES` and `greeting()` in `desk.js`, and `LINES` in `playful.js`.
- If WebGL is missing, Data Saver is on, or Three.js can't load, the extra stops stay hidden and the
  home page works as a normal page.

## Site Shell

`shell.css` (loaded last) gives every page the same frame: the logo in the top-left corner, the paper
switch and **WhatsApp me** in the top-right (they scroll away with the page), and one bottom dock with
the pages (Home, Work, Rates, About, Contact) on every screen size.

## Visitor Stats

`analytics.js` sends page views and a few events to [Umami](https://umami.is) (no cookies).
It is **off** until you add your website ID:

1. Create a free Umami Cloud account, add this site and copy its **Website ID**.
2. Paste it into `index.html`: `<meta name="analytics-id" content="YOUR-ID">`.

Events tracked: page views per page, `whatsapp-click`, `email-click`, `resume-request`,
`outbound-click`, `estimate-add`, `paper-change`, `buddy-click`, `desk-pick`. Nothing is sent from localhost.

## Media

Screenshots are WebP (max 1600px wide) and load lazily; videos are muted H.264 with a poster image
and only download when their slide is showing. Keep new videos under ~1 MB, e.g.:

```bash
ffmpeg -i in.mp4 -an -c:v libx264 -preset slow -crf 30 -vf "fps=24,scale=1280:-2" -pix_fmt yuv420p -movflags +faststart out.mp4
```

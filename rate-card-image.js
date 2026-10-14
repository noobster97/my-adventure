// --- Rate Card & Quote Images ---
// Draws shareable PNGs on a canvas from the same JSON as the page:
//   • the rate card: one tall page, like a menu board
//   • a visitor's estimate: a separate quote image marked "ESTIMATE"
// Both carry a faint website watermark plus a reference and validity footer,
// so an edited or out-of-date copy is easy to spot.

import { convert, formatDate, formatNumber, isRecurring, startingPackage, unitOf } from './rate-card.js';

const INK = '#2c3e50';
const RED = '#e74c3c';
const YELLOW = '#f1c40f';
const STICKY = '#fff6c2';
const PAPER = '#fdfbf7';
const DIM = '#76828c';
const LINE = '#e3e7eb';
const HEAD = '"Patrick Hand", "Comic Sans MS", cursive';
const BODY = 'Outfit, "Segoe UI", Roboto, Arial, sans-serif';
const ICONS = '"Font Awesome 6 Free"';
const W = 1080;
const SCALE = 2;

async function ensureFonts() {
    const loads = [`400 40px "Patrick Hand"`, `400 20px Outfit`, `700 20px Outfit`, `900 30px ${ICONS}`]
        .map((f) => document.fonts?.load(f).catch(() => null));
    await Promise.all(loads);
}

// Font Awesome glyph for a class name like "fa-store" (empty if unavailable)
const glyphCache = new Map();
function glyph(name) {
    if (!name) return '';
    if (glyphCache.has(name)) return glyphCache.get(name);
    const probe = document.createElement('i');
    probe.className = `fas ${name}`;
    probe.style.cssText = 'position:absolute;left:-9999px;top:0';
    document.body.appendChild(probe);
    const content = getComputedStyle(probe, '::before').content.replace(/^["']|["']$/g, '');
    probe.remove();
    const value = content && content !== 'none' && content !== 'normal' ? content : '';
    glyphCache.set(name, value);
    return value;
}

function createCanvas(height) {
    const canvas = document.createElement('canvas');
    canvas.width = W * SCALE;
    canvas.height = Math.ceil(height * SCALE);
    const ctx = canvas.getContext('2d');
    ctx.scale(SCALE, SCALE);
    ctx.textBaseline = 'alphabetic';
    return { canvas, ctx };
}

function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
}

function box(ctx, x, y, w, h, { r = 18, fill = '#fff', stroke = INK, line = 3, shadow = INK, offset = 6 } = {}) {
    if (shadow) {
        ctx.fillStyle = shadow;
        roundRect(ctx, x + offset, y + offset, w, h, r);
        ctx.fill();
    }
    ctx.fillStyle = fill;
    roundRect(ctx, x, y, w, h, r);
    ctx.fill();
    if (stroke) {
        ctx.strokeStyle = stroke;
        ctx.lineWidth = line;
        ctx.stroke();
    }
}

function text(ctx, value, x, y, { font = `400 20px ${BODY}`, color = INK, align = 'left', maxWidth } = {}) {
    ctx.font = font;
    ctx.fillStyle = color;
    ctx.textAlign = align;
    let out = String(value ?? '');
    if (maxWidth && ctx.measureText(out).width > maxWidth) {
        while (out.length > 1 && ctx.measureText(`${out}…`).width > maxWidth) out = out.slice(0, -1);
        out = `${out.trimEnd()}…`;
    }
    ctx.fillText(out, x, y);
    return ctx.measureText(out).width;
}

function icon(ctx, name, cx, cy, size, color) {
    const g = glyph(name);
    if (!g) return;
    ctx.font = `900 ${size}px ${ICONS}`;
    ctx.fillStyle = color;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(g, cx, cy + 1);
    ctx.textBaseline = 'alphabetic';
}

function iconBadge(ctx, name, cx, cy, r, { fill = INK, color = YELLOW, square = false } = {}) {
    ctx.fillStyle = fill;
    if (square) {
        roundRect(ctx, cx - r, cy - r, r * 2, r * 2, r * 0.4);
        ctx.fill();
    } else {
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.fill();
    }
    icon(ctx, name, cx, cy, r * 1.05, color);
}

function paperBackground(ctx, height) {
    ctx.fillStyle = PAPER;
    ctx.fillRect(0, 0, W, height);
    ctx.strokeStyle = 'rgba(44, 62, 80, 0.05)';
    ctx.lineWidth = 1;
    for (let x = 0; x <= W; x += 24) {
        ctx.beginPath();
        ctx.moveTo(x + 0.5, 0);
        ctx.lineTo(x + 0.5, height);
        ctx.stroke();
    }
    for (let y = 0; y <= height; y += 24) {
        ctx.beginPath();
        ctx.moveTo(0, y + 0.5);
        ctx.lineTo(W, y + 0.5);
        ctx.stroke();
    }
}

// Faint diagonal text repeated across the whole image (drawn last, on top).
function watermark(ctx, height, label, { big } = {}) {
    ctx.save();
    ctx.translate(W / 2, height / 2);
    ctx.rotate(-Math.PI / 7);
    if (big) {
        ctx.globalAlpha = 0.07;
        ctx.font = `800 170px ${BODY}`;
        ctx.fillStyle = RED;
        ctx.textAlign = 'center';
        ctx.fillText(big, 0, 60);
    }
    ctx.globalAlpha = 0.05;
    ctx.font = `700 22px ${BODY}`;
    ctx.fillStyle = INK;
    ctx.textAlign = 'center';
    const span = Math.hypot(W, height);
    for (let row = -span / 2, i = 0; row < span / 2; row += 130, i += 1) {
        for (let col = -span / 2 + (i % 2) * 260; col < span / 2; col += 520) {
            ctx.fillText(label, col, row);
        }
    }
    ctx.restore();
}

function header(ctx, meta, title, subtitle, height = 190) {
    ctx.fillStyle = INK;
    ctx.fillRect(0, 0, W, height);
    ctx.fillStyle = YELLOW;
    ctx.fillRect(0, height, W, 8);
    text(ctx, title, 60, 92, { font: `400 72px ${HEAD}`, color: '#fff' });
    text(ctx, subtitle, 62, 136, { font: `500 24px ${BODY}`, color: '#d6dee4' });
    const phone = formatPhone(meta.whatsapp);
    let y = 70;
    [[phone, 'fa-phone'], [meta.email, 'fa-envelope'], [meta.website, 'fa-globe']].forEach(([value, ic]) => {
        if (!value) return;
        const w = text(ctx, value, W - 60, y, { font: `500 20px ${BODY}`, color: '#fff', align: 'right' });
        icon(ctx, ic, W - 60 - w - 18, y - 7, 18, YELLOW);
        y += 36;
    });
}

const formatPhone = (digits) => (digits ? `+${String(digits).replace(/^(\d{2})(\d{2})(\d{4})(\d+)$/, '$1 $2-$3 $4')}` : '');

function footerBand(ctx, meta, y, line) {
    ctx.fillStyle = RED;
    roundRect(ctx, 50, y, W - 100, 92, 22);
    ctx.fill();
    iconBadge(ctx, 'fa-comments', 104, y + 46, 28, { fill: '#fff', color: RED });
    text(ctx, 'Ready to start? Free chat, no obligation.', 148, y + 42, { font: `700 26px ${BODY}`, color: '#fff' });
    text(ctx, `WhatsApp ${formatPhone(meta.whatsapp)}`, 148, y + 74, { font: `500 22px ${BODY}`, color: '#ffe3df' });
    text(ctx, line, W / 2, y + 136, { font: `500 17px ${BODY}`, color: DIM, align: 'center' });
}

async function deliver(canvas, fileName, title) {
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
    if (!blob) throw new Error('Could not create image');
    const file = new File([blob], fileName, { type: 'image/png' });
    // On phones, the share sheet lets people save to Photos or send on WhatsApp.
    const touch = window.matchMedia('(pointer: coarse)').matches;
    if (touch && navigator.canShare?.({ files: [file] })) {
        try {
            await navigator.share({ files: [file], title });
            return 'shared';
        } catch (err) {
            if (err.name === 'AbortError') return 'cancelled';
        }
    }
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
    return 'downloaded';
}

const slug = (value) => String(value || 'Rate-Card').replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '');

// ================= Rate card (one page) =================
export async function downloadRateCardImage(data, { currency }) {
    await ensureFonts();
    const meta = data.meta || {};
    const categories = (data.categories || []).filter((c) => (c.packages || []).length);
    const addons = data.addons || [];
    const steps = meta.process || [];
    const perks = meta.perks || [];
    const money = (value) => `${currency.approx ? '≈' : ''}${currency.symbol} ${formatNumber(convert(value, currency))}`;

    const ROW = 78;
    const cardH = (c) => 88 + Math.min(c.packages.length, 3) * ROW + 12;
    const gridRows = [];
    for (let i = 0; i < categories.length; i += 2) gridRows.push(Math.max(...categories.slice(i, i + 2).map(cardH)));
    const addonRows = Math.ceil(addons.length / 2);
    const height = 198 + 96
        + gridRows.reduce((s, h) => s + h + 30, 0)
        + (steps.length ? 240 : 0)
        + (addons.length ? 70 + addonRows * 54 + 20 : 0)
        + (perks.length ? 110 : 0)
        + 190;

    const { canvas, ctx } = createCanvas(height);
    paperBackground(ctx, height);
    header(ctx, meta, meta.title || 'Rate Card', [meta.owner, meta.role].filter(Boolean).join('  ·  '));

    let y = 252;
    text(ctx, meta.subtitle || '', 60, y, { font: `400 30px ${HEAD}`, color: INK, maxWidth: W - 120 });
    y += 44;

    // Category cards, two per row
    const colW = (W - 120 - 30) / 2;
    gridRows.forEach((rowH, r) => {
        categories.slice(r * 2, r * 2 + 2).forEach((category, i) => {
            const x = 60 + i * (colW + 30);
            box(ctx, x, y, colW, rowH, { r: 22 });
            iconBadge(ctx, category.icon, x + 50, y + 46, 26);
            text(ctx, category.name, x + 90, y + 44, { font: `400 34px ${HEAD}`, maxWidth: colW - 110 });
            text(ctx, category.blurb || '', x + 90, y + 70, { font: `400 17px ${BODY}`, color: DIM, maxWidth: colW - 110 });

            category.packages.slice(0, 3).forEach((pkg, p) => {
                const ry = y + 88 + p * ROW;
                if (pkg.popular) {
                    ctx.fillStyle = STICKY;
                    roundRect(ctx, x + 12, ry + 4, colW - 24, ROW - 8, 14);
                    ctx.fill();
                }
                if (p > 0 && !pkg.popular && !category.packages[p - 1].popular) {
                    ctx.fillStyle = LINE;
                    ctx.fillRect(x + 24, ry, colW - 48, 2);
                }
                ctx.font = `800 26px ${BODY}`;
                const priceW = ctx.measureText(money(pkg.price)).width + 24;
                const nameW = text(ctx, pkg.name, x + 28, ry + 34, { font: `700 22px ${BODY}`, maxWidth: colW - priceW - 60 - (pkg.popular ? 24 : 0) });
                if (pkg.popular) icon(ctx, 'fa-star', x + 28 + nameW + 16, ry + 26, 16, RED);
                text(ctx, pkg.bestFor || pkg.tagline || '', x + 28, ry + 60, { font: `400 17px ${BODY}`, color: DIM, maxWidth: colW - priceW - 50 });
                text(ctx, money(pkg.price), x + colW - 28, ry + 36, { font: `800 26px ${BODY}`, color: pkg.popular ? RED : INK, align: 'right' });
                const note = [pkg.prefix && pkg.prefix.toLowerCase(), unitOf(pkg)].filter(Boolean).join(' · ') || pkg.timeline || '';
                text(ctx, note, x + colW - 28, ry + 60, { font: `500 16px ${BODY}`, color: DIM, align: 'right' });
            });
        });
        y += rowH + 30;
    });

    // How it works
    if (steps.length) {
        text(ctx, 'How it works', 60, y + 34, { font: `400 38px ${HEAD}` });
        const stepW = (W - 120) / steps.length;
        const cy = y + 100;
        ctx.setLineDash([10, 10]);
        ctx.strokeStyle = 'rgba(44, 62, 80, 0.35)';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(60 + stepW / 2, cy);
        ctx.lineTo(W - 60 - stepW / 2, cy);
        ctx.stroke();
        ctx.setLineDash([]);
        steps.forEach((step, i) => {
            const cx = 60 + stepW * i + stepW / 2;
            ctx.fillStyle = '#fff';
            ctx.strokeStyle = INK;
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.arc(cx, cy, 36, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();
            icon(ctx, step.icon, cx, cy, 30, RED);
            ctx.fillStyle = YELLOW;
            ctx.beginPath();
            ctx.arc(cx + 28, cy - 28, 14, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();
            text(ctx, String(i + 1), cx + 28, cy - 22, { font: `800 16px ${BODY}`, align: 'center' });
            text(ctx, step.title, cx, cy + 70, { font: `700 21px ${BODY}`, align: 'center' });
            text(ctx, step.text, cx, cy + 96, { font: `400 16px ${BODY}`, color: DIM, align: 'center', maxWidth: stepW - 16 });
        });
        y += 240;
    }

    // Add-ons
    if (addons.length) {
        text(ctx, 'Add-ons', 60, y + 34, { font: `400 38px ${HEAD}` });
        y += 62;
        const addW = (W - 120 - 40) / 2;
        addons.forEach((addon, i) => {
            const x = 60 + (i < addonRows ? 0 : addW + 40);
            const ry = y + (i % addonRows) * 54;
            icon(ctx, addon.icon, x + 14, ry + 22, 20, RED);
            text(ctx, addon.name, x + 40, ry + 30, { font: `500 20px ${BODY}`, maxWidth: addW - 170 });
            text(ctx, `+${money(addon.price)}${addon.unit || ''}`, x + addW, ry + 30, { font: `800 20px ${BODY}`, align: 'right' });
            ctx.fillStyle = LINE;
            ctx.fillRect(x, ry + 44, addW, 2);
        });
        y += addonRows * 54 + 20;
    }

    // Perks
    if (perks.length) {
        const perkW = (W - 120 - 18 * (perks.length - 1)) / perks.length;
        perks.forEach((perk, i) => {
            const x = 60 + i * (perkW + 18);
            box(ctx, x, y, perkW, 78, { r: 16, fill: STICKY, stroke: null, shadow: null });
            iconBadge(ctx, perk.icon, x + 36, y + 39, 20, { fill: '#fff', color: RED });
            const words = String(perk.text).split(' ');
            const half = Math.ceil(words.length / 2);
            [words.slice(0, half).join(' '), words.slice(half).join(' ')].forEach((lineText, l) => {
                text(ctx, lineText, x + 66, y + 34 + l * 24, { font: `600 17px ${BODY}`, maxWidth: perkW - 76 });
            });
        });
        y += 110;
    }

    const ref = `RC-${(meta.updated || '').replace(/-/g, '')}`;
    footerBand(ctx, meta, y, `Ref ${ref}  ·  Starting prices, valid until ${formatDate(meta.validUntil)}  ·  Final price after a free chat`);
    watermark(ctx, height, `${meta.website || ''}  ·  ${meta.owner || ''}`);

    return deliver(canvas, `${slug(meta.owner)}-Rate-Card.png`, `${meta.owner || ''} rate card`);
}

// ================= Quote (visitor's estimate) =================
export async function downloadQuoteImage(data, { currency, summary, quoteRef }) {
    await ensureFonts();
    const meta = data.meta || {};
    const lines = summary.lines;
    const money = (value) => `${currency.approx ? '≈' : ''}${currency.symbol} ${formatNumber(value)}`;
    const today = new Date();
    const validUntil = new Date(today.getTime() + 14 * 86400000);
    const iso = (d) => d.toISOString().slice(0, 10);

    const height = 198 + 120 + 60 + lines.length * 76 + 40 + 120 + summary.recurring.size * 36 + 110 + 190;
    const { canvas, ctx } = createCanvas(height);
    paperBackground(ctx, height);
    header(ctx, meta, 'Estimate', `Prepared for you by ${meta.owner || ''}`);

    let y = 240;
    [['Ref', quoteRef], ['Date', formatDate(iso(today))], ['Valid until', formatDate(iso(validUntil))]].forEach(([label, value], i) => {
        const x = 60 + i * 330;
        text(ctx, label.toUpperCase(), x, y, { font: `700 15px ${BODY}`, color: DIM });
        text(ctx, value, x, y + 32, { font: `700 24px ${BODY}` });
    });
    y += 80;

    const tableH = 56 + lines.length * 76;
    box(ctx, 60, y, W - 120, tableH, { r: 20 });
    text(ctx, 'ITEM', 92, y + 36, { font: `700 15px ${BODY}`, color: DIM });
    text(ctx, 'QTY', W - 290, y + 36, { font: `700 15px ${BODY}`, color: DIM, align: 'right' });
    text(ctx, 'AMOUNT', W - 92, y + 36, { font: `700 15px ${BODY}`, color: DIM, align: 'right' });
    lines.forEach((line, i) => {
        const ry = y + 56 + i * 76;
        ctx.fillStyle = LINE;
        ctx.fillRect(80, ry, W - 160, 2);
        iconBadge(ctx, line.entry.item.icon || line.entry.category?.icon || 'fa-plus', 112, ry + 38, 22, { square: true });
        text(ctx, line.entry.item.name, 150, ry + 34, { font: `700 22px ${BODY}`, maxWidth: W - 520 });
        text(ctx, line.entry.category ? line.entry.category.name : 'Add-on', 150, ry + 60, { font: `400 17px ${BODY}`, color: DIM });
        text(ctx, String(line.qty), W - 290, ry + 46, { font: `600 22px ${BODY}`, align: 'right' });
        text(ctx, `${money(line.amount)}${isRecurring(line.unit) ? line.unit : ''}`, W - 92, ry + 46, { font: `800 22px ${BODY}`, align: 'right' });
    });
    y += tableH + 40;

    box(ctx, W / 2 - 20, y, W / 2 - 40, 96, { r: 20, fill: STICKY });
    text(ctx, 'Estimated total', W / 2 + 8, y + 58, { font: `700 22px ${BODY}` });
    text(ctx, money(summary.total), W - 92, y + 62, { font: `800 38px ${BODY}`, color: RED, align: 'right' });
    y += 120;
    Array.from(summary.recurring).forEach(([unit, amount]) => {
        text(ctx, `+ ${money(amount)}${unit}`, W - 92, y + 10, { font: `800 22px ${BODY}`, color: RED, align: 'right' });
        y += 36;
    });

    text(ctx, 'This is an estimate from published starting prices, not a final quote.', 60, y + 30, { font: `500 19px ${BODY}`, color: DIM });
    text(ctx, 'The final price is confirmed after a free chat about what you need.', 60, y + 58, { font: `500 19px ${BODY}`, color: DIM });
    y += 110;

    footerBand(ctx, meta, y, `Ref ${quoteRef}  ·  Quote the ref when you message  ·  ${meta.website || ''}`);
    watermark(ctx, height, `${meta.website || ''}  ·  ESTIMATE ${quoteRef}`, { big: 'ESTIMATE' });

    return deliver(canvas, `Estimate-${quoteRef}.png`, `Estimate ${quoteRef}`);
}

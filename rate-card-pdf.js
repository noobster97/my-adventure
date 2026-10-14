// --- Rate Card PDF ---
// Builds a visual A4 rate card with jsPDF (loaded on demand from cdnjs) from
// the same JSON as the page, so the download never drifts from the website.
//   Page 1: at a glance (what do you need, how it works, perks, add-ons)
//   Page 2: package cards
//   Page 3: the visitor's estimate, when they built one

import { convert, formatDate, formatNumber, isRecurring, startingPackage, unitOf } from './rate-card.js';

const JSPDF_URL = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';

const INK = [44, 62, 80];
const RED = [231, 76, 60];
const YELLOW = [241, 196, 15];
const STICKY = [255, 249, 205];
const PAPER = [253, 251, 247];
const DIM = [118, 130, 140];
const LINE = [225, 229, 233];
const WHITE = [255, 255, 255];

let jsPdfPromise;
function loadJsPdf() {
    if (window.jspdf?.jsPDF) return Promise.resolve(window.jspdf.jsPDF);
    jsPdfPromise ??= new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = JSPDF_URL;
        script.crossOrigin = 'anonymous';
        script.onload = () => (window.jspdf?.jsPDF ? resolve(window.jspdf.jsPDF) : reject(new Error('jsPDF missing')));
        script.onerror = () => { jsPdfPromise = null; reject(new Error('Failed to load jsPDF')); };
        document.head.appendChild(script);
    });
    return jsPdfPromise;
}

// Standard PDF fonts only cover WinAnsi, so swap characters they can't draw.
const pdfText = (value) => String(value ?? '')
    .replace(/[≈]/g, '~')
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[^\x20-\x7E -ÿ–—•]/g, '');

// Renders a Font Awesome icon (already loaded by the page) to a PNG so the
// PDF uses the same icons as the website. Returns null if the font isn't available.
async function renderIcons(names, color) {
    const family = '"Font Awesome 6 Free"';
    const icons = new Map();
    try {
        await document.fonts.load(`900 64px ${family}`);
    } catch { /* fall through: icons are optional */ }
    if (!document.fonts.check(`900 64px ${family}`)) return icons;

    const probe = document.createElement('i');
    probe.style.cssText = 'position:absolute;left:-9999px;top:0';
    document.body.appendChild(probe);
    const px = 128;
    const canvas = document.createElement('canvas');
    canvas.width = px;
    canvas.height = px;
    const ctx = canvas.getContext('2d');
    new Set(names.filter(Boolean)).forEach((name) => {
        probe.className = `fas ${name}`;
        const glyph = getComputedStyle(probe, '::before').content.replace(/^["']|["']$/g, '');
        if (!glyph || glyph === 'none' || glyph === 'normal') return;
        ctx.clearRect(0, 0, px, px);
        ctx.font = `900 ${px * 0.7}px ${family}`;
        ctx.fillStyle = `rgb(${color.join(',')})`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(glyph, px / 2, px / 2 + px * 0.02);
        icons.set(name, canvas.toDataURL('image/png'));
    });
    probe.remove();
    return icons;
}

export async function downloadRateCardPdf(data, { currency, summary } = {}) {
    const JsPDF = await loadJsPdf();
    const doc = new JsPDF({ unit: 'mm', format: 'a4' });
    const meta = data.meta || {};
    const categories = (data.categories || []).filter((c) => (c.packages || []).length);
    const addons = data.addons || [];
    const W = 210;
    const H = 297;
    const M = 15;
    const CW = W - M * 2;
    const approx = currency.approx ? '~' : '';
    const money = (value) => `${approx}${currency.symbol} ${formatNumber(value)}`;
    const phone = meta.whatsapp ? `+${meta.whatsapp.replace(/^(\d{2})(\d{2})(\d{4})(\d+)$/, '$1 $2-$3 $4')}` : '';

    const iconNames = [
        ...categories.flatMap((c) => [c.icon, ...c.packages.map((p) => p.icon)]),
        ...(meta.process || []).map((s) => s.icon),
        ...(meta.perks || []).map((p) => p.icon),
        ...addons.map((a) => a.icon)
    ];
    const [yellowIcons, redIcons] = await Promise.all([renderIcons(iconNames, YELLOW), renderIcons(iconNames, RED)]);
    let y = 0;

    const font = (style, size, color = INK) => {
        doc.setFont('helvetica', style);
        doc.setFontSize(size);
        doc.setTextColor(...color);
    };
    const textW = (text, size) => doc.getStringUnitWidth(text) * size / doc.internal.scaleFactor;
    const icon = (set, name, x, yy, size) => {
        const png = set.get(name);
        if (png) doc.addImage(png, 'PNG', x, yy, size, size);
    };
    // Icon badge: filled circle/square with the icon centred in it
    const badge = (name, cx, cy, r, { fill = INK, set = yellowIcons, square = false } = {}) => {
        doc.setFillColor(...fill);
        if (square) doc.roundedRect(cx - r, cy - r, r * 2, r * 2, r * 0.35, r * 0.35, 'F');
        else doc.circle(cx, cy, r, 'F');
        icon(set, name, cx - r * 0.62, cy - r * 0.62, r * 1.24);
    };
    const heading = (text, x = M) => {
        font('bold', 14);
        doc.text(pdfText(text), x, y);
        doc.setFillColor(...YELLOW);
        doc.rect(x, y + 1.4, Math.min(textW(pdfText(text), 14), 60), 1.6, 'F');
        y += 9;
    };
    const header = (title, sub) => {
        doc.setFillColor(...INK);
        doc.rect(0, 0, W, 27, 'F');
        doc.setFillColor(...YELLOW);
        doc.rect(0, 27, W, 1.5, 'F');
        font('bold', 20, WHITE);
        doc.text(pdfText(title), M, 13);
        font('normal', 9.5, [214, 222, 228]);
        doc.text(pdfText(sub), M, 20);
        font('normal', 8.5, WHITE);
        [meta.email, phone, meta.website].filter(Boolean).forEach((line, i) => {
            doc.text(pdfText(line), W - M, 9.5 + i * 4.8, { align: 'right' });
        });
        y = 38;
    };
    const cta = () => {
        doc.setFillColor(...RED);
        doc.roundedRect(M, y, CW, 11, 2, 2, 'F');
        font('bold', 10, WHITE);
        doc.text('Ready to start? Free chat, no obligation.', M + 5, y + 7);
        font('normal', 9, WHITE);
        doc.text(pdfText(`WhatsApp ${phone}`), W - M - 5, y + 7, { align: 'right' });
        y += 15;
    };

    // ================= Page 1: at a glance =================
    header(meta.title || 'Rate Card', [meta.owner, meta.role].filter(Boolean).join('  |  '));
    font('normal', 10, INK);
    doc.text(pdfText(meta.subtitle || ''), M, y);
    font('normal', 7.8, DIM);
    doc.text(pdfText([
        `All prices in ${currency.code || currency.symbol}`,
        meta.validUntil && `valid until ${formatDate(meta.validUntil)}`
    ].filter(Boolean).join('  •  ')), M, y + 4.6);
    y += 14;

    heading('What do you need?');
    const tileGap = 6;
    const tileW = (CW - tileGap) / 2;
    const tileH = 30;
    categories.forEach((category, i) => {
        const x = M + (i % 2) * (tileW + tileGap);
        const ty = y + Math.floor(i / 2) * (tileH + tileGap);
        doc.setFillColor(...WHITE);
        doc.setDrawColor(...INK);
        doc.setLineWidth(0.6);
        doc.roundedRect(x, ty, tileW, tileH, 3, 3, 'FD');
        badge(category.icon, x + 13, ty + tileH / 2, 8);
        font('bold', 13);
        doc.text(pdfText(category.name), x + 25, ty + 10.5);
        font('normal', 8.4, DIM);
        doc.text(pdfText(category.blurb || ''), x + 25, ty + 15.5);
        const start = startingPackage(category);
        font('normal', 7.6, DIM);
        doc.text('from', x + 25, ty + 23.5);
        font('bold', 14, RED);
        const price = pdfText(money(convert(start.price, currency)));
        doc.text(price, x + 32, ty + 24);
        if (unitOf(start)) {
            font('normal', 8, DIM);
            doc.text(pdfText(unitOf(start)), x + 33 + textW(price, 14), ty + 24);
        }
    });
    y += Math.ceil(categories.length / 2) * (tileH + tileGap) + 6;

    const steps = meta.process || [];
    if (steps.length) {
        heading('How it works');
        const stepW = CW / steps.length;
        doc.setDrawColor(...INK);
        doc.setLineWidth(0.5);
        doc.setLineDashPattern([1.5, 1.5], 0);
        doc.line(M + stepW / 2, y + 8, M + CW - stepW / 2, y + 8);
        doc.setLineDashPattern([], 0);
        steps.forEach((step, i) => {
            const cx = M + stepW * i + stepW / 2;
            doc.setFillColor(...WHITE);
            doc.setDrawColor(...INK);
            doc.setLineWidth(0.6);
            doc.circle(cx, y + 8, 8, 'FD');
            icon(redIcons, step.icon, cx - 4.6, y + 3.4, 9.2);
            doc.setFillColor(...YELLOW);
            doc.circle(cx + 6, y + 2.4, 2.8, 'FD');
            font('bold', 7.5);
            doc.text(String(i + 1), cx + 6, y + 3.5, { align: 'center' });
            font('bold', 10.5);
            doc.text(pdfText(step.title), cx, y + 22, { align: 'center' });
            font('normal', 8, DIM);
            doc.text(pdfText(step.text), cx, y + 26.5, { align: 'center' });
        });
        y += 36;
    }

    const perks = meta.perks || [];
    if (perks.length) {
        const perkW = (CW - 3 * (perks.length - 1)) / perks.length;
        perks.forEach((perk, i) => {
            const x = M + i * (perkW + 3);
            doc.setFillColor(...STICKY);
            doc.roundedRect(x, y, perkW, 15, 2, 2, 'F');
            badge(perk.icon, x + 7, y + 7.5, 4.4, { fill: WHITE, set: redIcons });
            font('bold', 7.8);
            doc.text(doc.splitTextToSize(pdfText(perk.text), perkW - 15), x + 13.5, y + 6.4);
        });
        y += 22;
    }

    if (addons.length) {
        heading('Add-ons');
        const half = Math.ceil(addons.length / 2);
        const colW = (CW - 8) / 2;
        addons.forEach((addon, i) => {
            const x = M + (i < half ? 0 : colW + 8);
            const ry = y + (i % half) * 8;
            icon(redIcons, addon.icon, x, ry - 1, 5);
            font('normal', 9);
            doc.text(pdfText(addon.name), x + 7.5, ry + 2.8);
            font('bold', 9.2);
            doc.text(pdfText(`+${money(convert(addon.price, currency))}${addon.unit || ''}`), x + colW, ry + 2.8, { align: 'right' });
            doc.setDrawColor(...LINE);
            doc.setLineWidth(0.25);
            doc.line(x, ry + 5.4, x + colW, ry + 5.4);
        });
        y += half * 8 + 4;
    }

    if ((meta.notes || []).length) {
        font('italic', 7.6, DIM);
        const notes = doc.splitTextToSize(pdfText(meta.notes.join(' ')), CW);
        doc.text(notes, M, y);
        y += notes.length * 3.4 + 4;
    }
    y = Math.max(y, H - 30);
    cta();

    // ================= Page 2: packages =================
    doc.addPage();
    doc.setFillColor(...PAPER);
    doc.rect(0, 0, W, H, 'F');
    y = 17;
    font('bold', 17);
    doc.text('Packages & prices', M, y);
    font('normal', 8.5, DIM);
    doc.text(pdfText(`${meta.owner || ''}  |  ${phone}`), W - M, y, { align: 'right' });
    y += 7;

    const gap = 4;
    const cardW = (CW - gap * 2) / 3;
    categories.forEach((category) => {
        doc.setFillColor(...INK);
        doc.roundedRect(M, y, CW, 7, 1.5, 1.5, 'F');
        icon(yellowIcons, category.icon, M + 2.5, y + 1.2, 4.6);
        font('bold', 9.5, WHITE);
        doc.text(pdfText(category.name.toUpperCase()), M + 9, y + 4.8);
        font('normal', 7.8, [190, 200, 208]);
        doc.text(pdfText(category.blurb || ''), M + 12 + textW(pdfText(category.name.toUpperCase()), 9.5), y + 4.8);
        y += 10;

        const cardH = 45;
        category.packages.slice(0, 3).forEach((pkg, i) => {
            const x = M + i * (cardW + gap);
            doc.setFillColor(...(pkg.popular ? STICKY : WHITE));
            doc.setDrawColor(...(pkg.popular ? INK : LINE));
            doc.setLineWidth(pkg.popular ? 0.7 : 0.35);
            doc.roundedRect(x, y, cardW, cardH, 2.5, 2.5, 'FD');
            if (pkg.popular) {
                doc.setFillColor(...RED);
                doc.roundedRect(x + cardW - 23, y - 2.4, 21, 4.8, 1.2, 1.2, 'F');
                font('bold', 6.2, WHITE);
                doc.text('MOST POPULAR', x + cardW - 12.5, y + 0.8, { align: 'center' });
            }

            badge(pkg.icon || category.icon, x + 8, y + 9, 4.6, { square: true });
            font('bold', 10.5);
            doc.text(doc.splitTextToSize(pdfText(pkg.name), cardW - 18)[0], x + 15, y + 10.4);

            // "Best for" pill + text
            doc.setFillColor(...RED);
            doc.roundedRect(x + 3.5, y + 16, 13, 3.8, 1.9, 1.9, 'F');
            font('bold', 5.6, WHITE);
            doc.text('BEST FOR', x + 10, y + 18.6, { align: 'center' });
            font('normal', 7.6, INK);
            doc.text(doc.splitTextToSize(pdfText(pkg.bestFor || pkg.tagline || ''), cardW - 20)[0], x + 18.2, y + 18.8);

            // Price (left) and timeline pill (right)
            let px = x + 3.5;
            if (pkg.prefix) {
                font('normal', 7, DIM);
                doc.text(pdfText(pkg.prefix.toLowerCase()), px, y + 28.6);
                px += textW(pdfText(pkg.prefix.toLowerCase()), 7) + 1;
            }
            const price = pdfText(money(convert(pkg.price, currency)));
            font('bold', 13.5);
            doc.text(price, px, y + 29);
            const unit = unitOf(pkg);
            if (unit) {
                font('normal', 7.4, DIM);
                doc.text(pdfText(unit), px + textW(price, 13.5) + 0.6, y + 29);
            }
            if (pkg.timeline && !/month|demand/i.test(pkg.timeline)) {
                font('bold', 6.4, INK);
                const tw = textW(pdfText(pkg.timeline), 6.4) + 5;
                doc.setFillColor(...PAPER);
                doc.setDrawColor(...LINE);
                doc.setLineWidth(0.3);
                doc.roundedRect(x + cardW - 3.5 - tw, y + 24.4, tw, 4.6, 2.3, 2.3, 'FD');
                doc.text(pdfText(pkg.timeline), x + cardW - 3.5 - tw / 2, y + 27.6, { align: 'center' });
            }

            // Features with ticks
            (pkg.features || []).slice(0, 3).forEach((feature, fi) => {
                const fy = y + 34 + fi * 4.2;
                doc.setDrawColor(...RED);
                doc.setLineWidth(0.55);
                doc.line(x + 4, fy - 1.1, x + 5, fy - 0.1);
                doc.line(x + 5, fy - 0.1, x + 6.8, fy - 2.4);
                font('normal', 8.2, INK);
                doc.text(doc.splitTextToSize(pdfText(feature), cardW - 13)[0], x + 8.8, fy);
            });
        });
        y += cardH + 5;
    });
    y = Math.max(y + 1, H - 30);
    cta();

    // ================= Page 3: the visitor's estimate =================
    if (summary?.lines?.length) {
        doc.addPage();
        header('Your Estimate', `Prepared on ${formatDate(new Date().toISOString().slice(0, 10))} from the ${meta.owner || ''} rate card`);
        const tableHead = () => {
            doc.setFillColor(244, 246, 248);
            doc.rect(M, y, CW, 6.4, 'F');
            font('bold', 6.8, DIM);
            doc.text('ITEM', M + 3, y + 4.2);
            doc.text('QTY', M + 128, y + 4.2, { align: 'right' });
            doc.text('AMOUNT', W - M - 3, y + 4.2, { align: 'right' });
            y += 6.4;
        };
        tableHead();
        summary.lines.forEach((line) => {
            if (y + 11 > H - 40) {
                doc.addPage();
                y = 18;
                tableHead();
            }
            const group = line.entry.category ? line.entry.category.name : 'Add-on';
            icon(redIcons, line.entry.item.icon || line.entry.category?.icon, M + 2, y + 2.4, 5.4);
            font('bold', 9.4);
            doc.text(pdfText(line.entry.item.name), M + 10, y + 5.2);
            font('normal', 7.4, DIM);
            doc.text(pdfText(group), M + 10, y + 8.6);
            font('normal', 9, INK);
            doc.text(String(line.qty), M + 128, y + 5.2, { align: 'right' });
            font('bold', 9.4);
            doc.text(pdfText(`${money(line.amount)}${isRecurring(line.unit) ? line.unit : ''}`), W - M - 3, y + 5.2, { align: 'right' });
            y += 11;
            doc.setDrawColor(...LINE);
            doc.setLineWidth(0.25);
            doc.line(M, y, W - M, y);
        });
        y += 4;
        doc.setFillColor(...STICKY);
        doc.roundedRect(M + CW / 2, y, CW / 2, 12, 2, 2, 'F');
        font('bold', 9.5);
        doc.text('Estimated total', M + CW / 2 + 4, y + 7.6);
        font('bold', 14, RED);
        doc.text(pdfText(money(summary.total)), W - M - 3, y + 8, { align: 'right' });
        y += 12;
        Array.from(summary.recurring || []).forEach(([unit, amount]) => {
            font('bold', 9, RED);
            doc.text(pdfText(`+ ${money(amount)}${unit}`), W - M - 3, y + 5, { align: 'right' });
            y += 5.5;
        });
        y += 8;
        font('italic', 8, DIM);
        doc.text(doc.splitTextToSize('This is an estimate based on starting prices. The final price is confirmed after a free chat about what you need.', CW), M, y);
        y = Math.max(y + 12, H - 30);
        cta();
    }

    // Footer on every page
    const pages = doc.getNumberOfPages();
    for (let p = 1; p <= pages; p += 1) {
        doc.setPage(p);
        doc.setDrawColor(...LINE);
        doc.setLineWidth(0.2);
        doc.line(M, H - 11, W - M, H - 11);
        font('normal', 7.2, DIM);
        doc.text(pdfText(`${meta.owner || ''}  |  ${meta.website || ''}`), M, H - 6.5);
        doc.text(`Page ${p} of ${pages}`, W - M, H - 6.5, { align: 'right' });
    }

    const fileName = `${(meta.owner || 'Rate Card').replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '')}-Rate-Card.pdf`;
    doc.save(fileName);
}

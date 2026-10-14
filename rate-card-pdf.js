// --- Rate Card PDF ---
// Draws a vector A4 rate card with jsPDF (loaded on demand from cdnjs), using
// the same JSON as the page so the download never drifts from the website.

import { convert, formatDate, formatNumber, isRecurring, unitOf } from './rate-card.js';

const JSPDF_URL = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';

const INK = [44, 62, 80];
const RED = [231, 76, 60];
const YELLOW = [241, 196, 15];
const STICKY = [254, 249, 195];
const DIM = [127, 140, 141];
const LINE = [214, 219, 223];

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

export async function downloadRateCardPdf(data, { currency, summary } = {}) {
    const JsPDF = await loadJsPdf();
    const doc = new JsPDF({ unit: 'mm', format: 'a4' });
    const meta = data.meta || {};
    const W = 210;
    const H = 297;
    const M = 16;
    const contentW = W - M * 2;
    const money = (value) => `${currency.approx ? '~' : ''}${currency.symbol} ${formatNumber(convert(value, currency))}`;
    let y = 0;

    const setColor = (rgb) => doc.setTextColor(...rgb);
    const font = (style = 'normal', size = 9) => { doc.setFont('helvetica', style); doc.setFontSize(size); };
    const ensure = (needed) => {
        if (y + needed > H - 18) {
            doc.addPage();
            y = 18;
        }
    };

    // Header band
    doc.setFillColor(...INK);
    doc.rect(0, 0, W, 40, 'F');
    doc.setFillColor(...YELLOW);
    doc.rect(0, 40, W, 2.2, 'F');
    font('bold', 26);
    setColor([255, 255, 255]);
    doc.text(pdfText((meta.title || 'Rate Card').toUpperCase()), M, 19);
    font('normal', 11);
    doc.text(pdfText([meta.owner, meta.role].filter(Boolean).join('  |  ')), M, 27);
    font('normal', 8.5);
    doc.setTextColor(220, 226, 230);
    const phone = meta.whatsapp ? `+${meta.whatsapp.replace(/^(\d{2})(\d{2})(\d{4})(\d+)$/, '$1 $2-$3 $4')}` : '';
    [meta.email, phone, meta.website].filter(Boolean).forEach((line, i) => {
        doc.text(pdfText(line), W - M, 15 + i * 5.5, { align: 'right' });
    });
    font('normal', 8);
    doc.setTextColor(200, 208, 214);
    const dates = [
        meta.updated && `Updated ${formatDate(meta.updated)}`,
        meta.validUntil && `Valid until ${formatDate(meta.validUntil)}`,
        currency.approx && `Prices converted from ${meta.currency} at ${meta.secondaryCurrency.rate}`
    ].filter(Boolean).join('   |   ');
    doc.text(pdfText(dates), M, 34.5);

    y = 50;
    if (meta.subtitle) {
        font('italic', 10);
        setColor(DIM);
        const lines = doc.splitTextToSize(pdfText(meta.subtitle), contentW);
        doc.text(lines, M, y);
        y += lines.length * 4.6 + 3;
    }

    // Compact price list: categories in a 2-column grid, one row per package
    const gap = 8;
    const colW = (contentW - gap) / 2;
    const categories = (data.categories || []).filter((c) => (c.packages || []).length);

    const layoutCategory = (category) => {
        font('normal', 7.5);
        const blurb = category.blurb ? doc.splitTextToSize(pdfText(category.blurb), colW) : [];
        const rows = category.packages.map((pkg) => {
            font('normal', 7.3);
            const detail = doc.splitTextToSize(pdfText([pkg.tagline, ...(pkg.features || [])].filter(Boolean).join('  \u2022  ')), colW - 6);
            return { pkg, detail, height: 11 + detail.length * 3.2 };
        });
        const height = 7 + blurb.length * 3.3 + 2 + rows.reduce((sum, r) => sum + r.height, 0);
        return { category, blurb, rows, height };
    };

    const drawCategory = (layout, x, top, blurbLines) => {
        let cy = top;
        doc.setFillColor(...RED);
        doc.rect(x, cy - 3.4, 2.2, 4.4, 'F');
        font('bold', 12);
        setColor(INK);
        doc.text(pdfText(layout.category.name), x + 4.5, cy);
        cy += 4.6;
        font('normal', 7.5);
        setColor(DIM);
        if (layout.blurb.length) {
            doc.text(layout.blurb, x, cy);
        }
        cy += blurbLines * 3.3;
        cy += 1.5;

        layout.rows.forEach(({ pkg, detail, height }) => {
            if (pkg.popular) {
                doc.setFillColor(...STICKY);
                doc.setDrawColor(...INK);
                doc.setLineWidth(0.4);
                doc.roundedRect(x - 1.5, cy, colW + 3, height - 1.2, 1.5, 1.5, 'FD');
            } else {
                doc.setDrawColor(...LINE);
                doc.setLineWidth(0.25);
                doc.line(x, cy + height - 0.6, x + colW, cy + height - 0.6);
            }
            const base = cy + 5;
            font('bold', 10);
            setColor(INK);
            doc.text(pdfText(pkg.name), x + 1.5, base);
            if (pkg.popular) {
                const nameW = doc.getStringUnitWidth(pdfText(pkg.name)) * 10 / doc.internal.scaleFactor;
                doc.setFillColor(...RED);
                doc.roundedRect(x + 3.5 + nameW, base - 3.1, 15, 3.9, 0.8, 0.8, 'F');
                font('bold', 5.6);
                setColor([255, 255, 255]);
                doc.text('POPULAR', x + 11 + nameW, base - 0.3, { align: 'center' });
            }

            // Price block, right-aligned: [from] RM 1,800 [/month]
            const unit = unitOf(pkg);
            const right = x + colW - 1.5;
            let px = right;
            if (unit) {
                font('normal', 7.5);
                setColor(DIM);
                doc.text(pdfText(unit), px, base, { align: 'right' });
                px -= doc.getStringUnitWidth(pdfText(unit)) * 7.5 / doc.internal.scaleFactor + 0.6;
            }
            font('bold', 11.5);
            setColor(INK);
            const price = pdfText(money(pkg.price));
            doc.text(price, px, base, { align: 'right' });
            px -= doc.getStringUnitWidth(price) * 11.5 / doc.internal.scaleFactor + 1.2;
            if (pkg.prefix) {
                font('normal', 6.8);
                setColor(DIM);
                doc.text(pdfText(pkg.prefix.toLowerCase()), px, base, { align: 'right' });
            }

            if (pkg.timeline) {
                font('normal', 6.8);
                setColor(RED);
                doc.text(pdfText(pkg.timeline), x + 1.5, base + 3.6);
            }
            font('normal', 7.3);
            doc.setTextColor(85, 98, 112);
            doc.text(detail, x + 1.5, base + 7.4);
            cy += height;
        });
    };

    for (let i = 0; i < categories.length; i += 2) {
        const pair = categories.slice(i, i + 2).map(layoutCategory);
        const blurbLines = Math.max(...pair.map((l) => l.blurb.length));
        const rowH = Math.max(...pair.map((l) => l.height + (blurbLines - l.blurb.length) * 3.3));
        ensure(rowH + 4);
        pair.forEach((layout, col) => drawCategory(layout, M + col * (colW + gap), y, blurbLines));
        y += rowH + 6;
    }

    // Add-ons
    const addons = data.addons || [];
    if (addons.length) {
        ensure(14 + Math.ceil(addons.length / 2) * 9);
        doc.setFillColor(...RED);
        doc.rect(M, y - 3.4, 2.4, 4.4, 'F');
        font('bold', 13);
        setColor(INK);
        doc.text('Add-ons', M + 5, y);
        y += 6;
        const addonW = (contentW - gap) / 2;
        const half = Math.ceil(addons.length / 2);
        const columnY = [y, y];
        addons.forEach((addon, i) => {
            const col = i < half ? 0 : 1;
            const x = M + col * (addonW + gap);
            const ry = columnY[col];
            font('normal', 8.3);
            setColor(INK);
            const name = doc.splitTextToSize(pdfText(addon.name), addonW - 28).slice(0, 2);
            doc.text(name, x, ry);
            font('bold', 8.5);
            doc.text(pdfText(`${money(addon.price)}${addon.unit || ''}`), x + addonW, ry, { align: 'right' });
            const rowEnd = ry + (name.length - 1) * 3.5 + 2;
            doc.setDrawColor(...LINE);
            doc.setLineWidth(0.2);
            doc.setLineDashPattern([0.6, 0.8], 0);
            doc.line(x, rowEnd, x + addonW, rowEnd);
            doc.setLineDashPattern([], 0);
            columnY[col] = rowEnd + 4.6;
        });
        y = Math.max(...columnY) + 3;
    }

    // Visitor's estimate, if they built one
    if (summary?.lines?.length) {
        const rowsH = summary.lines.length * 5.2 + 22;
        ensure(rowsH + 4);
        doc.setFillColor(250, 248, 240);
        doc.setDrawColor(...INK);
        doc.setLineWidth(0.5);
        doc.setLineDashPattern([1.5, 1.2], 0);
        doc.roundedRect(M, y - 4, contentW, rowsH, 2, 2, 'FD');
        doc.setLineDashPattern([], 0);
        font('bold', 12);
        setColor(INK);
        doc.text('Your estimate', M + 5, y + 3);
        let ey = y + 10;
        summary.lines.forEach((line) => {
            font('normal', 9);
            setColor(INK);
            const qty = line.qty > 1 ? `  x${line.qty}` : '';
            const group = line.entry.category ? `  (${line.entry.category.name})` : '';
            doc.text(pdfText(`${line.entry.item.name}${group}${qty}`), M + 5, ey);
            const recurring = isRecurring(line.unit) ? line.unit : '';
            doc.text(pdfText(`${currency.approx ? '~' : ''}${currency.symbol} ${formatNumber(line.amount)}${recurring}`), W - M - 5, ey, { align: 'right' });
            ey += 5.2;
        });
        doc.setDrawColor(...INK);
        doc.setLineWidth(0.3);
        doc.line(M + 5, ey - 3, W - M - 5, ey - 3);
        font('bold', 11);
        const recurringText = Array.from(summary.recurring || [])
            .map(([u, a]) => `  + ${currency.approx ? '~' : ''}${currency.symbol} ${formatNumber(a)}${u}`).join('');
        doc.text('Estimated total', M + 5, ey + 3);
        doc.text(pdfText(`${currency.approx ? '~' : ''}${currency.symbol} ${formatNumber(summary.total)}${recurringText}`), W - M - 5, ey + 3, { align: 'right' });
        y += rowsH + 6;
    }

    // Notes
    const notes = meta.notes || [];
    if (notes.length) {
        font('normal', 8);
        const wrapped = notes.map((n) => doc.splitTextToSize(pdfText(n), contentW - 5));
        ensure(10 + wrapped.reduce((s, l) => s + l.length * 3.6 + 1.4, 0));
        font('bold', 9.5);
        setColor(INK);
        doc.text('Good to know', M, y);
        y += 5;
        font('normal', 8);
        setColor(DIM);
        wrapped.forEach((lines) => {
            doc.setFillColor(...RED);
            doc.circle(M + 1, y - 1.1, 0.6, 'F');
            doc.text(lines, M + 4, y);
            y += lines.length * 3.6 + 1.4;
        });
    }

    // Footer on every page
    const pages = doc.getNumberOfPages();
    for (let p = 1; p <= pages; p += 1) {
        doc.setPage(p);
        doc.setDrawColor(...LINE);
        doc.setLineWidth(0.2);
        doc.line(M, H - 12, W - M, H - 12);
        font('normal', 7.5);
        setColor(DIM);
        doc.text(pdfText(`${meta.owner || ''}  |  ${meta.title || 'Rate Card'}  |  ${meta.website || ''}`), M, H - 7);
        doc.text(`Page ${p} of ${pages}`, W - M, H - 7, { align: 'right' });
    }

    const fileName = `${(meta.owner || 'Rate Card').replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '')}-Rate-Card.pdf`;
    doc.save(fileName);
}

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
    doc.rect(0, 0, W, 44, 'F');
    doc.setFillColor(...YELLOW);
    doc.rect(0, 44, W, 2.2, 'F');
    font('bold', 26);
    setColor([255, 255, 255]);
    doc.text(pdfText((meta.title || 'Rate Card').toUpperCase()), M, 21);
    font('normal', 11);
    doc.text(pdfText([meta.owner, meta.role].filter(Boolean).join('  |  ')), M, 30);
    font('normal', 8.5);
    doc.setTextColor(220, 226, 230);
    const phone = meta.whatsapp ? `+${meta.whatsapp.replace(/^(\d{2})(\d{2})(\d{4})(\d+)$/, '$1 $2-$3 $4')}` : '';
    [meta.email, phone, meta.website].filter(Boolean).forEach((line, i) => {
        doc.text(pdfText(line), W - M, 17 + i * 5.5, { align: 'right' });
    });
    font('normal', 8);
    doc.setTextColor(200, 208, 214);
    const dates = [
        meta.updated && `Updated ${formatDate(meta.updated)}`,
        meta.validUntil && `Valid until ${formatDate(meta.validUntil)}`,
        currency.approx && `Prices converted from ${meta.currency} at ${meta.secondaryCurrency.rate}`
    ].filter(Boolean).join('   |   ');
    doc.text(pdfText(dates), M, 38);

    y = 56;
    if (meta.subtitle) {
        font('italic', 10);
        setColor(DIM);
        const lines = doc.splitTextToSize(pdfText(meta.subtitle), contentW);
        doc.text(lines, M, y);
        y += lines.length * 4.6 + 4;
    }

    // Package grid per category
    const gap = 5;
    (data.categories || []).forEach((category) => {
        const packages = category.packages || [];
        if (!packages.length) return;
        const cols = Math.min(3, packages.length);
        const colW = (contentW - gap * (cols - 1)) / cols;
        const pad = 4;
        const innerW = colW - pad * 2;

        const layouts = packages.map((pkg) => {
            font('normal', 8);
            const tagline = doc.splitTextToSize(pdfText(pkg.tagline), innerW);
            const features = (pkg.features || []).map((f) => doc.splitTextToSize(pdfText(f), innerW - 4));
            const featureH = features.reduce((sum, lines) => sum + lines.length * 3.6 + 1, 0);
            const height = pad + 8.4 + (tagline.length - 1) * 3.6 + 11.5 + 4.4 + (pkg.timeline ? 5 : 0) + featureH + pad - 2;
            return { pkg, tagline, features, height };
        });

        for (let start = 0; start < layouts.length; start += cols) {
            const row = layouts.slice(start, start + cols);
            const rowH = Math.max(...row.map((l) => l.height));
            const titleH = start === 0 ? 11 : 0;
            ensure(titleH + rowH + 4);

            if (start === 0) {
                doc.setFillColor(...RED);
                doc.rect(M, y - 3.4, 2.4, 4.4, 'F');
                font('bold', 13);
                setColor(INK);
                doc.text(pdfText(category.name), M + 5, y);
                if (category.blurb) {
                    font('normal', 8.5);
                    setColor(DIM);
                    const nameW = doc.getStringUnitWidth(pdfText(category.name)) * 13 / doc.internal.scaleFactor;
                    const blurb = doc.splitTextToSize(pdfText(category.blurb), contentW - nameW - 10)[0];
                    doc.text(blurb, M + 5 + nameW + 4, y);
                }
                y += 5;
            }

            row.forEach((layout, i) => {
                const { pkg } = layout;
                const x = M + i * (colW + gap);
                let cy = y + pad;
                if (pkg.popular) {
                    doc.setFillColor(...STICKY);
                    doc.setDrawColor(...INK);
                    doc.setLineWidth(0.6);
                    doc.roundedRect(x, y, colW, rowH, 2, 2, 'FD');
                    doc.setFillColor(...RED);
                    doc.roundedRect(x + colW - 26, y - 2.6, 23, 5.2, 1, 1, 'F');
                    font('bold', 6.5);
                    setColor([255, 255, 255]);
                    doc.text('MOST POPULAR', x + colW - 14.5, y + 0.8, { align: 'center' });
                } else {
                    doc.setDrawColor(...LINE);
                    doc.setLineWidth(0.35);
                    doc.roundedRect(x, y, colW, rowH, 2, 2, 'S');
                }

                font('bold', 11);
                setColor(INK);
                cy += 4;
                doc.text(pdfText(pkg.name), x + pad, cy);
                font('normal', 8);
                setColor(DIM);
                cy += 4.4;
                doc.text(layout.tagline, x + pad, cy);
                cy += (layout.tagline.length - 1) * 3.6;
                if (pkg.prefix) {
                    font('normal', 7);
                    setColor(DIM);
                    doc.text(pdfText(pkg.prefix.toUpperCase()), x + pad, cy + 5);
                }
                cy += 11.5;
                font('bold', 15);
                setColor(INK);
                const price = money(pkg.price);
                doc.text(pdfText(price), x + pad, cy);
                const unit = unitOf(pkg);
                if (unit) {
                    const priceW = doc.getStringUnitWidth(pdfText(price)) * 15 / doc.internal.scaleFactor;
                    font('normal', 8.5);
                    setColor(DIM);
                    doc.text(pdfText(unit), x + pad + priceW + 1, cy);
                }
                cy += 4.4;

                if (pkg.timeline) {
                    font('normal', 7.5);
                    setColor(RED);
                    doc.text(pdfText(`Timeline: ${pkg.timeline}`), x + pad, cy);
                    cy += 5;
                }

                font('normal', 8);
                setColor(INK);
                layout.features.forEach((lines) => {
                    doc.setDrawColor(...RED);
                    doc.setLineWidth(0.45);
                    doc.line(x + pad, cy - 1.2, x + pad + 0.9, cy - 0.3);
                    doc.line(x + pad + 0.9, cy - 0.3, x + pad + 2.4, cy - 2.2);
                    doc.text(lines, x + pad + 4, cy);
                    cy += lines.length * 3.6 + 1;
                });
            });
            y += rowH + 8;
        }
    });

    // Add-ons
    const addons = data.addons || [];
    if (addons.length) {
        ensure(14 + Math.ceil(addons.length / 2) * 6.5);
        doc.setFillColor(...RED);
        doc.rect(M, y - 3.4, 2.4, 4.4, 'F');
        font('bold', 13);
        setColor(INK);
        doc.text('Add-ons', M + 5, y);
        y += 6;
        const colW = (contentW - 8) / 2;
        const half = Math.ceil(addons.length / 2);
        addons.forEach((addon, i) => {
            const col = i < half ? 0 : 1;
            const row = i % half;
            const x = M + col * (colW + 8);
            const ry = y + row * 6.5;
            font('normal', 8.5);
            setColor(INK);
            const name = doc.splitTextToSize(pdfText(addon.name), colW - 30)[0];
            doc.text(name, x, ry);
            font('bold', 8.5);
            doc.text(pdfText(`${money(addon.price)}${addon.unit || ''}`), x + colW, ry, { align: 'right' });
            doc.setDrawColor(...LINE);
            doc.setLineWidth(0.2);
            doc.setLineDashPattern([0.6, 0.8], 0);
            doc.line(x, ry + 2, x + colW, ry + 2);
            doc.setLineDashPattern([], 0);
        });
        y += half * 6.5 + 6;
    }

    // Visitor's estimate, if they built one
    if (summary?.lines?.length) {
        const rowsH = summary.lines.length * 6 + 24;
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
            ey += 6;
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

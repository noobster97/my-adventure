// --- Rate Card PDF ---
// Draws a clean A4 price list with jsPDF (loaded on demand from cdnjs), using
// the same JSON as the page so the download never drifts from the website.
// Page 1 is the price list; a visitor's estimate gets its own quote page.

import { convert, formatDate, formatNumber, isRecurring, unitOf } from './rate-card.js';

const JSPDF_URL = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';

const INK = [44, 62, 80];
const RED = [231, 76, 60];
const YELLOW = [241, 196, 15];
const HIGHLIGHT = [255, 251, 219];
const DIM = [118, 130, 140];
const LINE = [225, 229, 233];
const HEAD_BG = [244, 246, 248];
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

export async function downloadRateCardPdf(data, { currency, summary } = {}) {
    const JsPDF = await loadJsPdf();
    const doc = new JsPDF({ unit: 'mm', format: 'a4' });
    const meta = data.meta || {};
    const W = 210;
    const H = 297;
    const M = 15;
    const CW = W - M * 2;
    const BOTTOM = H - 13;
    const approx = currency.approx ? '~' : '';
    const money = (value) => `${approx}${currency.symbol} ${formatNumber(value)}`;
    const phone = meta.whatsapp ? `+${meta.whatsapp.replace(/^(\d{2})(\d{2})(\d{4})(\d+)$/, '$1 $2-$3 $4')}` : '';
    let y = 0;

    const font = (style, size, color = INK) => {
        doc.setFont('helvetica', style);
        doc.setFontSize(size);
        doc.setTextColor(...color);
    };
    const textW = (text, size) => doc.getStringUnitWidth(text) * size / doc.internal.scaleFactor;
    const hr = (yy, color = LINE, width = 0.25) => {
        doc.setDrawColor(...color);
        doc.setLineWidth(width);
        doc.line(M, yy, W - M, yy);
    };

    // Column layout for package tables
    const COL = {
        name: M + 3,
        incl: M + 46,
        inclW: 80,
        time: M + 130,
        price: W - M - 3
    };

    function header(title, sub) {
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
        y = 37;
    }

    function ensure(needed, onNewPage) {
        if (y + needed <= BOTTOM) return;
        doc.addPage();
        y = 18;
        onNewPage?.();
    }

    function sectionTitle(text) {
        doc.setFillColor(...RED);
        doc.rect(M, y - 3.6, 1.6, 4.6, 'F');
        font('bold', 12.5);
        doc.text(pdfText(text), M + 4, y);
        y += 4;
    }

    function tableHead(cols) {
        doc.setFillColor(...HEAD_BG);
        doc.rect(M, y, CW, 6.4, 'F');
        font('bold', 6.8, DIM);
        cols.forEach(([label, x, align]) => doc.text(label, x, y + 4.2, align ? { align } : undefined));
        y += 6.4;
    }

    // ---------- Page 1: price list ----------
    header('Rate Card', [meta.owner, meta.role].filter(Boolean).join('  |  '));

    font('normal', 9.5, INK);
    const intro = doc.splitTextToSize(pdfText(meta.subtitle || ''), CW);
    if (intro.length && intro[0]) {
        doc.text(intro, M, y);
        y += intro.length * 4.4;
    }
    font('normal', 8, DIM);
    const facts = [
        `All prices in ${currency.code || currency.symbol}`,
        meta.updated && `Updated ${formatDate(meta.updated)}`,
        meta.validUntil && `Valid until ${formatDate(meta.validUntil)}`
    ].filter(Boolean).join('   •   ');
    doc.text(pdfText(facts), M, y + 0.6);
    y += 6.5;

    const packageCols = [
        ['PACKAGE', COL.name],
        ["WHAT'S INCLUDED", COL.incl],
        ['TIMELINE', COL.time],
        ['PRICE', COL.price, 'right']
    ];

    // One continuous table; each category is a slim band row
    tableHead(packageCols);
    (data.categories || []).filter((c) => (c.packages || []).length).forEach((category) => {
        const rows = category.packages.map((pkg) => {
            font('normal', 8);
            const incl = doc.splitTextToSize(pdfText((pkg.features || []).join(', ')), COL.inclW);
            const nameH = pkg.popular ? 8.8 : 5;
            return { pkg, incl, h: Math.max(nameH, incl.length * 3.4 + 1.6) + 2.6 };
        });
        ensure(7 + rows.reduce((s, r) => s + r.h, 0), () => tableHead(packageCols));

        doc.setFillColor(...INK);
        doc.rect(M, y, CW, 6.6, 'F');
        doc.setFillColor(...RED);
        doc.rect(M, y, 1.4, 6.6, 'F');
        font('bold', 9, WHITE);
        doc.text(pdfText(category.name.toUpperCase()), M + 4, y + 4.5);
        if (category.blurb) {
            font('normal', 7.2, [190, 200, 208]);
            const blurb = doc.splitTextToSize(pdfText(category.blurb), CW - textW(pdfText(category.name.toUpperCase()), 9) - 14)[0];
            doc.text(blurb, M + 8 + textW(pdfText(category.name.toUpperCase()), 9), y + 4.5);
        }
        y += 6.6;

        rows.forEach(({ pkg, incl, h }) => {
            if (pkg.popular) {
                doc.setFillColor(...HIGHLIGHT);
                doc.rect(M, y, CW, h, 'F');
            }
            const base = y + 4.5;

            font('bold', 9.4);
            doc.text(pdfText(pkg.name), COL.name, base);
            if (pkg.popular) {
                doc.setFillColor(...RED);
                doc.roundedRect(COL.name, base + 1.4, 17, 3.6, 0.9, 0.9, 'F');
                font('bold', 5.6, WHITE);
                doc.text('MOST POPULAR', COL.name + 8.5, base + 3.95, { align: 'center' });
            }

            font('normal', 8, INK);
            doc.text(incl, COL.incl, base);

            font('normal', 8, DIM);
            doc.text(pdfText(pkg.timeline || '-'), COL.time, base);

            // Price, right-aligned: "from" + amount + unit
            const unit = unitOf(pkg);
            let px = COL.price;
            if (unit) {
                font('normal', 7.4, DIM);
                doc.text(pdfText(unit), px, base, { align: 'right' });
                px -= textW(pdfText(unit), 7.4) + 0.5;
            }
            const price = pdfText(money(convert(pkg.price, currency)));
            font('bold', 10.2);
            doc.text(price, px, base, { align: 'right' });
            if (pkg.prefix) {
                px -= textW(price, 10.2) + 1;
                font('normal', 7, DIM);
                doc.text(pdfText(pkg.prefix.toLowerCase()), px, base, { align: 'right' });
            }

            y += h;
            if (!pkg.popular) hr(y);
        });
    });
    y += 6.5;

    // Add-ons: two compact name/price columns
    const addons = data.addons || [];
    if (addons.length) {
        const half = Math.ceil(addons.length / 2);
        const colW = (CW - 10) / 2;
        font('normal', 8.2);
        const names = addons.map((a) => doc.splitTextToSize(pdfText(a.name), colW - 22).slice(0, 2));
        const colH = (from, to) => names.slice(from, to).reduce((sum, n) => sum + n.length * 3.4 + 2.4, 0);
        ensure(8 + Math.max(colH(0, half), colH(half)));
        sectionTitle('Add-ons');
        y += 0.5;
        const columnY = [y, y];
        addons.forEach((addon, i) => {
            const col = i < half ? 0 : 1;
            const x = M + col * (colW + 10);
            const ry = columnY[col];
            font('normal', 8.2);
            doc.text(names[i], x + 1, ry + 3.4);
            font('bold', 8.4);
            doc.text(pdfText(`${money(convert(addon.price, currency))}${addon.unit || ''}`), x + colW - 1, ry + 3.4, { align: 'right' });
            const end = ry + names[i].length * 3.4 + 2.4;
            doc.setDrawColor(...LINE);
            doc.setLineWidth(0.25);
            doc.line(x, end, x + colW, end);
            columnY[col] = end;
        });
        y = Math.max(...columnY) + 6;
    }

    // Terms
    const notes = meta.notes || [];
    if (notes.length) {
        font('normal', 7.8);
        const wrapped = notes.map((n) => doc.splitTextToSize(pdfText(n), CW - 5));
        ensure(8 + wrapped.reduce((s, l) => s + l.length * 3.3 + 0.9, 0));
        font('bold', 8.8);
        doc.text('Good to know', M, y);
        y += 4.2;
        wrapped.forEach((lines) => {
            doc.setFillColor(...RED);
            doc.circle(M + 1, y - 1.1, 0.55, 'F');
            font('normal', 7.8, DIM);
            doc.text(lines, M + 4, y);
            y += lines.length * 3.3 + 0.9;
        });
        y += 1.5;
    }

    // Call to action
    function cta() {
        ensure(11);
        doc.setFillColor(...RED);
        doc.roundedRect(M, y, CW, 10, 2, 2, 'F');
        font('bold', 9.6, WHITE);
        doc.text('Ready to start? Free consultation.', M + 5, y + 6.4);
        font('normal', 8.6, WHITE);
        doc.text(pdfText(`WhatsApp ${phone}   |   ${meta.email || ''}`), W - M - 5, y + 6.4, { align: 'right' });
        y += 14;
    }
    cta();

    // ---------- Page 2: the visitor's estimate as a simple quote ----------
    if (summary?.lines?.length) {
        doc.addPage();
        header('Your Estimate', `Prepared on ${formatDate(new Date().toISOString().slice(0, 10))} from the ${meta.owner || ''} rate card`);
        const quoteCols = [['ITEM', M + 3], ['QTY', M + 128, 'right'], ['AMOUNT', W - M - 3, 'right']];
        tableHead(quoteCols);
        summary.lines.forEach((line) => {
            ensure(10, () => tableHead(quoteCols));
            const group = line.entry.category ? line.entry.category.name : 'Add-on';
            font('bold', 9.4);
            doc.text(pdfText(line.entry.item.name), M + 3, y + 5.2);
            font('normal', 7.4, DIM);
            doc.text(pdfText(group), M + 3, y + 8.6);
            font('normal', 9, INK);
            doc.text(String(line.qty), M + 128, y + 5.2, { align: 'right' });
            const recurring = isRecurring(line.unit) ? line.unit : '';
            font('bold', 9.4);
            doc.text(pdfText(`${money(line.amount)}${recurring}`), W - M - 3, y + 5.2, { align: 'right' });
            y += 11;
            hr(y);
        });

        y += 4;
        doc.setFillColor(...HIGHLIGHT);
        doc.rect(M + CW / 2, y, CW / 2, 11, 'F');
        font('bold', 9.5);
        doc.text('Estimated total', M + CW / 2 + 4, y + 7);
        font('bold', 13);
        doc.text(pdfText(money(summary.total)), W - M - 3, y + 7.4, { align: 'right' });
        y += 11;
        Array.from(summary.recurring || []).forEach(([unit, amount]) => {
            font('bold', 9, RED);
            doc.text(pdfText(`+ ${money(amount)}${unit}`), W - M - 3, y + 5, { align: 'right' });
            y += 5.5;
        });
        y += 8;
        font('italic', 8, DIM);
        doc.text(doc.splitTextToSize('This is an estimate based on published starting prices. The final quote is confirmed after a free consultation about your requirements.', CW), M, y);
        y += 12;
        cta();
    }

    // Footer on every page
    const pages = doc.getNumberOfPages();
    for (let p = 1; p <= pages; p += 1) {
        doc.setPage(p);
        hr(H - 11, LINE, 0.2);
        font('normal', 7.2, DIM);
        doc.text(pdfText(`${meta.owner || ''}  |  ${meta.website || ''}`), M, H - 6.5);
        doc.text(`Page ${p} of ${pages}`, W - M, H - 6.5, { align: 'right' });
    }

    const fileName = `${(meta.owner || 'Rate Card').replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '')}-Rate-Card.pdf`;
    doc.save(fileName);
}

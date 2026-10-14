// --- Rate Card ---
// Renders the rate card from data/rate-card.json. Prices are edited in that
// file only (or via rate-card-editor.html on localhost) and published by
// pushing to GitHub — visitors can build an estimate but never change prices.

const RATE_CARD_URL = 'data/rate-card.json';
const STORAGE_KEY = 'rc-estimate-v1';
const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const finePointer = () => window.matchMedia('(hover: hover) and (pointer: fine)').matches;

const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
}[c]));

export const unitOf = (item) => item.suffix ?? item.unit ?? '';
export const isRecurring = (unit) => /^\/\s*(month|mo|year|yr)/i.test(unit || '');
const hasQuantity = (unit) => Boolean(unit) && !isRecurring(unit);

const storage = {
    get() {
        try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || null; } catch { return null; }
    },
    set(value) {
        try { localStorage.setItem(STORAGE_KEY, JSON.stringify(value)); } catch { /* private mode */ }
    }
};

export async function loadRateCard(url = RATE_CARD_URL) {
    const response = await fetch(url, { cache: 'no-cache' });
    if (!response.ok) throw new Error(`Rate card request failed (${response.status})`);
    return response.json();
}

// Builds a flat id -> entry map so the estimate can resolve both packages and add-ons.
export function buildCatalog(data) {
    const catalog = new Map();
    (data.categories || []).forEach((category) => {
        (category.packages || []).forEach((pkg) => {
            catalog.set(pkg.id, { kind: 'package', item: pkg, category, unit: unitOf(pkg) });
        });
    });
    (data.addons || []).forEach((addon) => {
        catalog.set(addon.id, { kind: 'addon', item: addon, category: null, unit: unitOf(addon) });
    });
    return catalog;
}

export function currencyFor(meta, mode) {
    const secondary = meta.secondaryCurrency;
    if (mode === 'secondary' && secondary && secondary.rate) {
        return { symbol: secondary.symbol || secondary.code, code: secondary.code, rate: Number(secondary.rate), approx: true };
    }
    return { symbol: meta.currency || 'RM', code: meta.currency || 'RM', rate: 1, approx: false };
}

export function convert(value, currency) {
    const raw = Number(value || 0) * currency.rate;
    if (currency.rate === 1) return raw;
    // Converted prices are estimates, so round to friendly numbers.
    if (raw >= 1000) return Math.round(raw / 10) * 10;
    if (raw >= 100) return Math.round(raw / 5) * 5;
    return Math.round(raw);
}

export const formatNumber = (n) => Math.round(n).toLocaleString('en-MY');

export function formatDate(iso) {
    if (!iso) return '';
    const date = new Date(`${iso}T00:00:00`);
    if (Number.isNaN(date.getTime())) return iso;
    return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

export function summarizeEstimate(selection, catalog, currency) {
    const lines = [];
    let total = 0;
    const recurring = new Map();
    selection.forEach((qty, id) => {
        const entry = catalog.get(id);
        if (!entry) return;
        const unit = entry.unit;
        const price = convert(entry.item.price, currency);
        const amount = price * (hasQuantity(unit) ? qty : 1);
        lines.push({ id, entry, qty, unit, amount, price });
        if (isRecurring(unit)) {
            const key = unit.replace(/\s+/g, '');
            recurring.set(key, (recurring.get(key) || 0) + amount);
        } else {
            total += amount;
        }
    });
    return { lines, total, recurring };
}

// --- Animation helpers ---
const counters = new WeakMap();

function countTo(el, to, { from, duration = 900 } = {}) {
    if (!el) return;
    const start = from ?? Number(el.dataset.current || 0);
    cancelAnimationFrame(counters.get(el));
    if (reducedMotion() || start === to) {
        el.textContent = formatNumber(to);
        el.dataset.current = to;
        return;
    }
    const startTime = performance.now();
    const tick = (now) => {
        const t = Math.min(1, (now - startTime) / duration);
        const eased = t === 1 ? 1 : 1 - Math.pow(2, -10 * t);
        const value = start + (to - start) * eased;
        el.textContent = formatNumber(value);
        el.dataset.current = value;
        if (t < 1) counters.set(el, requestAnimationFrame(tick));
    };
    counters.set(el, requestAnimationFrame(tick));
}

function animate(el, keyframes, options) {
    if (!el || reducedMotion() || !el.animate) return { finished: Promise.resolve() };
    return el.animate(keyframes, options);
}

const CHECK_SVG = '<svg class="rc-check" viewBox="0 0 20 20" aria-hidden="true"><path d="M3.5 10.5 L8 15 L16.5 4.5" /></svg>';
const SCRIBBLE_SVG = '<svg class="rc-scribble" viewBox="0 0 200 70" preserveAspectRatio="none" aria-hidden="true"><path d="M18 40 C 12 14, 70 4, 118 7 C 170 10, 196 22, 190 42 C 184 62, 120 68, 70 64 C 26 60, 4 50, 14 30 C 22 16, 60 8, 98 9" /></svg>';
const UNDERLINE_SVG = '<svg class="rc-underline" viewBox="0 0 300 24" preserveAspectRatio="none" aria-hidden="true"><path d="M4 16 C 60 6, 120 4, 170 10 S 260 20, 296 8" /></svg>';
const TILTS = [-1.4, 0.9, -0.6, 1.2, -1];

// --- Mount ---
export function mountRateCard(root, data, options = {}) {
    const { persist = true, onSelectionChange, initialCategory, intro = true } = options;
    const meta = data.meta || {};
    const categories = (data.categories || []).filter((c) => (c.packages || []).length);
    const addons = data.addons || [];
    const catalog = buildCatalog(data);

    const saved = persist ? storage.get() : null;
    const state = {
        cat: Math.max(0, categories.findIndex((c) => c.id === initialCategory)),
        currencyMode: saved?.currency === 'secondary' && meta.secondaryCurrency ? 'secondary' : 'primary',
        selection: new Map((saved?.items || []).filter(([id]) => catalog.has(id))),
        seen: false,
        renderToken: 0
    };

    const quoteNo = `Q-${(meta.updated || '').replace(/-/g, '').slice(2) || '000000'}`;

    // Re-mounting (editor preview) must drop the previous instance's listeners.
    root._rcAbort?.abort();
    const lifecycle = new AbortController();
    root._rcAbort = lifecycle;
    const { signal } = lifecycle;

    root.classList.add('rc-root');
    root.innerHTML = `
        <div class="rc-head">
            <span class="rc-kicker"><i class="fas fa-tags" aria-hidden="true"></i> Pricing, no surprises</span>
            <h2 class="section-title rc-title">${esc(meta.title || 'Rate Card')}${UNDERLINE_SVG}</h2>
            <p class="section-subtitle rc-subtitle">${esc(meta.subtitle)}</p>
            <div class="rc-toolbar">
                ${meta.secondaryCurrency ? `
                <div class="rc-currency" role="radiogroup" aria-label="Currency">
                    <span class="rc-currency-thumb" aria-hidden="true"></span>
                    <button type="button" role="radio" data-cur="primary">${esc(meta.currency || 'RM')}</button>
                    <button type="button" role="radio" data-cur="secondary">${esc(meta.secondaryCurrency.code)}</button>
                </div>` : ''}
                <button type="button" class="rc-btn rc-btn-ink rc-download" data-pdf>
                    <i class="fas fa-file-arrow-down" aria-hidden="true"></i> <span>Download PDF</span>
                </button>
                ${meta.updated ? `<span class="rc-updated"><i class="far fa-calendar-check" aria-hidden="true"></i> Updated ${esc(formatDate(meta.updated))}</span>` : ''}
            </div>
        </div>

        <div class="rc-tabs-wrap">
            <div class="rc-tabs" role="tablist" aria-label="Service categories">
                <span class="rc-tab-ink" aria-hidden="true"></span>
                ${categories.map((c, i) => `
                    <button type="button" class="rc-tab" role="tab" id="rc-tab-${esc(c.id)}" aria-controls="rc-panel"
                        aria-selected="${i === 0}" tabindex="${i === 0 ? 0 : -1}" data-index="${i}">
                        <i class="fas ${esc(c.icon || 'fa-star')}" aria-hidden="true"></i><span>${esc(c.name)}</span>
                    </button>`).join('')}
            </div>
        </div>

        <p class="rc-blurb" aria-live="polite"></p>
        <div class="rc-cards" id="rc-panel" role="tabpanel"></div>

        <div class="rc-builder">
            <div class="rc-addons-panel">
                <h3 class="rc-h3">Build your estimate</h3>
                <ol class="rc-steps">
                    <li><b>1</b> Pick a package</li>
                    <li><b>2</b> Add extras</li>
                    <li><b>3</b> Send it on WhatsApp</li>
                </ol>
                ${addons.length ? `
                <div class="rc-addons">
                    ${addons.map((a) => `
                        <button type="button" class="rc-chip" data-add="${esc(a.id)}" aria-pressed="false">
                            <span class="rc-chip-box" aria-hidden="true">${CHECK_SVG}</span>
                            <span class="rc-chip-name">${esc(a.name)}</span>
                            <span class="rc-chip-price" data-price="${esc(a.id)}"></span>
                        </button>`).join('')}
                </div>` : ''}
                ${(meta.notes || []).length ? `
                <ul class="rc-notes">
                    ${meta.notes.map((n) => `<li><i class="fas fa-circle-info" aria-hidden="true"></i><span>${esc(n)}</span></li>`).join('')}
                </ul>` : ''}
            </div>

            <div class="rc-receipt-wrap">
                <div class="rc-printer" aria-hidden="true"><span class="rc-printer-led"></span><span class="rc-printer-slot"></span></div>
                <div class="rc-receipt" aria-label="Your estimate">
                    <div class="rc-receipt-head">
                        <strong>${esc(meta.owner || 'Estimate')}</strong>
                        <span>${esc(meta.role || '')}</span>
                        <span class="rc-receipt-meta">${quoteNo} · ${esc(formatDate(new Date().toISOString().slice(0, 10)))}</span>
                    </div>
                    <p class="rc-empty">Nothing here yet. Pick a package to start your estimate.</p>
                    <ul class="rc-lines"></ul>
                    <div class="rc-totals">
                        <div class="rc-total-row">
                            <span>Estimated total</span>
                            <strong><span class="rc-approx"></span><span class="rc-sym"></span> <span class="rc-num rc-total" data-current="0">0</span></strong>
                        </div>
                        <div class="rc-recurring"></div>
                        <div class="rc-stamp" aria-hidden="true">Quote<br>Ready</div>
                    </div>
                    <div class="rc-receipt-actions">
                        <a class="rc-btn rc-btn-wa" data-wa target="_blank" rel="noopener"><i class="fab fa-whatsapp" aria-hidden="true"></i> Send on WhatsApp</a>
                        <a class="rc-btn rc-btn-ghost" data-mail><i class="fas fa-envelope" aria-hidden="true"></i> Email</a>
                        <button type="button" class="rc-btn rc-btn-ghost" data-pdf><i class="fas fa-file-pdf" aria-hidden="true"></i> PDF</button>
                        <button type="button" class="rc-btn rc-btn-ghost rc-clear" data-clear><i class="fas fa-rotate-left" aria-hidden="true"></i> Clear</button>
                    </div>
                    <div class="rc-barcode" aria-hidden="true"></div>
                    <p class="rc-receipt-foot">Estimate only — final quote after a free discovery call.</p>
                </div>
            </div>
        </div>
        <div class="rc-toast" role="status" aria-live="polite"></div>
    `;

    const $ = (sel) => root.querySelector(sel);
    const $$ = (sel) => Array.from(root.querySelectorAll(sel));
    const tabsEl = $('.rc-tabs');
    const inkEl = $('.rc-tab-ink');
    const cardsEl = $('.rc-cards');
    const blurbEl = $('.rc-blurb');
    const linesEl = $('.rc-lines');
    const receiptEl = $('.rc-receipt');
    const totalEl = $('.rc-total');
    const toastEl = $('.rc-toast');

    const currency = () => currencyFor(meta, state.currencyMode);

    // --- Tabs ---
    function moveInk() {
        const active = tabsEl.querySelector('.rc-tab[aria-selected="true"]');
        if (!active) return;
        inkEl.style.width = `${active.offsetWidth}px`;
        inkEl.style.transform = `translateX(${active.offsetLeft}px)`;
        const target = active.offsetLeft - (tabsEl.clientWidth - active.offsetWidth) / 2;
        tabsEl.scrollTo({ left: target, behavior: reducedMotion() ? 'auto' : 'smooth' });
    }

    function selectTab(index, { focus = false } = {}) {
        if (index === state.cat && cardsEl.children.length) return;
        const forward = index > state.cat;
        state.cat = index;
        $$('.rc-tab').forEach((tab, i) => {
            const on = i === index;
            tab.setAttribute('aria-selected', on);
            tab.tabIndex = on ? 0 : -1;
            if (on && focus) tab.focus();
        });
        animate(inkEl, [{ scale: '1 1' }, { scale: '1.15 0.8' }, { scale: '1 1' }], { duration: 450, easing: 'ease-out' });
        moveInk();
        renderCards(forward);
    }

    tabsEl.addEventListener('click', (e) => {
        const tab = e.target.closest('.rc-tab');
        if (tab) selectTab(Number(tab.dataset.index));
    });
    tabsEl.addEventListener('keydown', (e) => {
        const keys = { ArrowRight: 1, ArrowLeft: -1, Home: 'first', End: 'last' };
        if (!(e.key in keys)) return;
        e.preventDefault();
        const n = categories.length;
        const next = keys[e.key] === 'first' ? 0 : keys[e.key] === 'last' ? n - 1 : (state.cat + keys[e.key] + n) % n;
        selectTab(next, { focus: true });
    });

    // --- Cards ---
    function cardMarkup(pkg, i) {
        const unit = unitOf(pkg);
        const selected = state.selection.has(pkg.id);
        return `
            <article class="rc-card${pkg.popular ? ' is-popular' : ''}${selected ? ' is-selected' : ''}" data-id="${esc(pkg.id)}" style="--tilt:${TILTS[i % TILTS.length]}deg">
                <div class="rc-card-inner">
                    <span class="rc-glare" aria-hidden="true"></span>
                    ${pkg.popular ? `<span class="rc-ribbon">Most popular${SCRIBBLE_SVG}</span>` : ''}
                    <h3 class="rc-card-name">${esc(pkg.name)}</h3>
                    <p class="rc-tagline">${esc(pkg.tagline)}</p>
                    <div class="rc-price">
                        ${pkg.prefix ? `<span class="rc-prefix">${esc(pkg.prefix)}</span>` : ''}
                        <span class="rc-amount"><span class="rc-sym"></span><span class="rc-num" data-value="${Number(pkg.price) || 0}">0</span></span>
                        ${unit ? `<span class="rc-suffix">${esc(unit)}</span>` : ''}
                    </div>
                    ${pkg.timeline ? `<p class="rc-timeline"><i class="far fa-clock" aria-hidden="true"></i> ${esc(pkg.timeline)}</p>` : ''}
                    <ul class="rc-features">
                        ${(pkg.features || []).map((f, fi) => `<li style="--i:${fi}">${CHECK_SVG}<span>${esc(f)}</span></li>`).join('')}
                    </ul>
                    <button type="button" class="rc-add" data-add="${esc(pkg.id)}" aria-pressed="${selected}">
                        <span class="rc-add-icon" aria-hidden="true"><i class="fas fa-plus"></i></span>
                        <span class="rc-add-label">${selected ? 'Added to estimate' : 'Add to estimate'}</span>
                    </button>
                </div>
            </article>`;
    }

    async function renderCards(forward = true, deal = true) {
        const token = ++state.renderToken;
        const category = categories[state.cat];
        const old = Array.from(cardsEl.children);
        if (old.length && !reducedMotion()) {
            await Promise.all(old.map((card, i) => animate(card, [
                { opacity: 1, transform: 'none' },
                { opacity: 0, transform: `translateX(${forward ? -40 : 40}px) translateY(10px) rotate(${forward ? -4 : 4}deg)` }
            ], { duration: 220, delay: i * 30, easing: 'ease-in', fill: 'forwards' }).finished.catch(() => {})));
        }
        if (token !== state.renderToken) return;

        blurbEl.textContent = category.blurb || '';
        cardsEl.setAttribute('aria-labelledby', `rc-tab-${category.id}`);
        cardsEl.style.setProperty('--cols', Math.min(category.packages.length, 3));
        cardsEl.innerHTML = category.packages.map(cardMarkup).join('');
        paintPrices({ fromZero: true, animateNumbers: state.seen });
        bindTilt();
        if (state.seen && deal) dealIn(forward);
    }

    function dealIn(forward = true) {
        Array.from(cardsEl.children).forEach((card, i) => {
            card.classList.remove('is-in');
            void card.offsetWidth; // restart CSS-driven check/scribble drawing
            card.classList.add('is-in');
            animate(card, [
                { opacity: 0, transform: `translateX(${forward ? 60 : -60}px) translateY(50px) rotate(${i % 2 ? 7 : -7}deg) scale(.9)` },
                { opacity: 1, transform: 'none' }
            ], { duration: 720, delay: 80 + i * 110, easing: 'cubic-bezier(.2,.9,.25,1.15)', fill: 'backwards' });
        });
    }

    function bindTilt() {
        if (!finePointer()) return;
        cardsEl.querySelectorAll('.rc-card').forEach((card) => {
            const inner = card.querySelector('.rc-card-inner');
            card.addEventListener('pointermove', (e) => {
                const rect = card.getBoundingClientRect();
                const x = (e.clientX - rect.left) / rect.width;
                const y = (e.clientY - rect.top) / rect.height;
                inner.style.transform = `rotateX(${(0.5 - y) * 10}deg) rotateY(${(x - 0.5) * 12}deg) translateZ(0)`;
                inner.style.setProperty('--gx', `${x * 100}%`);
                inner.style.setProperty('--gy', `${y * 100}%`);
            });
            card.addEventListener('pointerleave', () => { inner.style.transform = ''; });
        });
    }

    // --- Prices & currency ---
    function paintPrices({ fromZero = false, animateNumbers = true } = {}) {
        const cur = currency();
        root.querySelectorAll('.rc-sym').forEach((el) => { el.textContent = cur.symbol; });
        root.querySelectorAll('.rc-amount').forEach((el) => el.classList.toggle('is-approx', cur.approx));
        cardsEl.querySelectorAll('.rc-num[data-value]').forEach((el, i) => {
            const target = convert(el.dataset.value, cur);
            if (animateNumbers) countTo(el, target, { from: fromZero ? 0 : undefined, duration: 900 + i * 150 });
            else { el.textContent = formatNumber(target); el.dataset.current = target; }
        });
        root.querySelectorAll('.rc-chip-price').forEach((el) => {
            const entry = catalog.get(el.dataset.price);
            el.textContent = `${cur.approx ? '≈' : '+'}${cur.symbol} ${formatNumber(convert(entry.item.price, cur))}${entry.unit || ''}`;
        });
        $$('.rc-currency button').forEach((btn) => btn.setAttribute('aria-checked', btn.dataset.cur === state.currencyMode));
        root.querySelector('.rc-currency')?.classList.toggle('is-secondary', state.currencyMode === 'secondary');
    }

    root.querySelector('.rc-currency')?.addEventListener('click', (e) => {
        const btn = e.target.closest('button[data-cur]');
        if (!btn || btn.dataset.cur === state.currencyMode) return;
        state.currencyMode = btn.dataset.cur;
        paintPrices();
        renderReceipt();
        save();
    });

    // --- Estimate ---
    function toggleItem(id, sourceEl) {
        const entry = catalog.get(id);
        if (!entry) return;
        if (state.selection.has(id)) {
            state.selection.delete(id);
        } else {
            state.selection.set(id, 1);
            flyToReceipt(sourceEl);
        }
        syncSelectedUI();
        renderReceipt({ bump: true });
        save();
    }

    function syncSelectedUI() {
        root.querySelectorAll('[data-add]').forEach((btn) => {
            const on = state.selection.has(btn.dataset.add);
            btn.setAttribute('aria-pressed', on);
            btn.closest('.rc-card')?.classList.toggle('is-selected', on);
            const label = btn.querySelector('.rc-add-label');
            if (label) label.textContent = on ? 'Added to estimate' : 'Add to estimate';
        });
    }

    // A small paper chip flies from the clicked button into the receipt.
    function flyToReceipt(fromEl) {
        if (!fromEl || reducedMotion()) return;
        const from = fromEl.getBoundingClientRect();
        const to = receiptEl.getBoundingClientRect();
        if (to.bottom < 0 || to.top > window.innerHeight) return; // receipt is off-screen
        const dot = document.createElement('span');
        dot.className = 'rc-fly';
        dot.style.left = `${from.left + from.width / 2}px`;
        dot.style.top = `${from.top + from.height / 2}px`;
        document.body.appendChild(dot);
        const dx = to.left + to.width / 2 - (from.left + from.width / 2);
        const dy = to.top + 60 - (from.top + from.height / 2);
        dot.animate([
            { transform: 'translate(-50%, -50%) scale(1) rotate(0deg)', opacity: 1 },
            { transform: `translate(calc(-50% + ${dx * 0.5}px), calc(-50% + ${dy * 0.5 - 120}px)) scale(1.2) rotate(180deg)`, opacity: 1, offset: 0.5 },
            { transform: `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px)) scale(.4) rotate(360deg)`, opacity: 0.2 }
        ], { duration: 750, easing: 'cubic-bezier(.5,0,.3,1)' }).finished.then(() => dot.remove());
    }

    function renderReceipt({ bump = false } = {}) {
        const cur = currency();
        const summary = summarizeEstimate(state.selection, catalog, cur);
        const existing = new Map(Array.from(linesEl.children).map((li) => [li.dataset.id, li]));

        summary.lines.forEach((line) => {
            const name = line.entry.item.name;
            const sub = line.entry.category ? line.entry.category.name : 'Add-on';
            const qtyControl = hasQuantity(line.unit) ? `
                <span class="rc-qty">
                    <button type="button" data-qty="-1" aria-label="Decrease ${esc(name)}">−</button>
                    <span>${line.qty}</span>
                    <button type="button" data-qty="1" aria-label="Increase ${esc(name)}">+</button>
                </span>` : '';
            const html = `
                <span class="rc-line-name">${esc(name)}<small>${esc(sub)}${line.unit ? ` · ${esc(line.unit)}` : ''}</small></span>
                ${qtyControl}
                <span class="rc-line-price">${cur.approx ? '≈' : ''}${esc(cur.symbol)} ${formatNumber(line.amount)}${isRecurring(line.unit) ? `<small>${esc(line.unit)}</small>` : ''}</span>
                <button type="button" class="rc-line-remove" data-remove aria-label="Remove ${esc(name)}"><i class="fas fa-xmark"></i></button>`;
            let li = existing.get(line.id);
            if (li) {
                li.innerHTML = html;
                existing.delete(line.id);
            } else {
                li = document.createElement('li');
                li.className = 'rc-line';
                li.dataset.id = line.id;
                li.innerHTML = html;
                linesEl.appendChild(li);
                animate(li, [
                    { opacity: 0, height: '0px', transform: 'translateY(-12px)', clipPath: 'inset(0 0 100% 0)' },
                    { opacity: 1, height: `${li.scrollHeight}px`, transform: 'none', clipPath: 'inset(0 0 0 0)' }
                ], { duration: 420, easing: 'cubic-bezier(.2,.8,.2,1)' });
            }
        });

        existing.forEach((li) => {
            animate(li, [
                { opacity: 1, height: `${li.offsetHeight}px` },
                { opacity: 0, height: '0px', transform: 'translateX(30px)' }
            ], { duration: 260, easing: 'ease-in', fill: 'forwards' }).finished.then(() => li.remove());
        });

        const count = summary.lines.length;
        receiptEl.classList.toggle('is-empty', count === 0);
        const wasStamped = receiptEl.classList.contains('is-stamped');
        if (count > 0 && !wasStamped) {
            receiptEl.classList.add('is-stamped');
        } else if (count === 0) {
            receiptEl.classList.remove('is-stamped');
        }

        $('.rc-approx').textContent = cur.approx ? '≈ ' : '';
        totalEl.parentElement.querySelector('.rc-sym').textContent = cur.symbol;
        countTo(totalEl, summary.total, { duration: 700 });
        $('.rc-recurring').innerHTML = Array.from(summary.recurring).map(([unit, amount]) =>
            `<span>+ ${cur.approx ? '≈' : ''}${esc(cur.symbol)} ${formatNumber(amount)}<small>${esc(unit)}</small></span>`).join('');

        const wa = $('[data-wa]');
        const mail = $('[data-mail]');
        const message = quoteMessage(summary, cur);
        wa.href = `https://wa.me/${encodeURIComponent(meta.whatsapp || '')}?text=${encodeURIComponent(message)}`;
        mail.href = `mailto:${meta.email || ''}?subject=${encodeURIComponent('Project quote request')}&body=${encodeURIComponent(message)}`;

        if (bump) {
            animate(receiptEl, [
                { transform: 'translateY(-8px)' }, { transform: 'translateY(3px)' }, { transform: 'translateY(0)' }
            ], { duration: 380, easing: 'ease-out' });
            const led = $('.rc-printer-led');
            led.classList.remove('is-blink');
            void led.offsetWidth;
            led.classList.add('is-blink');
        }
        onSelectionChange?.(summary);
    }

    function quoteMessage(summary, cur) {
        const first = meta.nickname || (meta.owner || '').split(' ')[0] || 'there';
        if (!summary.lines.length) {
            return `Hi ${first}! I saw your rate card and would like to discuss a project.`;
        }
        const money = (n) => `${cur.approx ? '~' : ''}${cur.symbol} ${formatNumber(n)}`;
        const rows = summary.lines.map((l) => {
            const qty = hasQuantity(l.unit) && l.qty > 1 ? ` x${l.qty}` : '';
            const unit = isRecurring(l.unit) ? l.unit : '';
            const group = l.entry.category ? ` (${l.entry.category.name})` : '';
            return `• ${l.entry.item.name}${group}${qty} — ${money(l.amount)}${unit}`;
        });
        const recurring = Array.from(summary.recurring).map(([u, a]) => ` + ${money(a)}${u}`).join('');
        return [
            `Hi ${first}! I'd like a quote based on your rate card:`,
            '',
            ...rows,
            '',
            `Estimated total: ${money(summary.total)}${recurring}`,
            '',
            'About my project: '
        ].join('\n');
    }

    function save() {
        if (!persist) return;
        storage.set({ currency: state.currencyMode, items: Array.from(state.selection) });
    }

    function toast(message) {
        toastEl.textContent = message;
        toastEl.classList.remove('is-on');
        void toastEl.offsetWidth;
        toastEl.classList.add('is-on');
    }

    // --- Events ---
    root.addEventListener('click', async (e) => {
        if (signal.aborted) return;
        const add = e.target.closest('[data-add]');
        if (add) return toggleItem(add.dataset.add, add);

        const remove = e.target.closest('[data-remove]');
        if (remove) {
            state.selection.delete(remove.closest('.rc-line').dataset.id);
            syncSelectedUI();
            renderReceipt();
            return save();
        }

        const qty = e.target.closest('[data-qty]');
        if (qty) {
            const id = qty.closest('.rc-line').dataset.id;
            const next = Math.max(1, Math.min(99, (state.selection.get(id) || 1) + Number(qty.dataset.qty)));
            state.selection.set(id, next);
            renderReceipt();
            return save();
        }

        if (e.target.closest('[data-clear]')) {
            state.selection.clear();
            syncSelectedUI();
            renderReceipt();
            return save();
        }

        const pdf = e.target.closest('[data-pdf]');
        if (pdf) {
            pdf.classList.add('is-busy');
            pdf.disabled = true;
            try {
                const { downloadRateCardPdf } = await import('./rate-card-pdf.js');
                const summary = summarizeEstimate(state.selection, catalog, currency());
                await downloadRateCardPdf(data, { currency: currency(), summary });
                toast('Rate card downloaded ✓');
            } catch (err) {
                console.error(err);
                toast('Could not create the PDF. Please check your connection and try again.');
            } finally {
                pdf.classList.remove('is-busy');
                pdf.disabled = false;
            }
        }
    }, { signal });

    // --- First reveal ---
    const reveal = () => {
        if (state.seen) return;
        state.seen = true;
        root.classList.add('is-revealed');
        dealIn(true);
        paintPrices({ fromZero: true, animateNumbers: true });
    };
    if (intro && 'IntersectionObserver' in window && !reducedMotion()) {
        const io = new IntersectionObserver((entries) => {
            if (entries.some((en) => en.isIntersecting)) { reveal(); io.disconnect(); }
        }, { threshold: 0.15 });
        io.observe(cardsEl);
        signal.addEventListener('abort', () => io.disconnect());
    } else {
        state.seen = true;
        root.classList.add('is-revealed');
    }

    if ('ResizeObserver' in window) {
        const ro = new ResizeObserver(() => moveInk());
        ro.observe(tabsEl);
        signal.addEventListener('abort', () => ro.disconnect());
    }
    document.fonts?.ready.then(moveInk);

    renderCards(true, intro);
    moveInk();
    syncSelectedUI();
    renderReceipt();

    return {
        get category() { return categories[state.cat]?.id; },
        selectCategory: (id) => {
            const index = categories.findIndex((c) => c.id === id);
            if (index >= 0) selectTab(index);
        }
    };
}

// --- Auto-mount on the portfolio page ---
const autoRoot = document.querySelector('[data-rate-card]');
if (autoRoot) {
    loadRateCard()
        .then((data) => mountRateCard(autoRoot, data))
        .catch((err) => {
            console.error(err);
            autoRoot.innerHTML = `<div class="rc-error"><h2 class="section-title">Rate Card</h2>
                <p>The rate card couldn't load right now. <a href="#/contact">Contact me</a> for current pricing.</p></div>`;
        });
}

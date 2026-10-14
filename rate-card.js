// --- Rate Card ---
// Renders the rate card from data/rate-card.json. Prices are edited in that
// file only (or via rate-card-editor.html on localhost) and published by
// pushing to GitHub — visitors can build an estimate but never change prices.

const RATE_CARD_URL = 'data/rate-card.json';
const STORAGE_KEY = 'rc-estimate-v1';
const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const isPhone = () => window.matchMedia('(max-width: 768px)').matches;
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

// Lowest-priced package, preferring one-off prices over hourly rates.
export function startingPackage(category) {
    const pkgs = category.packages || [];
    const oneOff = pkgs.filter((p) => !/hour/i.test(unitOf(p)));
    return (oneOff.length ? oneOff : pkgs).reduce((min, p) => (Number(p.price) < Number(min.price) ? p : min));
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

// Short reference for an estimate: same items on the same day give the same ref,
// so the saved quote image and the WhatsApp message always match.
export function quoteRef(summary, date = new Date()) {
    const ymd = `${String(date.getFullYear()).slice(2)}${String(date.getMonth() + 1).padStart(2, '0')}${String(date.getDate()).padStart(2, '0')}`;
    const key = `${summary.lines.map((l) => `${l.id}x${l.qty}`).join('|')}@${ymd}`;
    let hash = 7;
    for (const ch of key) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
    return `Q-${ymd}-${hash.toString(36).toUpperCase().slice(-4).padStart(4, '0')}`;
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


    // Re-mounting (editor preview) must drop the previous instance's listeners.
    root._rcAbort?.abort();
    const lifecycle = new AbortController();
    root._rcAbort = lifecycle;
    const { signal } = lifecycle;

    root.classList.add('rc-root');
    root.innerHTML = `
        <div class="rc-head">
            <span class="rc-kicker"><i class="fas fa-tags" aria-hidden="true"></i> Honest pricing</span>
            <h2 class="section-title rc-title">${esc(meta.title || 'Rate Card')}${UNDERLINE_SVG}</h2>
            <p class="section-subtitle rc-subtitle">${esc(meta.subtitle)}</p>
            <div class="rc-toolbar">
                ${meta.secondaryCurrency ? `
                <div class="rc-currency" role="radiogroup" aria-label="Currency">
                    <span class="rc-currency-thumb" aria-hidden="true"></span>
                    <button type="button" role="radio" data-cur="primary">${esc(meta.currency || 'RM')}</button>
                    <button type="button" role="radio" data-cur="secondary">${esc(meta.secondaryCurrency.code)}</button>
                </div>` : ''}
                <button type="button" class="rc-btn rc-btn-ink rc-download" data-rc-download="card">
                    <i class="fas fa-image" aria-hidden="true"></i> <span>Download rate card</span>
                </button>
                ${meta.updated ? `<span class="rc-updated"><i class="far fa-calendar-check" aria-hidden="true"></i> Updated ${esc(formatDate(meta.updated))}</span>` : ''}
            </div>
        </div>

        <h3 class="rc-ask">What do you need?</h3>
        <div class="rc-tabs" role="tablist" aria-label="What do you need?">
            ${categories.map((c, i) => {
                const cheapest = startingPackage(c);
                return `
                <button type="button" class="rc-tab" role="tab" id="rc-tab-${esc(c.id)}" aria-controls="rc-panel"
                    aria-selected="${i === state.cat}" tabindex="${i === state.cat ? 0 : -1}" data-index="${i}" style="--i:${i}">
                    <span class="rc-tab-icon" aria-hidden="true"><i class="fas ${esc(c.icon || 'fa-star')}"></i></span>
                    <span class="rc-tab-name">${esc(c.name)}</span>
                    <span class="rc-tab-from" data-from="${esc(cheapest.id)}"></span>
                </button>`;
            }).join('')}
        </div>

        <p class="rc-blurb" aria-live="polite"></p>
        <div class="rc-cards" id="rc-panel" role="tabpanel"></div>
        <div class="rc-dots" aria-hidden="true"></div>

        ${(meta.process || []).length ? `
        <div class="rc-process">
            <h3 class="rc-h3 rc-h3-center">How it works</h3>
            <ol class="rc-steps-visual">
                ${meta.process.map((step, i) => `
                    <li style="--i:${i}">
                        <span class="rc-step-icon" aria-hidden="true"><i class="fas ${esc(step.icon || 'fa-circle')}"></i><b>${i + 1}</b></span>
                        <strong>${esc(step.title)}</strong>
                        <small>${esc(step.text)}</small>
                    </li>`).join('')}
            </ol>
        </div>` : ''}

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
                            <span class="rc-chip-name">${a.icon ? `<i class="fas ${esc(a.icon)}" aria-hidden="true"></i> ` : ''}${esc(a.name)}</span>
                            <span class="rc-chip-price" data-price="${esc(a.id)}"></span>
                        </button>`).join('')}
                </div>` : ''}
                ${(meta.perks || []).length ? `
                <ul class="rc-perks">
                    ${meta.perks.map((perk, i) => `<li style="--i:${i}"><i class="fas ${esc(perk.icon || 'fa-check')}" aria-hidden="true"></i><span>${esc(perk.text)}</span></li>`).join('')}
                </ul>` : ''}
                ${(meta.notes || []).length ? `
                <p class="rc-fineprint">${meta.notes.map(esc).join(' ')}</p>` : ''}
            </div>

            <div class="rc-receipt-wrap" id="rc-sheet">
                <div class="rc-sheet-handle">
                    <span aria-hidden="true"></span>
                    <button type="button" data-sheet-close aria-label="Close estimate"><i class="fas fa-xmark" aria-hidden="true"></i></button>
                </div>
                <div class="rc-printer" aria-hidden="true"><span class="rc-printer-led"></span><span class="rc-printer-slot"></span></div>
                <div class="rc-receipt" aria-label="Your estimate">
                    <div class="rc-receipt-head">
                        <strong>${esc(meta.owner || 'Estimate')}</strong>
                        <span>${esc(meta.role || '')}</span>
                        <span class="rc-receipt-meta">${esc(formatDate(new Date().toISOString().slice(0, 10)))}</span>
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
                        <button type="button" class="rc-btn rc-btn-ghost rc-save-quote" data-rc-download="quote"><i class="fas fa-receipt" aria-hidden="true"></i> Save quote</button>
                        <button type="button" class="rc-btn rc-btn-ghost rc-clear" data-clear><i class="fas fa-rotate-left" aria-hidden="true"></i> Clear</button>
                    </div>
                    <div class="rc-barcode" aria-hidden="true"></div>
                    <p class="rc-receipt-foot">Estimate only — final quote after a free discovery call.</p>
                </div>
            </div>
        </div>
        <button type="button" class="rc-sheet-bar" data-sheet-open aria-controls="rc-sheet" aria-expanded="false">
            <span class="rc-sheet-count"><i class="fas fa-receipt" aria-hidden="true"></i><b>0</b></span>
            <span class="rc-sheet-label">Your estimate</span>
            <strong class="rc-sheet-total"></strong>
            <i class="fas fa-chevron-up" aria-hidden="true"></i>
        </button>
        <div class="rc-sheet-backdrop" data-sheet-close></div>
        <div class="rc-toast" role="status" aria-live="polite"></div>
    `;

    const $ = (sel) => root.querySelector(sel);
    const $$ = (sel) => Array.from(root.querySelectorAll(sel));
    const tabsEl = $('.rc-tabs');
    const dotsEl = $('.rc-dots');
    const cardsEl = $('.rc-cards');
    const blurbEl = $('.rc-blurb');
    const linesEl = $('.rc-lines');
    const receiptEl = $('.rc-receipt');
    const totalEl = $('.rc-total');
    const toastEl = $('.rc-toast');

    const currency = () => currencyFor(meta, state.currencyMode);

    // --- Picker ---
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
        const tile = $$('.rc-tab')[index];
        animate(tile?.querySelector('.rc-tab-icon'), [
            { transform: 'scale(1) rotate(0deg)' }, { transform: 'scale(1.25) rotate(-12deg)' }, { transform: 'scale(1) rotate(0deg)' }
        ], { duration: 500, easing: 'ease-out' });
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
    function cardMarkup(pkg, i, category) {
        const unit = unitOf(pkg);
        const selected = state.selection.has(pkg.id);
        return `
            <article class="rc-card${pkg.popular ? ' is-popular' : ''}${selected ? ' is-selected' : ''}" data-id="${esc(pkg.id)}" style="--tilt:${TILTS[i % TILTS.length]}deg">
                <div class="rc-card-inner">
                    <span class="rc-glare" aria-hidden="true"></span>
                    ${pkg.popular ? `<span class="rc-ribbon">Most popular${SCRIBBLE_SVG}</span>` : ''}
                    <span class="rc-card-icon" aria-hidden="true"><i class="fas ${esc(pkg.icon || category.icon || 'fa-star')}"></i></span>
                    <h3 class="rc-card-name">${esc(pkg.name)}</h3>
                    ${pkg.bestFor || pkg.tagline ? `<p class="rc-bestfor"><span>Best for</span>${esc(pkg.bestFor || pkg.tagline)}</p>` : ''}
                    <div class="rc-price">
                        ${pkg.prefix ? `<span class="rc-prefix">${esc(pkg.prefix)}</span>` : ''}
                        <span class="rc-amount"><span class="rc-sym"></span><span class="rc-num" data-value="${Number(pkg.price) || 0}">0</span></span>
                        ${unit ? `<span class="rc-suffix">${esc(unit)}</span>` : ''}
                    </div>
                    ${pkg.timeline ? `<p class="rc-timeline"><i class="fas fa-clock" aria-hidden="true"></i> ${esc(pkg.timeline)}</p>` : ''}
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
        cardsEl.innerHTML = category.packages.map((pkg, i) => cardMarkup(pkg, i, category)).join('');
        setupSwipe(category);
        paintPrices({ fromZero: true, animateNumbers: state.seen });
        bindTilt();
        if (state.seen && deal) dealIn(forward);
    }

    // On phones the cards become a swipeable row; start on the popular one.
    function setupSwipe(category) {
        const cards = Array.from(cardsEl.children);
        dotsEl.innerHTML = cards.map((_, i) => `<span data-dot="${i}"></span>`).join('');
        const popular = Math.max(0, category.packages.findIndex((p) => p.popular));
        const swipeMode = () => cardsEl.scrollWidth > cardsEl.clientWidth + 4;
        const markDot = (index) => dotsEl.querySelectorAll('span').forEach((d, i) => d.classList.toggle('is-on', i === index));
        requestAnimationFrame(() => {
            if (!swipeMode()) return markDot(-1);
            const card = cards[popular];
            cardsEl.scrollLeft = card.offsetLeft - (cardsEl.clientWidth - card.offsetWidth) / 2;
            markDot(popular);
        });
        cardsEl.onscroll = () => {
            const center = cardsEl.scrollLeft + cardsEl.clientWidth / 2;
            let best = 0;
            cards.forEach((card, i) => {
                const mid = card.offsetLeft + card.offsetWidth / 2;
                if (Math.abs(mid - center) < Math.abs(cards[best].offsetLeft + cards[best].offsetWidth / 2 - center)) best = i;
            });
            markDot(best);
        };
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
        root.querySelectorAll('.rc-tab-from').forEach((el) => {
            const entry = catalog.get(el.dataset.from);
            el.textContent = `from ${cur.approx ? '≈' : ''}${cur.symbol} ${formatNumber(convert(entry.item.price, cur))}${entry.unit || ''}`;
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
        const target = isPhone() ? $('.rc-sheet-bar') : receiptEl;
        let to = target.getBoundingClientRect();
        if (isPhone() && to.top > window.innerHeight - 40) {
            // The bar is still sliding in: aim for where it will land.
            to = { left: 12, width: window.innerWidth - 24, top: window.innerHeight - 140 };
        }
        if (!isPhone() && (to.bottom < 0 || to.top > window.innerHeight)) return; // receipt is off-screen
        const dot = document.createElement('span');
        dot.className = 'rc-fly';
        dot.style.left = `${from.left + from.width / 2}px`;
        dot.style.top = `${from.top + from.height / 2}px`;
        document.body.appendChild(dot);
        const dx = to.left + to.width / 2 - (from.left + from.width / 2);
        const dy = to.top + (isPhone() ? 20 : 60) - (from.top + from.height / 2);
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
        root.classList.toggle('has-items', count > 0);
        $('.rc-receipt-meta').textContent = [count ? quoteRef(summary) : '', formatDate(new Date().toISOString().slice(0, 10))].filter(Boolean).join(' · ');
        $('.rc-sheet-count b').textContent = count;
        $('.rc-sheet-total').textContent = `${cur.approx ? '≈' : ''}${cur.symbol} ${formatNumber(summary.total)}${summary.recurring.size ? ' +' : ''}`;
        if (count === 0) setSheet(false);
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

        if (bump && isPhone()) {
            animate($('.rc-sheet-bar'), [
                { transform: 'scale(1)' }, { transform: 'scale(1.06)' }, { transform: 'scale(1)' }
            ], { duration: 380, delay: 450, easing: 'ease-out' });
        } else if (bump) {
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

    function setSheet(open) {
        root.classList.toggle('sheet-open', open);
        $('.rc-sheet-bar').setAttribute('aria-expanded', open);
        document.documentElement.classList.toggle('rc-sheet-lock', open);
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
            `Ref: ${quoteRef(summary)}`,
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
        if (e.target.closest('[data-sheet-open]')) return setSheet(true);
        if (e.target.closest('[data-sheet-close]')) return setSheet(false);
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

        const download = e.target.closest('[data-rc-download]');
        if (download) {
            const kind = download.dataset.rcDownload;
            download.classList.add('is-busy');
            download.disabled = true;
            try {
                const images = await import('./rate-card-image.js');
                const summary = summarizeEstimate(state.selection, catalog, currency());
                const result = kind === 'quote'
                    ? await images.downloadQuoteImage(data, { currency: currency(), summary, quoteRef: quoteRef(summary) })
                    : await images.downloadRateCardImage(data, { currency: currency() });
                if (result === 'downloaded') toast(kind === 'quote' ? 'Quote saved ✓' : 'Rate card saved ✓');
            } catch (err) {
                console.error(err);
                toast('Could not create the image. Please try again.');
            } finally {
                download.classList.remove('is-busy');
                download.disabled = false;
            }
        }
    }, { signal });

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && root.classList.contains('sheet-open')) setSheet(false);
    }, { signal });
    window.addEventListener('hashchange', () => setSheet(false), { signal });

    // --- First reveal ---
    const reveal = () => {
        if (state.seen) return;
        state.seen = true;
        root.classList.add('is-revealed');
        dealIn(true);
        paintPrices({ fromZero: true, animateNumbers: true });
    };
    // Steps and perks animate in when they scroll into view.
    const extras = root.querySelectorAll('.rc-process, .rc-perks');
    if (intro && 'IntersectionObserver' in window && !reducedMotion()) {
        const io2 = new IntersectionObserver((entries) => entries.forEach((en) => {
            if (en.isIntersecting) { en.target.classList.add('is-in'); io2.unobserve(en.target); }
        }), { threshold: 0.3 });
        extras.forEach((el) => io2.observe(el));
        signal.addEventListener('abort', () => io2.disconnect());
    } else {
        extras.forEach((el) => el.classList.add('is-in', 'no-anim'));
    }

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


    renderCards(true, intro);
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
    // Deep links like #/rates/systems open that category.
    const categoryFromHash = () => (location.hash.match(/^#\/rates\/([\w-]+)/) || [])[1];
    loadRateCard()
        .then((data) => {
            const card = mountRateCard(autoRoot, data, { initialCategory: categoryFromHash() });
            window.addEventListener('hashchange', () => {
                const id = categoryFromHash();
                if (id) card.selectCategory(id);
            });
        })
        .catch((err) => {
            console.error(err);
            autoRoot.innerHTML = `<div class="rc-error"><h2 class="section-title">Rate Card</h2>
                <p>The rate card couldn't load right now. <a href="#/contact">Contact me</a> for current pricing.</p></div>`;
        });
}

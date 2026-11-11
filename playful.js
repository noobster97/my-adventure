// Paper themes, the paper buddy and hero doodles that react to the cursor.
// Everything here is decoration: the site works the same if this file fails.

const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)');

/* ---------- Paper themes ---------- */
const PAPERS = [
    { id: 'graph', label: 'Graph', color: '#fdfbf7' },
    { id: 'kraft', label: 'Kraft', color: '#d9bc93' },
    { id: 'blueprint', label: 'Blueprint', color: '#1c4b8a', dark: true },
    { id: 'chalk', label: 'Chalkboard', color: '#25372f', dark: true },
];
const STORE_KEY = 'paper';
const root = document.documentElement;

function currentPaper() {
    return PAPERS.find((p) => p.id === root.dataset.paper) || PAPERS[0];
}

function applyPaper(paper) {
    root.dataset.paper = paper.id;
    if (paper.dark) root.dataset.tone = 'dark';
    else delete root.dataset.tone;
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', paper.color);
    document.querySelectorAll('.paper-opt').forEach((opt) => {
        opt.setAttribute('aria-checked', String(opt.dataset.paper === paper.id));
    });
    document.querySelectorAll('.paper-chip').forEach((chip) => {
        chip.style.background = paper.color;
    });
}

function setPaper(id, origin) {
    const paper = PAPERS.find((p) => p.id === id);
    if (!paper || paper.id === currentPaper().id) return;
    try { localStorage.setItem(STORE_KEY, paper.id); } catch { /* private mode */ }

    if (!document.startViewTransition || reducedMotion.matches) {
        applyPaper(paper);
        return;
    }
    const rect = origin?.getBoundingClientRect();
    root.style.setProperty('--paper-x', `${rect ? rect.left + rect.width / 2 : innerWidth / 2}px`);
    root.style.setProperty('--paper-y', `${rect ? rect.top + rect.height / 2 : 0}px`);
    root.classList.add('paper-switching');
    const transition = document.startViewTransition(() => applyPaper(paper));
    transition.finished.finally(() => root.classList.remove('paper-switching'));
}

function buildSwitch(floating) {
    const wrap = document.createElement('div');
    wrap.className = `paper-switch${floating ? ' is-floating' : ''}`;
    const popId = `paper-pop-${floating ? 'm' : 'd'}`;
    wrap.innerHTML = `
        <button type="button" class="paper-btn" aria-haspopup="true" aria-expanded="false"
            aria-controls="${popId}" aria-label="Change the paper style">
            <span class="paper-chip" aria-hidden="true"></span>
            <span class="paper-btn-label">Paper</span>
        </button>
        <div class="paper-pop" id="${popId}" role="radiogroup" aria-label="Paper style">
            ${PAPERS.map((p) => `
                <button type="button" class="paper-opt" role="radio" aria-checked="false" data-paper="${p.id}">
                    <span class="paper-swatch" data-swatch="${p.id}" aria-hidden="true"></span>
                    <span>${p.label}</span>
                </button>`).join('')}
        </div>`;

    const btn = wrap.querySelector('.paper-btn');
    const toggle = (open) => {
        wrap.classList.toggle('is-open', open);
        btn.setAttribute('aria-expanded', String(open));
    };
    btn.addEventListener('click', () => toggle(!wrap.classList.contains('is-open')));
    wrap.querySelectorAll('.paper-opt').forEach((opt) => {
        opt.addEventListener('click', () => {
            setPaper(opt.dataset.paper, btn);
            toggle(false);
        });
    });
    document.addEventListener('click', (e) => {
        if (!wrap.contains(e.target)) toggle(false);
    });
    wrap.addEventListener('keydown', (e) => {
        if (e.key !== 'Escape') return;
        toggle(false);
        btn.focus();
    });
    return wrap;
}

function initPapers() {
    const cta = document.querySelector('.nav-links .nav-cta');
    cta?.before(buildSwitch(false));
    document.body.append(buildSwitch(true));
    applyPaper(currentPaper());
}

/* ---------- One shared pointer position ---------- */
const pointer = { x: -9999, y: -9999, seen: false };
const listeners = new Set();
let frame = 0;

function onPointer(e) {
    pointer.x = e.clientX;
    pointer.y = e.clientY;
    pointer.seen = true;
    if (frame) return;
    frame = requestAnimationFrame(() => {
        frame = 0;
        listeners.forEach((fn) => fn());
    });
}

/* ---------- Hero doodles ---------- */
const DOODLES = [
    // [svg body, x, y, size, depth, colour class, desktop only]
    ['<path d="M24 4l5.5 13.5L44 19l-11 9.5L36.5 43 24 35l-12.500 8L15 28.500 4 19l14.500-1.500z"/>', '9%', '24%', 46, 26, 'is-yellow', false],
    ['<path d="M4 30c6-14 10 14 16 0s10 14 16 0 8 6 8 6"/>', '84%', '22%', 58, 34, 'is-red', false],
    ['<path d="M6 40L42 8M42 8H24M42 8v18"/>', '14%', '68%', 42, 18, '', true],
    ['<path d="M4 24L44 6 30 42l-8-14z"/><path d="M22 28L44 6"/>', '88%', '62%', 50, 40, '', false],
    ['<circle cx="24" cy="24" r="17"/><path d="M24 24m-9 0a9 9 0 1 0 18 0a5 5 0 1 0-10 0"/>', '4%', '46%', 40, 14, 'is-red', true],
    ['<path d="M10 8L4 24l6 16M38 8l6 16-6 16M28 6L20 42"/>', '93%', '42%', 44, 22, 'is-yellow', true],
    ['<path d="M24 6v36M6 24h36M11 11l26 26M37 11L11 37"/>', '74%', '80%', 30, 30, '', true],
    ['<path d="M8 36c0-16 8-26 16-26s16 10 16 26"/><path d="M8 36h32"/>', '24%', '84%', 34, 12, 'is-yellow', true],
];

function initDoodles() {
    const hero = document.querySelector('.hero');
    if (!hero) return;
    const layer = document.createElement('div');
    layer.className = 'hero-doodles';
    layer.setAttribute('aria-hidden', 'true');
    const items = DOODLES.map(([body, x, y, size, depth, tone, desk], n) => {
        const el = document.createElement('span');
        el.className = `hero-doodle ${tone}${desk ? ' is-desk' : ''}`;
        el.style.cssText = `--x:${x};--y:${y};--size:${size}px;--n:${n}`;
        el.innerHTML = `<svg viewBox="0 0 48 48">${body}</svg>`;
        layer.append(el);
        return { el, depth, dx: 0, dy: 0, rot: 0, tx: 0, ty: 0, trot: 0 };
    });
    hero.prepend(layer);

    if (!finePointer.matches || reducedMotion.matches) return;

    let running = false;
    const REACH = 170;

    function aim() {
        const box = hero.getBoundingClientRect();
        if (box.bottom < 0 || box.top > innerHeight) return;
        // Whole layer leans with the cursor; each doodle also dodges it.
        const nx = (pointer.x - (box.left + box.width / 2)) / box.width;
        const ny = (pointer.y - (box.top + box.height / 2)) / box.height;
        items.forEach((item) => {
            const r = item.el.getBoundingClientRect();
            const cx = r.left + r.width / 2 - item.dx;
            const cy = r.top + r.height / 2 - item.dy;
            const ox = cx - pointer.x;
            const oy = cy - pointer.y;
            const dist = Math.hypot(ox, oy) || 1;
            const push = Math.max(0, 1 - dist / REACH);
            item.tx = -nx * item.depth + (ox / dist) * push * 46;
            item.ty = -ny * item.depth + (oy / dist) * push * 46;
            item.trot = push * (ox > 0 ? 28 : -28);
        });
        if (!running) {
            running = true;
            requestAnimationFrame(step);
        }
    }

    function step() {
        let moving = false;
        items.forEach((item) => {
            item.dx += (item.tx - item.dx) * 0.12;
            item.dy += (item.ty - item.dy) * 0.12;
            item.rot += (item.trot - item.rot) * 0.12;
            if (Math.abs(item.tx - item.dx) + Math.abs(item.ty - item.dy) > 0.2) moving = true;
            item.el.style.setProperty('--dx', `${item.dx.toFixed(1)}px`);
            item.el.style.setProperty('--dy', `${item.dy.toFixed(1)}px`);
            item.el.style.setProperty('--rot', `${item.rot.toFixed(1)}deg`);
        });
        if (moving) requestAnimationFrame(step);
        else running = false;
    }

    listeners.add(aim);
}

/* ---------- Paper buddy ---------- */
const LINES = [
    'Hi! I\'m Kertas. 👋',
    'Try a new paper — tap “Paper” up top!',
    'Need a website? Peek at the Rates page.',
    'Psst… the doodles run from your cursor.',
    'Selamat datang! Have a look around.',
    'Syafiq replies fast on WhatsApp.',
];

function initBuddy() {
    const wrap = document.createElement('div');
    wrap.className = 'buddy-wrap';
    wrap.dataset.mood = 'idle';
    wrap.innerHTML = `
        <div class="buddy-bubble" role="status" aria-live="polite"></div>
        <button type="button" class="buddy" aria-label="Say hi to Kertas, the paper buddy">
            <svg viewBox="0 0 84 84" aria-hidden="true">
                <g class="buddy-arm"><path class="buddy-line" d="M70 46l12-14"/></g>
                <path class="buddy-note" d="M10 12h64v48L60 74H10z"/>
                <path class="buddy-fold" d="M74 60H60v14z"/>
                <circle class="buddy-eye" cx="31" cy="36" r="9"/>
                <circle class="buddy-eye" cx="55" cy="36" r="9"/>
                <circle class="buddy-pupil" cx="31" cy="36" r="4"/>
                <circle class="buddy-pupil" cx="55" cy="36" r="4"/>
                <rect class="buddy-lids" x="20" y="25" width="46" height="22"/>
                <circle class="buddy-cheek" cx="21" cy="50" r="4.500"/>
                <circle class="buddy-cheek" cx="65" cy="50" r="4.500"/>
                <path class="buddy-line buddy-mouth" d="M36 53q7 6 14 0"/>
                <circle class="buddy-line buddy-mouth-o" cx="43" cy="55" r="3"/>
            </svg>
        </button>`;
    document.body.append(wrap);

    const buddy = wrap.querySelector('.buddy');
    const bubble = wrap.querySelector('.buddy-bubble');
    let line = 0;
    let talkTimer = 0;

    function look() {
        const r = buddy.getBoundingClientRect();
        const ox = pointer.x - (r.left + r.width / 2);
        const oy = pointer.y - (r.top + r.height * 0.43);
        const dist = Math.hypot(ox, oy) || 1;
        const reach = Math.min(1, dist / 90) * 4.5;
        wrap.style.setProperty('--px', `${((ox / dist) * reach).toFixed(1)}px`);
        wrap.style.setProperty('--py', `${((oy / dist) * reach).toFixed(1)}px`);
        if (!finePointer.matches) return;
        wrap.dataset.mood = dist < 70 ? 'shy' : dist < 300 ? 'curious' : 'idle';
    }
    listeners.add(look);

    buddy.addEventListener('click', () => {
        bubble.textContent = LINES[line % LINES.length];
        line += 1;
        wrap.classList.add('is-talking');
        if (!reducedMotion.matches) {
            wrap.classList.remove('is-hopping');
            void buddy.offsetWidth;
            wrap.classList.add('is-hopping');
        }
        clearTimeout(talkTimer);
        talkTimer = setTimeout(() => wrap.classList.remove('is-talking'), 3800);
    });

    // Phones have no hover, so Kertas pops up for a wave now and then.
    if (!finePointer.matches && !reducedMotion.matches) {
        const wave = () => {
            if (document.hidden) return;
            wrap.dataset.mood = 'curious';
            setTimeout(() => { wrap.dataset.mood = 'idle'; }, 2200);
        };
        setTimeout(wave, 1800);
        setInterval(wave, 14000);
    }
}

initPapers();
initDoodles();
initBuddy();
window.addEventListener('pointermove', onPointer, { passive: true });
window.addEventListener('pointerdown', onPointer, { passive: true });

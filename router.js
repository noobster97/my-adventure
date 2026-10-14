// --- Page Router ---
// Hash-based SPA routing (#/work, #/rates, ...) so the site works on GitHub
// Pages without server config, keeps shareable links and the back button.

const views = Array.from(document.querySelectorAll('.view[data-view]'));
const ORDER = views.map((v) => v.dataset.view);
const DEFAULT_VIEW = 'home';

// Old one-page anchors (#projects, #experience, ...) still land in the right place.
const LEGACY = {
    home: ['home'],
    services: ['home', 'services'],
    skills: ['home', 'skills'],
    projects: ['work'],
    work: ['work'],
    experience: ['about'],
    about: ['about'],
    rates: ['rates'],
    contact: ['contact']
};

const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
let current = null;

function parse(hash) {
    const clean = decodeURIComponent(hash.replace(/^#\/?/, ''));
    const [first = '', anchor] = clean.split('/');
    if (!first) return { view: DEFAULT_VIEW };
    if (hash.startsWith('#/') && ORDER.includes(first)) return { view: first, anchor };
    if (LEGACY[first]) {
        const [view, legacyAnchor] = LEGACY[first];
        return { view, anchor: legacyAnchor, legacy: true };
    }
    return { view: DEFAULT_VIEW };
}

function moveIndicator() {
    const bar = document.querySelector('.bottom-nav');
    const indicator = bar?.querySelector('.nav-indicator');
    const active = bar?.querySelector('.nav-item.active');
    if (!indicator || !active) return;
    indicator.style.width = `${active.offsetWidth - 8}px`;
    indicator.style.height = `${active.offsetHeight + 6}px`;
    indicator.style.top = `${active.offsetTop - 3}px`;
    indicator.style.transform = `translateX(${active.offsetLeft + 4}px)`;
}

function updateChrome(view) {
    document.querySelectorAll('[data-nav]').forEach((link) => {
        const on = link.dataset.nav === view;
        link.classList.toggle('active', on);
        if (on) link.setAttribute('aria-current', 'page');
        else link.removeAttribute('aria-current');
    });
    document.body.dataset.view = view;
    const title = views.find((v) => v.dataset.view === view)?.dataset.title;
    if (title) document.title = title;
    moveIndicator();
}

function swap(view, anchor, { focus }) {
    views.forEach((v) => {
        const on = v.dataset.view === view;
        v.hidden = !on;
        // Only the visible page plays its videos (saves mobile data).
        v.querySelectorAll('video').forEach((video) => {
            if (!on) video.pause();
            else if (video.closest('.carousel-slide.active')) video.play().catch(() => {});
        });
    });
    updateChrome(view);

    const target = anchor && document.getElementById(anchor);
    if (target) {
        target.scrollIntoView({ block: 'start' });
    } else {
        window.scrollTo(0, 0);
    }

    if (focus) {
        const heading = document.querySelector(`.view[data-view="${view}"] h1, .view[data-view="${view}"] h2`);
        if (heading) {
            heading.setAttribute('tabindex', '-1');
            heading.focus({ preventScroll: true });
        }
    }
}

function navigate({ initial = false } = {}) {
    const { view, anchor, legacy } = parse(location.hash);
    if (legacy) history.replaceState(null, '', view === DEFAULT_VIEW ? '#/' : `#/${view}`);

    if (view === current) {
        const target = anchor && document.getElementById(anchor);
        if (target) target.scrollIntoView({ behavior: reducedMotion() ? 'auto' : 'smooth' });
        return;
    }

    const forward = current === null || ORDER.indexOf(view) >= ORDER.indexOf(current);
    current = view;
    const run = () => swap(view, anchor, { focus: !initial });

    if (initial || reducedMotion()) {
        run();
        return;
    }

    document.documentElement.dataset.navDir = forward ? 'forward' : 'back';
    if (document.startViewTransition) {
        document.startViewTransition(run);
    } else {
        run();
        const page = views.find((v) => v.dataset.view === view);
        page.classList.remove('is-entering');
        void page.offsetWidth;
        page.classList.add('is-entering');
    }
}

window.addEventListener('hashchange', () => navigate());
window.addEventListener('resize', moveIndicator);
document.fonts?.ready.then(moveIndicator);
navigate({ initial: true });

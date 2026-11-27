// The 3D paper desk: the site's main view (desk mode).
// The desk sits behind every page. Each page is an object on it:
// photos = Work, price tag = Rates, ID card = About, paper plane = Contact.
// Opening a page (from the dock, a link, or by tapping the object) flies the camera to that
// object while the page opens in #app (side panel on desktop, bottom sheet on phones).
// Kertas, the paper buddy, walks to whatever you open and reacts when you poke it.
// If Three.js can't load, <html> loses .has-desk and the site is a normal multi-page site.

const THREE_URL = 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js';
const root = document.documentElement;
const stage = document.querySelector('.desk-stage');
const app = document.getElementById('app');
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
const track = (name, data) => document.dispatchEvent(new CustomEvent('track', { detail: { name, data } }));

if (stage && app && root.classList.contains('has-desk')) {
    initSheet();
    import(THREE_URL)
        .then((THREE) => {
            const fonts = document.fonts
                ? Promise.race([
                    Promise.all([document.fonts.load('40px "Patrick Hand"'), document.fonts.load('600 30px Outfit')]),
                    new Promise((r) => setTimeout(r, 1500)),
                ])
                : Promise.resolve();
            return fonts.catch(() => {}).then(() => buildDesk(THREE));
        })
        .catch((err) => {
            console.warn('3D desk is off:', err);
            root.classList.remove('has-desk', 'sheet-full');
        });
}

const route = () => document.body.dataset.view || 'home';

// Esc closes the open page and goes back to the desk.
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && root.classList.contains('has-desk') && route() !== 'home' && !e.defaultPrevented) location.hash = '#/';
});
const phone = () => window.innerWidth <= 760;

/* ---------- Phone bottom sheet ----------
   Two resting heights: "peek" (desk on top, page below) and "full" (page fills the screen).
   Drag the grip, tap it, or scroll the page to switch. Every new page starts at peek. */
function initSheet() {
    const grip = app.querySelector('.sheet-grip');
    const setFull = (full) => {
        root.classList.toggle('sheet-full', full);
        grip?.setAttribute('aria-label', full ? 'Show the desk' : 'Show more');
        document.dispatchEvent(new Event('sheetchange'));
    };
    grip?.addEventListener('click', () => { if (!dragged) setFull(!root.classList.contains('sheet-full')); });

    // scrolling the page while it peeks opens it fully
    app.addEventListener('scroll', () => {
        if (phone() && !root.classList.contains('sheet-full') && app.scrollTop > 12) setFull(true);
    }, { passive: true });

    // drag the grip (or the top strip of the sheet) up and down
    let startY = 0, startOffset = 0, dragging = false, dragged = false, lastY = 0, lastT = 0, speed = 0;
    const peekOffset = () => window.innerHeight * 0.46;
    const bar = app.querySelector('.panel-bar');
    const onDown = (e) => {
        if (!phone()) return;
        dragging = true; dragged = false;
        startY = lastY = e.clientY; lastT = performance.now(); speed = 0;
        startOffset = root.classList.contains('sheet-full') ? 0 : peekOffset();
        root.classList.add('sheet-dragging');
        grip.setPointerCapture?.(e.pointerId);
    };
    const onMove = (e) => {
        if (!dragging) return;
        const dy = e.clientY - startY;
        if (Math.abs(dy) > 6) dragged = true;
        const now = performance.now();
        speed = (e.clientY - lastY) / Math.max(1, now - lastT);
        lastY = e.clientY; lastT = now;
        const y = Math.max(0, Math.min(window.innerHeight * 0.7, startOffset + dy));
        app.style.setProperty('--sheet-y', `${y}px`);
        if (y === 0) root.classList.add('sheet-full');
        else root.classList.remove('sheet-full');
    };
    const onUp = () => {
        if (!dragging) return;
        dragging = false;
        root.classList.remove('sheet-dragging');
        const y = parseFloat(app.style.getPropertyValue('--sheet-y')) || startOffset;
        app.style.removeProperty('--sheet-y');
        const full = speed < -0.4 ? true : speed > 0.4 ? false : y < peekOffset() / 2;
        setFull(full);
        setTimeout(() => { dragged = false; }, 0);
    };
    grip?.addEventListener('pointerdown', onDown);
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
    bar?.addEventListener('touchmove', (e) => { if (dragging) e.preventDefault(); }, { passive: false });

    // every page opens at peek, so you see its object first
    new MutationObserver(() => setFull(false)).observe(document.body, { attributes: true, attributeFilter: ['data-view'] });
}

// What Kertas says: a greeting, one line per page, pokes, and paper changes.
const TIME_OF_DAY = (() => {
    // ?desk-time=morning|day|evening|night previews another time of day
    let forced = null;
    try { forced = new URLSearchParams(location.search).get('desk-time'); } catch { /* old browser */ }
    if (['morning', 'day', 'evening', 'night'].includes(forced)) return forced;
    const h = new Date().getHours();
    return h >= 20 || h < 6 ? 'night' : h >= 17 ? 'evening' : h < 11 ? 'morning' : 'day';
})();

function greeting() {
    const visits = +root.dataset.visits || 1;
    const away = +root.dataset.daysAway || 0;
    if (visits > 1 && away >= 1) return `Welcome back! It’s been ${away} day${away > 1 ? 's' : ''}. I missed you!`;
    if (visits > 1) return `Welcome back! Visit number ${visits}.`;
    return {
        morning: "Selamat pagi! I'm Kertas. Tap anything on the desk!",
        evening: "Selamat petang! I'm Kertas. Tap anything on the desk!",
        night: "Working late? Me too. Tap anything on the desk!",
    }[TIME_OF_DAY] || "Hi! I'm Kertas. Tap anything on the desk!";
}

const PAGE_LINES = {
    work: 'These apps are live. Real people use them!',
    rates: 'Tap the tag. There’s more on the back!',
    about: 'Six years of building systems. Not bad, eh?',
    contact: 'Tap the plane and watch it fly!',
};
const POKE_LINES = ['Hehe, that tickles!', 'Selamat datang!', 'I’m made of 100% paper.', 'Try the Paper button up top!', 'Careful, I crease easily.', 'Psst… tap the price tag.'];
const PAPER_LINES = { graph: 'Back to graph paper. Classic!', kraft: 'Ooh, kraft paper. So cosy.', blueprint: 'Blueprint mode. Very engineer.', chalk: 'Chalkboard! Class is in session.' };

function buildDesk(THREE) {
    const canvas = stage.querySelector('.desk-canvas');
    const tip = stage.querySelector('.desk-tip');
    const bubble = stage.querySelector('.kertas-bubble');

    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(36, 1, 0.1, 120);

    // ---------- look: light paper objects with dark ink outlines, on every paper theme ----------
    const INK = '#2c3e50';
    const grad = new THREE.DataTexture(new Uint8Array([120, 200, 255]), 3, 1, THREE.RedFormat);
    grad.minFilter = grad.magFilter = THREE.NearestFilter;
    grad.needsUpdate = true;
    const toon = (color, extra = {}) => new THREE.MeshToonMaterial({ color, gradientMap: grad, ...extra });
    const M = {
        paper: toon('#ffffff'),
        paperBoth: toon('#ffffff', { side: THREE.DoubleSide }),
        kraft: toon('#e2c597'),
        red: toon('#e74c3c'),
        yellow: toon('#f1c40f'),
        blue: toon('#3498db'),
        ink: toon(INK),
        line: new THREE.LineBasicMaterial({ color: INK }),
    };

    function inked(mesh, threshold = 25) {
        mesh.add(new THREE.LineSegments(new THREE.EdgesGeometry(mesh.geometry, threshold), M.line));
        mesh.castShadow = true;
        return mesh;
    }

    function textTexture(w, h, draw) {
        const c = document.createElement('canvas');
        c.width = w; c.height = h;
        draw(c.getContext('2d'), w, h);
        const tex = new THREE.CanvasTexture(c);
        tex.colorSpace = THREE.SRGBColorSpace;
        tex.anisotropy = renderer.capabilities.getMaxAnisotropy();
        return tex;
    }
    const HAND = (px) => `${px}px "Patrick Hand", "Comic Sans MS", cursive`;
    const BODY = (px, wt = 600) => `${wt} ${px}px Outfit, system-ui, sans-serif`;

    // ---------- lights + a floor that only shows shadows (the page's paper shows through) ----------
    // The desk is always the paper colour (like the mockup). Time of day only changes the light on
    // the objects a little, and switches the desk lamp on in the evening and at night.
    const LIGHTING = {
        morning: { sky: 0xfff8ee, ground: 0xd8cbb4, hemi: 2.0, sun: 0xffeccc, sunI: 1.6, sunPos: [-10, 10, 6], lamp: 0 },
        day: { sky: 0xffffff, ground: 0xcfc6b4, hemi: 2.1, sun: 0xffffff, sunI: 1.6, sunPos: [-6, 14, 8], lamp: 0 },
        evening: { sky: 0xffffff, ground: 0xcfc6b4, hemi: 2.0, sun: 0xffe6c8, sunI: 1.4, sunPos: [-12, 8, 4], lamp: 0.7 },
        night: { sky: 0xffffff, ground: 0xcfc6b4, hemi: 1.9, sun: 0xfff2e0, sunI: 1.1, sunPos: [-6, 14, 8], lamp: 1.1 },
    }[TIME_OF_DAY];
    scene.add(new THREE.HemisphereLight(LIGHTING.sky, LIGHTING.ground, LIGHTING.hemi));
    const sun = new THREE.DirectionalLight(LIGHTING.sun, LIGHTING.sunI);
    sun.position.set(...LIGHTING.sunPos);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    Object.assign(sun.shadow.camera, { left: -9, right: 9, top: 9, bottom: -9, near: 1, far: 40 });
    sun.shadow.bias = -0.0008;
    sun.shadow.radius = 4;
    scene.add(sun);

    // The desk itself: the site's current paper (graph, kraft, blueprint or chalk) as a real 3D surface.
    // Seen from straight above it looks just like the flat page; tilted, it recedes into the distance.
    const CELL = 0.4;                       // one 20px grid square, in desk units
    const deskCanvas = document.createElement('canvas');
    deskCanvas.width = deskCanvas.height = 512;   // 5 x 5 grid squares
    const deskTex = new THREE.CanvasTexture(deskCanvas);
    deskTex.colorSpace = THREE.SRGBColorSpace;
    deskTex.wrapS = deskTex.wrapT = THREE.RepeatWrapping;
    deskTex.anisotropy = renderer.capabilities.getMaxAnisotropy();
    const DESK_SIZE = 120;
    deskTex.repeat.set(DESK_SIZE / (CELL * 5), DESK_SIZE / (CELL * 5));
    const deskMat = new THREE.MeshBasicMaterial({ map: deskTex });
    const desk = new THREE.Mesh(new THREE.PlaneGeometry(DESK_SIZE, DESK_SIZE), deskMat);
    desk.rotation.x = -Math.PI / 2;
    desk.position.y = -0.002;
    scene.add(desk);
    scene.fog = new THREE.Fog(0xffffff, 20, 50);

    function paintDesk() {
        const paper = root.dataset.paper || 'graph';
        const bg = getComputedStyle(root).getPropertyValue('--bg-dark').trim() || '#fdfbf7';
        const g = deskCanvas.getContext('2d');
        const n = deskCanvas.width, step = n / 5;
        g.fillStyle = bg;
        g.fillRect(0, 0, n, n);
        const lines = (color, every, width) => {
            g.strokeStyle = color; g.lineWidth = width;
            for (let i = 0; i <= n; i += every) {
                g.beginPath(); g.moveTo(i, 0); g.lineTo(i, n); g.stroke();
                g.beginPath(); g.moveTo(0, i); g.lineTo(n, i); g.stroke();
            }
        };
        if (paper === 'blueprint') {
            lines('rgba(255,255,255,.12)', step, 3);
            lines('rgba(255,255,255,.28)', n, 5);
        } else if (paper === 'kraft') {
            for (let i = 0; i < 900; i++) {
                g.fillStyle = i % 3 ? 'rgba(92,62,28,.16)' : 'rgba(255,244,222,.35)';
                g.beginPath(); g.arc(Math.random() * n, Math.random() * n, 2.5, 0, Math.PI * 2); g.fill();
            }
        } else if (paper === 'chalk') {
            for (let i = 0; i < 60; i++) {
                g.strokeStyle = 'rgba(255,255,255,.035)'; g.lineWidth = 6;
                const y = Math.random() * n;
                g.beginPath(); g.moveTo(0, y); g.lineTo(n, y + 40); g.stroke();
            }
        } else {
            lines('#e1e1e1', step, 4);
        }
        deskTex.needsUpdate = true;
        scene.fog.color.set(bg);
        renderer.setClearColor(scene.fog.color, 1);
        setTimeout(wake);   // the render loop is set up further down
    }

    const floorMat = new THREE.ShadowMaterial({ opacity: 0.16 });
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(60, 60), floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    scene.add(floor);

    const v = new THREE.Vector3();
    const lerp = (a, b, t) => a + (b - a) * t;
    const clamp01 = (x) => Math.max(0, Math.min(1, x));
    const ease = (x) => { x = clamp01(x); return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2; };
    const smooth = (x) => { x = clamp01(x); return x * x * (3 - 2 * x); };

    const items = {};
    const pickables = [];
    function addItem(id, group, base, opts) {
        const item = { id, group, base: new THREE.Vector3(...base), h: 0, f: 0, ...opts };
        group.position.copy(item.base);
        group.traverse((o) => { if (o.isMesh) { o.userData.item = item; pickables.push(o); } });
        scene.add(group);
        items[id] = item;
        return item;
    }

    // ---------- Work: a stack of photos that stand up in a row ----------
    const loader = new THREE.TextureLoader();
    const SHOTS = [
        { src: 'assets/design-web-visualizer-preview-poster.webp', video: 'assets/design-web-visualizer-preview.mp4', name: 'Design Visualizer', rest: [0.32, 0.02, 0.26, 0.32] },
        { src: 'assets/maispend-preview-poster.webp', video: 'assets/maispend-preview.mp4', name: 'maispend', rest: [-0.28, 0.07, -0.08, -0.22] },
        { src: 'assets/maigambar-preview-poster.webp', video: 'assets/maigambar-preview.mp4', name: 'MaiGambar.my', rest: [0.04, 0.12, 0.04, 0.05] },
    ];
    // centre-crop a wide screenshot or video into the 4:3 photo window
    function cropTo(t, aspect) {
        const box = 1.76 / 1.32;
        if (aspect > box) { t.repeat.set(box / aspect, 1); t.offset.set((1 - box / aspect) / 2, 0); }
        else { t.repeat.set(1, aspect / box); t.offset.set(0, (1 - aspect / box) / 2); }
    }
    const workG = new THREE.Group();
    const photos = SHOTS.map((s) => {
        const g = new THREE.Group();
        g.add(inked(new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.04, 2.45), M.paper)));
        const tex = loader.load(s.src, (t) => { cropTo(t, t.image.width / t.image.height); wake(); });
        tex.colorSpace = THREE.SRGBColorSpace;
        tex.anisotropy = renderer.capabilities.getMaxAnisotropy();
        const photo = new THREE.Mesh(new THREE.PlaneGeometry(1.76, 1.32), new THREE.MeshBasicMaterial({ map: tex, color: 0xf2f2f2 }));
        photo.rotation.x = -Math.PI / 2;
        photo.position.set(0, 0.022, -0.22);
        g.add(photo);
        const cap = new THREE.Mesh(new THREE.PlaneGeometry(1.76, 0.6), new THREE.MeshBasicMaterial({
            transparent: true,
            map: textTexture(512, 176, (ctx, w, h) => {
                ctx.fillStyle = INK; ctx.font = HAND(64); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
                ctx.fillText(s.name, w / 2, h / 2 + 6);
            }),
        }));
        cap.rotation.x = -Math.PI / 2;
        cap.position.set(0, 0.022, 0.86);
        g.add(cap);
        g.userData.rest = s.rest;
        g.userData.photo = photo;
        g.userData.video = s.video;
        workG.add(g);
        return g;
    });
    addItem('work', workG, [2.8, 0, 2.7], {
        name: 'My work', sub: '3 live apps', tall: 3.2,
        focus: [0.3, 1.3, 1.0], dist: 8.2, span: 9.4, guide: [3.6, 0, 1.0],
        update(t, still) {
            photos.forEach((p, i) => {
                const [x, y, z, ry] = p.userData.rest;
                const fan = 1 + this.h * 0.55;
                const k = ease(this.f * 1.5 - (2 - i) * 0.22);
                const sway = still ? 0 : Math.sin(t * 1.3 + i) * 0.025 * k;
                p.position.set(lerp(x * fan, (1 - i) * 2.25, k), lerp(y + this.h * (0.18 + i * 0.12), 1.8 + (i === 1 ? 0.1 : 0), k), lerp(z * fan, 0.6, k));
                p.rotation.set(lerp(0, Math.PI / 2 - 0.24, k), lerp(ry * fan, (1 - i) * -0.12, k), lerp(0, (1 - i) * -0.05 + sway, k));
            });
        },
    });

    // At the Work stop the photos come alive: each plays its app's preview video.
    // Videos only download when you get there, and never with reduced motion or Data Saver.
    const videosAllowed = !reducedMotion.matches && !(navigator.connection && navigator.connection.saveData);
    let videosReady = false;
    function playVideos(on) {
        if (on && !videosReady && videosAllowed) {
            videosReady = true;
            photos.forEach((g) => {
                const el = document.createElement('video');
                el.muted = true; el.loop = true; el.playsInline = true; el.preload = 'auto';
                el.setAttribute('muted', ''); el.setAttribute('playsinline', '');
                el.src = g.userData.video;
                const vt = new THREE.VideoTexture(el);
                vt.colorSpace = THREE.SRGBColorSpace;
                el.addEventListener('loadedmetadata', () => cropTo(vt, el.videoWidth / el.videoHeight));
                // keep the screenshot until the first real frame, so there's never a black photo
                el.addEventListener('playing', () => { g.userData.photo.material.map = vt; g.userData.photo.material.needsUpdate = true; }, { once: true });
                g.userData.videoEl = el;
            });
        }
        photos.forEach((g) => {
            const el = g.userData.videoEl;
            if (!el) return;
            if (on && el.paused) el.play().catch(() => {});
            else if (!on && !el.paused) el.pause();
        });
    }

    // ---------- Rates: a kraft price tag on a red string ----------
    const tagShape = new THREE.Shape();
    tagShape.moveTo(-0.75, 0.68); tagShape.lineTo(1.25, 0.68); tagShape.lineTo(1.25, -0.68);
    tagShape.lineTo(-0.75, -0.68); tagShape.lineTo(-1.3, 0); tagShape.closePath();
    const hole = new THREE.Path(); hole.absarc(-0.85, 0, 0.1, 0, Math.PI * 2, true); tagShape.holes.push(hole);
    const tagGeo = new THREE.ExtrudeGeometry(tagShape, { depth: 0.06, bevelEnabled: false });
    tagGeo.translate(0, 0, -0.03);
    const tag = new THREE.Group();
    tag.add(inked(new THREE.Mesh(tagGeo, M.kraft)));
    const tagText = new THREE.Mesh(new THREE.PlaneGeometry(1.9, 1.25), new THREE.MeshBasicMaterial({
        transparent: true,
        map: textTexture(608, 400, (ctx, w) => {
            ctx.fillStyle = INK; ctx.textAlign = 'center';
            ctx.font = HAND(56); ctx.fillText('websites from', w / 2, 110);
            ctx.font = HAND(150); ctx.fillText('RM 800', w / 2, 255);
            ctx.strokeStyle = '#e74c3c'; ctx.lineWidth = 7; ctx.lineCap = 'round';
            ctx.beginPath(); ctx.moveTo(90, 285); ctx.bezierCurveTo(220, 270, 380, 300, 520, 278); ctx.stroke();
            ctx.font = BODY(34); ctx.fillText('instant estimate', w / 2, 352);
        }),
    }));
    tagText.position.set(0.22, 0, 0.032);
    tag.add(tagText);
    // The back of the tag: the most-picked package in each category, read from data/rate-card.json.
    let backRows = [];
    const drawBack = (ctx, w) => {
        ctx.clearRect(0, 0, w, 400);
        ctx.fillStyle = INK; ctx.textAlign = 'center';
        ctx.font = HAND(54); ctx.fillText('Most picked', w / 2, 66);
        ctx.strokeStyle = '#e74c3c'; ctx.lineWidth = 6; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(190, 84); ctx.bezierCurveTo(260, 78, 350, 90, 420, 82); ctx.stroke();
        if (!backRows.length) { ctx.font = BODY(28, 500); ctx.fillText('See the rate card below', w / 2, 220); return; }
        backRows.slice(0, 4).forEach((row, i) => {
            const y = 146 + i * 64;
            ctx.textAlign = 'left'; ctx.fillStyle = INK; ctx.font = BODY(28, 600); ctx.fillText(row.name, 40, y);
            ctx.textAlign = 'right'; ctx.fillStyle = '#c0392b'; ctx.font = HAND(42); ctx.fillText(row.price, w - 36, y);
        });
    };
    const backTex = textTexture(608, 400, drawBack);
    const tagBack = new THREE.Mesh(new THREE.PlaneGeometry(1.9, 1.25), new THREE.MeshBasicMaterial({ transparent: true, map: backTex }));
    tagBack.rotation.y = Math.PI;
    tagBack.position.set(0.22, 0, -0.032);
    tag.add(tagBack);
    fetch('data/rate-card.json', { cache: 'no-cache' })
        .then((r) => r.json())
        .then((data) => {
            const cur = data.meta?.currency || 'RM';
            backRows = data.categories.map((c) => {
                const p = c.packages.find((x) => x.popular) || c.packages[0];
                const suffix = (p.suffix || '').replace('/month', '/mo');
                return { name: p.name, price: `${p.prefix ? 'from ' : ''}${cur} ${Number(p.price).toLocaleString('en-MY')}${suffix}` };
            });
            drawBack(backTex.image.getContext('2d'), 608);
            backTex.needsUpdate = true;
            wake();
        })
        .catch(() => {});
    const string = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([
        new THREE.Vector3(-0.85, 0.1, 0), new THREE.Vector3(-0.95, 0.5, 0.05), new THREE.Vector3(-1.5, 0.75, 0.02),
        new THREE.Vector3(-1.85, 0.45, 0), new THREE.Vector3(-2.0, -0.05, 0),
    ]), 40, 0.03, 6), M.red);
    string.castShadow = true;
    tag.add(string);
    const ratesG = new THREE.Group();
    ratesG.add(tag);
    ratesG.rotation.y = 0.06;
    addItem('rates', ratesG, [7.0, 0, 2.8], {
        name: 'Rates', sub: 'from RM 800', action: 'tap to flip', tall: 2.0,
        focus: [-0.4, 1.0, 0.3], dist: 6.2, span: 6.4, guide: [-2.7, 0, 0.4],
        flip: 0, flipTo: 0,
        update(t, still) {
            const k = ease(this.f);
            if (this.f < 0.3) this.flipTo = 0;
            this.flip = still ? this.flipTo : lerp(this.flip, this.flipTo, 0.12);
            const sway = still ? 0 : Math.sin(t * 1.7);
            tag.position.set(0, lerp(0.08 + this.h * 0.3, 1.45, k), lerp(0, 0.1, k));
            tag.rotation.set(lerp(-Math.PI / 2 + 0.1 + this.h * 0.35, -0.15, k), lerp(0, sway * 0.18, k) + ease(this.flip) * Math.PI, lerp(-0.14, sway * 0.05, k));
        },
    });

    // ---------- About: an ID card on a lanyard ----------
    const cw = 0.8, ch = 1.15, r = 0.12;
    const cardShape = new THREE.Shape();
    cardShape.moveTo(-cw + r, -ch); cardShape.lineTo(cw - r, -ch); cardShape.quadraticCurveTo(cw, -ch, cw, -ch + r);
    cardShape.lineTo(cw, ch - r); cardShape.quadraticCurveTo(cw, ch, cw - r, ch); cardShape.lineTo(-cw + r, ch);
    cardShape.quadraticCurveTo(-cw, ch, -cw, ch - r); cardShape.lineTo(-cw, -ch + r); cardShape.quadraticCurveTo(-cw, -ch, -cw + r, -ch);
    const slot = new THREE.Path();
    slot.moveTo(-0.22, ch - 0.12); slot.lineTo(0.22, ch - 0.12); slot.lineTo(0.22, ch - 0.2); slot.lineTo(-0.22, ch - 0.2); slot.closePath();
    cardShape.holes.push(slot);
    const cardGeo = new THREE.ExtrudeGeometry(cardShape, { depth: 0.04, bevelEnabled: false, curveSegments: 6 });
    cardGeo.translate(0, 0, -0.02);
    const card = new THREE.Group();
    card.add(inked(new THREE.Mesh(cardGeo, M.paper)));
    const face = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 2.3), new THREE.MeshBasicMaterial({
        transparent: true,
        map: textTexture(480, 690, (ctx, w) => {
            ctx.fillStyle = '#e74c3c'; ctx.fillRect(0, 70, w, 120);
            ctx.fillStyle = '#ffffff'; ctx.font = HAND(54); ctx.textAlign = 'center'; ctx.fillText('HELLO my name is', w / 2, 148);
            ctx.fillStyle = '#f1c40f'; ctx.beginPath(); ctx.arc(w / 2, 290, 74, 0, Math.PI * 2); ctx.fill();
            ctx.strokeStyle = INK; ctx.lineWidth = 5; ctx.stroke();
            ctx.fillStyle = INK; ctx.font = HAND(76); ctx.fillText('MS', w / 2, 314);
            ctx.font = HAND(96); ctx.fillText('Syafiq', w / 2, 460);
            ctx.font = BODY(30); ctx.fillText('Software Developer', w / 2, 510);
            ctx.font = BODY(26, 500); ctx.globalAlpha = 0.75;
            ctx.fillText('6+ yrs · 15+ projects', w / 2, 570); ctx.fillText('Sungai Petani, Kedah', w / 2, 610);
        }),
    }));
    face.position.z = 0.022;
    card.add(face);
    const lanyard = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([
        new THREE.Vector3(0, ch - 0.16, 0), new THREE.Vector3(0.05, ch + 0.45, -0.04), new THREE.Vector3(0.3, ch + 0.9, -0.02),
        new THREE.Vector3(0.75, ch + 1.0, 0), new THREE.Vector3(1.0, ch + 0.65, 0),
    ]), 40, 0.045, 6), M.blue);
    lanyard.castShadow = true;
    card.add(lanyard);
    const aboutG = new THREE.Group();
    aboutG.add(card);
    aboutG.rotation.y = -0.15;
    addItem('about', aboutG, [6.6, 0, -0.6], {
        name: 'About me', sub: '6+ years', tall: 3.8,
        focus: [-0.4, 1.3, 0.3], dist: 6.4, span: 5.4, guide: [-1.95, 0, 0.9],
        update(t, still) {
            const k = ease(this.f);
            card.position.set(0, lerp(0.05 + this.h * 0.32, 1.75, k), 0);
            card.rotation.set(lerp(-Math.PI / 2 + 0.08 + this.h * 0.3, -0.1, k), lerp(0, still ? 0 : Math.sin(t * 0.9) * 0.22, k), lerp(0.2, 0, k));
        },
    });

    // ---------- Contact: a paper plane that takes off when you open the page ----------
    const N = [1.35, 0, 0], WL = [-0.95, 0.08, -0.95], WR = [-0.95, 0.08, 0.95];
    const TL = [-0.95, 0, -0.05], TR = [-0.95, 0, 0.05], K = [-0.95, -0.38, 0];
    const planeGeo = new THREE.BufferGeometry();
    planeGeo.setAttribute('position', new THREE.Float32BufferAttribute(
        [...N, ...WL, ...TL, ...N, ...TR, ...WR, ...N, ...TL, ...K, ...N, ...K, ...TR], 3));
    planeGeo.computeVertexNormals();
    const plane = new THREE.Group();
    plane.add(inked(new THREE.Mesh(planeGeo, M.paperBoth), 1));
    const contactG = new THREE.Group();
    contactG.add(plane);
    contactG.scale.setScalar(0.8);
    addItem('contact', contactG, [3.6, 0, -2.9], {
        name: 'Say hi', sub: 'WhatsApp', action: 'tap to send', tall: 2.6,
        focus: [-0.5, 1.3, 0.4], dist: 6.6, span: 7.2, guide: [-2.0, 0, 0.9], dir: [0, 1.1, 1],
        flyStart: null,
        update(t, still) {
            const k = ease(this.f);
            // send-off: the plane shoots away, then a fresh one unfolds back in its place
            const ft = this.flyStart === null ? -1 : t - this.flyStart;
            if (ft >= 3.4) this.flyStart = null;
            plane.visible = !(ft >= 1.3 && ft < 2.6);
            plane.scale.setScalar(ft >= 2.6 && ft < 3.4 ? ease((ft - 2.6) / 0.8) : 1);
            if (ft >= 0 && ft < 1.3) {
                const e = ft / 1.3;
                plane.position.set(1.7 + e * e * 10, 1.9 + e * e * 5, -e * e * 4);
                plane.rotation.set(-0.2, 0.35, 0.35 + e * 0.6);
                return;
            }
            // At rest the plane sits on the desk on its keel. It only takes off at its own stop,
            // flies loops there, and glides back down to the desk when you scroll away.
            const REST_Y = 0.38;
            if (still) {
                plane.position.set(0, REST_Y + this.h * 0.25 + k * 1.3, 0);
                plane.rotation.set(0, -0.55, 0);
                return;
            }
            const a = t * 0.9;
            plane.position.set(lerp(0, Math.cos(a) * 1.7, k), lerp(REST_Y + this.h * 0.25, 1.6 + Math.sin(a * 2) * 0.25, k), lerp(0, Math.sin(a) * 0.9, k));
            plane.rotation.set(lerp(0, -0.4, k), lerp(-0.55 - this.h * 0.2, -a - Math.PI / 2, k), lerp(this.h * 0.1, Math.cos(a * 2) * 0.1, k));
        },
    });

    function sendPlane() {
        if (reducedMotion.matches || items.contact.flyStart !== null) return;
        items.contact.flyStart = clock.elapsedTime;
        if (!reducedMotion.matches) kState.hop = 1;
        lastPoke = performance.now();
        say('Message on its way!', 3000);
    }
    // any WhatsApp button on the Contact page (or the one top-right while it's open) sends the plane
    document.querySelectorAll('.view[data-view="contact"] a[href*="wa.me"], .nav-cta[href*="wa.me"]').forEach((a) => a.addEventListener('click', () => {
        if (route() === 'contact') sendPlane();
    }));

    // ---------- decor: pencil + doodles that dodge the pointer ----------
    const pencil = new THREE.Group();
    const shaft = inked(new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 2.3, 6), M.yellow));
    const tip3d = inked(new THREE.Mesh(new THREE.ConeGeometry(0.11, 0.35, 6), M.kraft)); tip3d.position.y = 1.325;
    const lead = new THREE.Mesh(new THREE.ConeGeometry(0.035, 0.11, 6), M.ink); lead.position.y = 1.45;
    const eraser = inked(new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.25, 6), M.red)); eraser.position.y = -1.275;
    pencil.add(shaft, tip3d, lead, eraser);
    pencil.rotation.set(0, 0.35, Math.PI / 2);
    pencil.position.set(-0.2, 0.11, 3.5);
    const PENCIL_HOME = pencil.position.clone();

    // A desk lamp. It switches on in the evening and at night (visitor's own clock).
    const lamp = new THREE.Group();
    const lampMat = toon('#e74c3c');
    const lampBase = inked(new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.55, 0.14, 20), lampMat));
    lampBase.position.y = 0.07;
    const lower = inked(new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 1.7, 8), M.ink));
    lower.position.set(0.25, 0.9, 0); lower.rotation.z = -0.3;
    const upper = inked(new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 1.4, 8), M.ink));
    upper.position.set(0.95, 1.95, 0); upper.rotation.z = -1.25;
    const shade = inked(new THREE.Mesh(new THREE.ConeGeometry(0.48, 0.7, 20, 1, true), lampMat.clone()));
    shade.material.side = THREE.DoubleSide;
    shade.position.set(1.7, 2.05, 0); shade.rotation.z = 0.75;
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.17, 16, 12), new THREE.MeshBasicMaterial({ color: LIGHTING.lamp ? 0xfff1b8 : 0xdadada }));
    bulb.position.set(1.83, 1.8, 0);
    lamp.add(lampBase, lower, upper, shade, bulb);
    lamp.rotation.y = -2.55;
    lamp.position.set(8.6, 0, -3.4);
    scene.add(lamp);
    const LAMP_HOME = lamp.position.clone();
    if (LIGHTING.lamp) {
        const spot = new THREE.SpotLight(0xffc77a, LIGHTING.lamp, 0, 0.85, 0.8, 0);
        bulb.add(spot);
        spot.target.position.set(5.0, 0, 0.2);
        scene.add(spot.target);
    }
    scene.add(pencil);

    const star = new THREE.Shape();
    for (let i = 0; i < 10; i++) {
        const a = (i / 10) * Math.PI * 2 - Math.PI / 2, rr = i % 2 ? 0.17 : 0.4;
        if (i) star.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); else star.moveTo(Math.cos(a) * rr, Math.sin(a) * rr);
    }
    const doodles = [
        // a paper star, lying flat
        [inked(new THREE.Mesh(new THREE.ExtrudeGeometry(star, { depth: 0.06, bevelEnabled: false }), M.yellow)), [1.6, 0, -3.9], 0.0],
        // a red rubber band, lying flat
        [new THREE.Mesh(new THREE.TorusGeometry(0.32, 0.035, 8, 32), M.red), [9.0, 0, 0.6], 0.035],
    ].map(([mesh, home, lift], i) => {
        mesh.castShadow = true;
        mesh.rotation.x = -Math.PI / 2;
        mesh.scale.z = i === 1 ? 0.6 : 1;   // the band is a squashed loop, not a perfect ring
        mesh.userData = { home: new THREE.Vector3(...home), off: new THREE.Vector3(), vel: new THREE.Vector3(), spin: 0, lift, seed: i * 1.9 };
        scene.add(mesh);
        return mesh;
    });

    // ---------- Kertas, the paper buddy ----------
    const kertas = new THREE.Group();
    const kBody = new THREE.Group();
    kertas.add(kBody);
    const box = inked(new THREE.Mesh(new THREE.BoxGeometry(0.9, 1.05, 0.72), M.paper));
    box.position.y = 0.525;
    kBody.add(box);
    const foldGeo = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(0.45, 1.052, 0.36), new THREE.Vector3(0.45, 1.052, 0.06), new THREE.Vector3(0.15, 1.052, 0.36),
    ]);
    foldGeo.computeVertexNormals();
    kBody.add(inked(new THREE.Mesh(foldGeo, M.kraft), 1));
    const eyes = [-0.18, 0.18].map((x) => {
        const e = new THREE.Group();
        e.position.set(x, 0.68, 0.37);
        const white = new THREE.Mesh(new THREE.CircleGeometry(0.12, 24), new THREE.MeshBasicMaterial({ color: 0xffffff }));
        white.add(new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.CircleGeometry(0.12, 24)), M.line));
        const pupil = new THREE.Mesh(new THREE.CircleGeometry(0.055, 16), new THREE.MeshBasicMaterial({ color: INK }));
        pupil.position.z = 0.004;
        e.add(white, pupil);
        e.userData.pupil = pupil;
        kBody.add(e);
        return e;
    });
    const mouth = new THREE.Mesh(new THREE.TorusGeometry(0.09, 0.02, 8, 16, Math.PI), new THREE.MeshBasicMaterial({ color: INK }));
    mouth.rotation.z = Math.PI;
    mouth.position.set(0, 0.47, 0.365);
    kBody.add(mouth);
    [-0.3, 0.3].forEach((x) => {
        const cheek = new THREE.Mesh(new THREE.CircleGeometry(0.06, 16), new THREE.MeshBasicMaterial({ color: 0xff9aa2 }));
        cheek.position.set(x, 0.52, 0.362);
        kBody.add(cheek);
    });
    const arms = [-1, 1].map((side) => {
        const arm = new THREE.Group();
        arm.position.set(side * 0.45, 0.55, 0);
        const a = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.07, 0.07), M.paper);
        a.position.x = side * 0.12;
        a.castShadow = true;
        arm.add(a);
        kBody.add(arm);
        return arm;
    });
    const K_HOME = new THREE.Vector3(3.1, 0, -0.1);
    kertas.position.copy(K_HOME);
    kertas.traverse((o) => { if (o.isMesh) { o.userData.kertas = true; pickables.push(o); } });
    scene.add(kertas);
    const kState = { hop: 0, flip: 0, wave: 1.5, blink: 2.5, pokes: [], pos: K_HOME.clone() };

    function guideSpot(name) {
        const it = items[name];
        if (!it) return K_HOME;
        const spot = it.base.clone().add(new THREE.Vector3(...it.guide));
        spot.y = 0;
        return spot;
    }

    // ---------- camera poses ----------
    let width = 1, height = 1;
    const TOP_DIR = new THREE.Vector3(0, 1, 0.02).normalize();
    const OVERVIEW_DIR = new THREE.Vector3(0, 0.86, 0.62).normalize();
    const FOCUS_DIR = new THREE.Vector3(0, 0.6, 1).normalize();
    const overview = { center: new THREE.Vector3(), corners: [] };
    const tmpF = new THREE.Vector3(), tmpR = new THREE.Vector3(), tmpU = new THREE.Vector3();

    function measureOverview() {
        Object.values(items).forEach((it) => { it.f = 0; it.h = 0; it.update(0, true); });
        scene.updateMatrixWorld();
        const b = new THREE.Box3();
        Object.values(items).forEach((it) => b.expandByObject(it.group));
        b.expandByObject(pencil);
        b.expandByObject(lamp);
        b.expandByPoint(K_HOME.clone().setY(1.1));
        b.min.y = 0;
        b.max.y = Math.min(b.max.y, 0.8);   // frame the desk's footprint; tall things may overlap the edge
        overview.center.copy(b.getCenter(new THREE.Vector3())).setY(0.4);
        overview.corners = [];
        for (const x of [b.min.x, b.max.x]) for (const y of [b.min.y, b.max.y]) for (const z of [b.min.z, b.max.z]) {
            overview.corners.push(new THREE.Vector3(x, y, z));
        }
    }

    // Distance at which the corners fit within ±fracW / ±fracH of the screen.
    function fitDistance(center, dir, corners, fracW, fracH) {
        let lo = 2, hi = 80;
        for (let i = 0; i < 22; i++) {
            const mid = (lo + hi) / 2;
            camera.position.copy(center).addScaledVector(dir, mid);
            camera.lookAt(center);
            camera.updateMatrixWorld();
            const ok = corners.every((c) => { v.copy(c).project(camera); return Math.abs(v.x) <= fracW && Math.abs(v.y) <= fracH; });
            if (ok) hi = mid; else lo = mid;
        }
        return hi;
    }

    // Place the camera so `center` lands at screen point (ndcX, ndcY).
    function framed(center, dir, dist, ndcX, ndcY) {
        const target = center.clone();
        const pos = center.clone().addScaledVector(dir, dist);
        tmpF.copy(target).sub(pos).normalize();
        tmpR.crossVectors(tmpF, camera.up).normalize();
        tmpU.crossVectors(tmpR, tmpF).normalize();
        const hh = dist * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
        const hw = hh * camera.aspect;
        const shift = tmpR.clone().multiplyScalar(-ndcX * hw).addScaledVector(tmpU, -ndcY * hh);
        return { pos: pos.add(shift), target: target.add(shift) };
    }

    // The part of the screen the desk owns, in NDC: everything except the panel (desktop)
    // or the sheet (phone). Returns its centre and half-size.
    function freeArea() {
        if (phone()) {
            if (root.classList.contains('sheet-full')) return { cx: 0, cy: 0.6, hw: 0.9, hh: 0.3 };
            const sheetTop = (app.getBoundingClientRect().top || height * 0.55) / height;   // 0..1 from the top
            const top = 64 / height;                                                         // the top corners
            const mid = (top + sheetTop) / 2;
            return { cx: 0, cy: 1 - 2 * mid, hw: 0.92, hh: Math.max(0.2, (sheetTop - top) * 0.92) };
        }
        if (route() === 'home') {
            // the hero text owns the left; the desk gets the rest of the screen
            const heroRight = 560 / width;
            const left = Math.min(0.5, heroRight);
            return { cx: left, cy: -0.04, hw: (1 - left) * 0.96, hh: 0.8 };
        }
        const panelLeft = app.getBoundingClientRect().left / width;  // 0..1
        const f = Math.max(0.3, panelLeft - 0.02);
        return { cx: -1 + f, cy: -0.06, hw: f * 0.9, hh: 0.72 };
    }

    // Where the camera should be for the current page.
    function goalPose(intro) {
        const area = freeArea();
        const name = route();
        const it = items[name];
        if (!it) {
            const dir = intro ? TOP_DIR : OVERVIEW_DIR;
            const d = fitDistance(overview.center, dir, overview.corners, area.hw, area.hh);
            return framed(overview.center, dir, d, area.cx, area.cy);
        }
        const tanV = Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2);
        const center = it.base.clone().add(new THREE.Vector3(...it.focus));
        const needW = (it.span / 2) / (tanV * camera.aspect * area.hw);
        const needH = (it.tall / 2) / (tanV * area.hh);
        const dist = Math.max(it.dist, needW, needH);
        const dir = it.dir ? new THREE.Vector3(...it.dir).normalize() : FOCUS_DIR;
        return framed(center, dir, dist, area.cx, area.cy);
    }

    function resize() {
        width = Math.max(1, window.innerWidth); height = Math.max(1, window.innerHeight);
        renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, width < 700 ? 1.75 : 2));
        renderer.setSize(width, height, false);
        camera.aspect = width / height;
        camera.updateProjectionMatrix();
        wake();
    }

    // ---------- pointer ----------
    const ray = new THREE.Raycaster();
    const ndc = new THREE.Vector2();
    const pointer = new THREE.Vector2(9, 9);       // off-screen until the pointer moves in
    const pointerPx = { x: 0, y: 0 };
    const lean = new THREE.Vector2();
    const lookAt = new THREE.Vector3();
    const eyePlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -0.7);
    const centre = new THREE.Vector2(0, 0);
    let hovered = null;

    function toNdc(e) {
        pointerPx.x = e.clientX; pointerPx.y = e.clientY;
        ndc.set((e.clientX / width) * 2 - 1, -(e.clientY / height) * 2 + 1);
        return ndc;
    }
    function pick(e) {
        ray.setFromCamera(toNdc(e), camera);
        const hit = ray.intersectObjects(pickables, false)[0];
        if (!hit) return null;
        return hit.object.userData.kertas ? 'kertas' : hit.object.userData.item;
    }
    function setHover(target) {
        if (target === hovered) return;
        hovered = target;
        stage.classList.toggle('is-hovering', !!target);
        if (target === 'kertas') tip.innerHTML = 'Kertas<small>poke me</small>';
        else if (target) tip.innerHTML = `${target.name}<small>${route() === target.id ? target.action || target.sub : 'open'}</small>`;
        tip.classList.toggle('show', !!target);
        wake();
    }

    canvas.addEventListener('pointermove', (e) => {
        pointer.copy(toNdc(e));
        if (e.pointerType === 'mouse') setHover(pick(e));
        wake();
    });
    canvas.addEventListener('pointerleave', () => { pointer.set(9, 9); setHover(null); });

    // Tapping an object does exactly what the dock does: it opens that page.
    // Tapping the object of the page that's already open uses it (flip the tag, send the plane).
    // Tapping empty desk while a page is open goes back to the desk.
    let downAt = null;
    canvas.addEventListener('pointerdown', (e) => { downAt = [e.clientX, e.clientY]; });
    canvas.addEventListener('pointerup', (e) => {
        if (!downAt || Math.hypot(e.clientX - downAt[0], e.clientY - downAt[1]) > 10) return;
        downAt = null;
        pointer.copy(toNdc(e));
        const target = pick(e);
        const here = route();
        if (target === 'kertas') poke();
        else if (target && target.id === here && target.id === 'rates') {
            target.flipTo = target.flipTo ? 0 : 1;
            setHover(null);   // keep the hint off the side you just flipped to
            track('desk-pick', { item: 'rates-flip' });
        } else if (target && target.id === here && target.id === 'contact') {
            sendPlane();
            setHover(null);
            track('desk-pick', { item: 'contact-plane' });
        } else if (target && target.id !== here) {
            track('desk-pick', { item: target.id });
            setHover(null);
            location.hash = `#/${target.id}`;
        } else if (!target && here !== 'home') {
            location.hash = '#/';
        }
        wake();
    });

    // ---------- Kertas talks ----------
    let talkTimer = 0, lastPoke = 0, lastRoute = null;
    function say(text, ms = 3800) {
        bubble.textContent = text;
        bubble.classList.add('show');
        clearTimeout(talkTimer);
        talkTimer = setTimeout(() => bubble.classList.remove('show'), ms);
        wake();
    }
    function poke() {
        const now = performance.now();
        kState.pokes = kState.pokes.filter((t) => now - t < 1400).concat(now);
        lastPoke = now;
        track('buddy-click', { where: 'desk' });
        if (kState.pokes.length >= 3) {
            kState.pokes = [];
            if (!reducedMotion.matches) kState.flip = 1;
            say('Wheee! Again?');
            return;
        }
        if (!reducedMotion.matches) kState.hop = 1;
        kState.wave = 1.2;
        say(POKE_LINES[Math.floor(Math.random() * POKE_LINES.length)]);
    }

    // Kertas waves goodbye when you reach the end of a page (once per page you open).
    let wavedOn = '';
    app.addEventListener('scroll', () => {
        const here = route();
        if (here === 'home' || wavedOn === here) return;
        if (app.scrollTop + app.clientHeight < app.scrollHeight - 8 || app.scrollHeight < app.clientHeight * 1.4) return;
        wavedOn = here;
        kState.wave = 2;
        say('Bye for now! Come back soon.', 3000);
    }, { passive: true });

    const applyTone = () => { floorMat.opacity = root.dataset.tone === 'dark' ? 0.32 : 0.16; paintDesk(); };
    new MutationObserver(() => {
        applyTone();
        const line = PAPER_LINES[root.dataset.paper || 'graph'];
        if (line && !document.hidden) {
            if (!reducedMotion.matches) kState.hop = 1;
            lastPoke = performance.now();
            say(line);
        }
        wake();
    }).observe(root, { attributes: true, attributeFilter: ['data-paper', 'data-tone'] });
    applyTone();

    // Kertas' speech bubble: try above Kertas, then below, then beside it. Take the first spot that
    // stays inside the desk's free area and doesn't overlap the object that's open.
    const box3 = new THREE.Box3();
    function screenRect(obj) {
        box3.setFromObject(obj);
        let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
        for (const x of [box3.min.x, box3.max.x]) for (const y of [box3.min.y, box3.max.y]) for (const z of [box3.min.z, box3.max.z]) {
            v.set(x, y, z).project(camera);
            const sx = (v.x * 0.5 + 0.5) * width, sy = (-v.y * 0.5 + 0.5) * height;
            x0 = Math.min(x0, sx); x1 = Math.max(x1, sx); y0 = Math.min(y0, sy); y1 = Math.max(y1, sy);
        }
        return { x0, y0, x1, y1 };
    }
    function placeBubble(open) {
        const area = freeArea();
        const left = ((area.cx - area.hw) * 0.5 + 0.5) * width + 8;
        const right = ((area.cx + area.hw) * 0.5 + 0.5) * width - 8;
        const top = Math.max(phone() ? 64 : 76, ((1 - (area.cy + area.hh)) * 0.5) * height);
        const bottom = phone() ? app.getBoundingClientRect().top - 8 : height - 96;
        const k = screenRect(kBody);
        const avoid = open ? screenRect(open.group) : null;
        const bw = bubble.offsetWidth || 180, bh = bubble.offsetHeight || 50;
        const kx = (k.x0 + k.x1) / 2, gap = 14;
        const spots = [
            { x: kx - bw / 2, y: k.y0 - gap - bh, tail: 'down' },
            { x: kx - bw / 2, y: k.y1 + gap, tail: 'up' },
            { x: k.x1 + gap, y: (k.y0 + k.y1) / 2 - bh / 2, tail: 'left' },
            { x: k.x0 - gap - bw, y: (k.y0 + k.y1) / 2 - bh / 2, tail: 'right' },
        ];
        const fits = (r) => r.x >= left && r.x + bw <= right && r.y >= top && r.y + bh <= bottom;
        const clear = (r) => !avoid || r.x + bw < avoid.x0 || r.x > avoid.x1 || r.y + bh < avoid.y0 || r.y > avoid.y1;
        let spot = spots.find((r) => fits(r) && clear(r)) || spots.find(fits);
        if (!spot) { bubble.style.visibility = 'hidden'; return; }
        bubble.style.visibility = 'visible';
        bubble.dataset.tail = spot.tail;
        bubble.style.transform = `translate(${Math.round(spot.x)}px, ${Math.round(spot.y)}px)`;
    }

    // ---------- loop ----------
    const clock = new THREE.Clock();
    let rafId = 0, quietFrames = 0, firstFrame = true;
    const startedAt = performance.now();
    const camPos = new THREE.Vector3(), camTarget = new THREE.Vector3();

    function wake() {
        quietFrames = 0;
        if (!rafId && !document.hidden) { clock.getDelta(); rafId = requestAnimationFrame(frame); }
    }

    function frame() {
        rafId = 0;
        const dt = Math.min(clock.getDelta(), 0.05);
        const t = clock.elapsedTime;
        const still = reducedMotion.matches;
        const here = route();

        // camera: the first moment looks straight down (a flat 2D desk), then it tilts into 3D
        const intro = here === 'home' && !still && performance.now() - startedAt < 700;
        const goal = goalPose(intro);
        lean.lerp(pointer.lengthSq() > 4 || still || phone() ? centre : pointer, 1 - Math.exp(-dt * 3));
        goal.pos.x += lean.x * 0.35;
        goal.pos.y += lean.y * 0.2;
        if (firstFrame) {
            // a deep link (#/work) still starts flat, so the tilt reads the same everywhere
            const flat = framed(overview.center, TOP_DIR, fitDistance(overview.center, TOP_DIR, overview.corners, 0.94, 0.8), 0, 0);
            camPos.copy(still ? goal.pos : flat.pos); camTarget.copy(still ? goal.target : flat.target);
        }
        const k = still ? 1 : 1 - Math.exp(-dt * (firstFrame ? 0 : 3.2));
        camPos.lerp(goal.pos, k);
        camTarget.lerp(goal.target, k);
        firstFrame = false;
        camera.position.copy(camPos);
        camera.lookAt(camTarget);
        // the far desk fades into the paper colour
        const camDist = camPos.distanceTo(camTarget);
        scene.fog.near = camDist * 1.25;
        scene.fog.far = camDist * 3.2;

        // objects: the one whose page is open gets picked up
        for (const id in items) {
            const it = items[id];
            it.h = lerp(it.h, hovered === it ? 1 : 0, 1 - Math.exp(-dt * (still ? 40 : 8)));
            const goalF = id === here ? 1 : 0;
            it.f = still ? goalF : lerp(it.f, goalF, 1 - Math.exp(-dt * 4));
            it.update(t, still);
        }

        playVideos(here === 'work' && !document.hidden);

        // the desk clears space: other objects slide away from the one in focus
        let star = null;
        for (const id in items) if (!star || items[id].f > star.f) star = items[id];
        const clear = star ? ease(star.f) : 0;
        const push = (obj, base, amount) => {
            // slide sideways and back, never toward the camera
            v.set(base.x - star.base.x, 0, Math.min(0, base.z - star.base.z) * 0.5);
            if (Math.abs(v.x) < 0.5) v.x = Math.sign(v.x || 1) * 0.5;
            // objects in front of the star go further aside, so they never loom over it
            v.normalize().multiplyScalar((amount + (base.z > star.base.z + 0.5 ? 3 : 0)) * clear);
            obj.position.set(base.x + v.x, base.y, base.z + v.z);
        };
        for (const id in items) {
            const it = items[id];
            if (it === star) it.group.position.copy(it.base);
            else push(it.group, it.base, 4.4);
            if (it.f > 0.5) it.wasUp = true;
            else if (it.wasUp && it.f < 0.08) { it.wasUp = false; it.landAt = t; }
            const since = it.landAt === undefined ? 9 : t - it.landAt;
            if (!still && since < 0.9) it.group.position.y += Math.abs(Math.sin(since * 11)) * 0.14 * Math.exp(-since * 6);
        }
        push(pencil, PENCIL_HOME, 4.4);
        push(lamp, LAMP_HOME, 4.4);

        // the star and the rubber band lie on the desk; the pointer nudges them and friction stops them
        doodles.forEach((d) => {
            const u = d.userData;
            v.copy(d.position).project(camera);
            const dx = v.x - pointer.x, dy = v.y - pointer.y, dist = Math.hypot(dx, dy) || 1;
            if (!still && dist < 0.12) { u.vel.x += (dx / dist) * dt * 18; u.vel.z -= (dy / dist) * dt * 18; u.spin += (dx > 0 ? 1 : -1) * dt * 10; }
            u.vel.multiplyScalar(Math.exp(-dt * 4));      // friction
            u.spin *= Math.exp(-dt * 4);
            u.off.addScaledVector(u.vel, dt).clampLength(0, 1.6);
            d.position.set(u.home.x + u.off.x, 0.01 + u.lift, u.home.z + u.off.z);
            d.rotation.z += u.spin * dt;
        });

        // Kertas walks over to whatever page is open
        const spot = guideSpot(here);
        const beforeX = kState.pos.x, beforeZ = kState.pos.z;
        kState.pos.lerp(spot, still ? 1 : 1 - Math.exp(-dt * 2.6));
        const speed = Math.hypot(kState.pos.x - beforeX, kState.pos.z - beforeZ) / Math.max(dt, 1e-3);
        const walking = !still && speed > 0.4;
        kState.hop = Math.max(0, kState.hop - dt * 2.4);
        kState.flip = Math.max(0, kState.flip - dt * 1.5);
        kState.wave = Math.max(0, kState.wave - dt);
        const jump = Math.sin(kState.hop * Math.PI) * 0.55 + Math.sin(kState.flip * Math.PI) * 0.9;
        const stepBounce = walking ? Math.abs(Math.sin(t * 11)) * 0.16 : 0;
        kertas.position.set(kState.pos.x, jump + stepBounce, kState.pos.z);
        // always turn to face the camera
        const toCam = Math.atan2(camera.position.x - kertas.position.x, camera.position.z - kertas.position.z);
        kertas.rotation.y = still ? toCam : lerp(kertas.rotation.y, toCam, 1 - Math.exp(-dt * 6));
        kBody.rotation.x = kState.flip > 0 ? -(1 - kState.flip) * Math.PI * 2 : 0;
        kBody.rotation.z = walking ? Math.sin(t * 11) * 0.08 : 0;
        arms[1].rotation.z = kState.wave > 0 && !still ? 0.9 + Math.sin(t * 14) * 0.5 : (walking ? Math.sin(t * 11) * 0.3 : 0);
        arms[0].rotation.z = walking ? -Math.sin(t * 11) * 0.3 : 0;
        // eyes follow the pointer, and blink now and then
        scene.updateMatrixWorld();
        ray.setFromCamera(pointer.lengthSq() > 4 ? centre : pointer, camera);
        if (ray.ray.intersectPlane(eyePlane, lookAt)) {
            kertas.worldToLocal(lookAt);
            const lx = Math.max(-1, Math.min(1, lookAt.x / 3));
            const ly = Math.max(-1, Math.min(1, lookAt.z / 4 - 0.2));
            eyes.forEach((e) => e.userData.pupil.position.set(lx * 0.05, -ly * 0.05, 0.004));
        }
        kState.blink -= dt;
        if (kState.blink < -0.12) kState.blink = 2.5 + Math.random() * 3;
        eyes.forEach((e) => { e.scale.y = kState.blink < 0 && !still ? 0.12 : 1; });

        // Kertas speaks once when it arrives: a greeting on the desk, one line per page
        if (here !== lastRoute && (still || speed < 0.3) && (!lastPoke || performance.now() - lastPoke > 2500)) {
            const first = lastRoute === null;
            lastRoute = here;
            kState.wave = 1.4;
            if (here === 'home') { if (first) say(greeting(), 4500); else bubble.classList.remove('show'); }
            else say(PAGE_LINES[here] || '');
        }

        scene.updateMatrixWorld();
        renderer.render(scene, camera);

        // speech bubble next to Kertas, placed where it doesn't cover the open object
        if (bubble.classList.contains('show')) placeBubble(star && star.f > 0.3 ? star : null);
        if (hovered) tip.style.transform = `translate(${Math.round(pointerPx.x + 16)}px, ${Math.round(pointerPx.y + 18)}px)`;

        // the desk is hidden behind a full sheet: let it settle, then stop drawing
        const hiddenBehindSheet = phone() && root.classList.contains('sheet-full');
        if ((still || hiddenBehindSheet) && ++quietFrames > 40) return;
        if (!document.hidden) rafId = requestAnimationFrame(frame);
    }

    // route changes, sheet moves and resizes all reframe the camera
    new MutationObserver(() => { setHover(null); wake(); }).observe(document.body, { attributes: true, attributeFilter: ['data-view'] });
    document.addEventListener('sheetchange', wake);
    document.addEventListener('visibilitychange', () => { if (document.hidden) playVideos(false); wake(); });
    window.addEventListener('resize', resize);

    measureOverview();
    resize();
}

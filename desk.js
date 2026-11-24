// 3D desk tour on the home page.
// A paper desk stays pinned behind the hero while you scroll. The camera visits one
// object per stop: photos = Work, price tag = Rates, ID card = About, paper plane = Contact.
// Kertas, the paper buddy, walks along as a tour guide and reacts when you poke it.
// Everything here is decoration: if Three.js can't load, the extra stops stay hidden
// and the home page works as before.

const THREE_URL = 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js';
const root = document.documentElement;
const tour = document.getElementById('deskTour');
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
const track = (name, data) => document.dispatchEvent(new CustomEvent('track', { detail: { name, data } }));

if (tour && root.classList.contains('has-desk')) {
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
            root.classList.remove('has-desk');
        });
}

// What Kertas says when it arrives at each stop, when poked, and when the paper changes.
const STOP_LINES = [
    "Hi! I'm Kertas. Scroll down, I'll show you around!",
    'This is Syafiq’s desk. Everything here is real work.',
    'These apps are live. Real people use them every day!',
    'Websites start at RM 800. No hidden fees, promise.',
    '6+ years of building systems. Not bad, eh?',
    'Send a message! He replies fast on WhatsApp.',
];
const POKE_LINES = ['Hehe, that tickles!', 'Selamat datang!', 'I’m made of 100% paper.', 'Try the Paper button up top!', 'Careful, I crease easily.', 'Psst… tap the price tag.'];
const PAPER_LINES = { graph: 'Back to graph paper. Classic!', kraft: 'Ooh, kraft paper. So cosy.', blueprint: 'Blueprint mode. Very engineer.', chalk: 'Chalkboard! Class is in session.' };

function buildDesk(THREE) {
    const sticky = tour.querySelector('.desk-sticky');
    const canvas = tour.querySelector('.desk-canvas');
    const tip = tour.querySelector('.desk-tip');
    const bubble = tour.querySelector('.kertas-bubble');
    const railButtons = [...tour.querySelectorAll('.tour-rail [data-tour-go]')];
    const steps = [...tour.querySelectorAll('[data-stop]')].sort((a, b) => a.dataset.stop - b.dataset.stop);
    const STOPS = steps.length;

    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    renderer.setClearColor(0x000000, 0);
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
    scene.add(new THREE.HemisphereLight(0xffffff, 0xcfc6b4, 2.1));
    const sun = new THREE.DirectionalLight(0xffffff, 1.6);
    sun.position.set(-6, 14, 8);
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

    // ---------- Work (stop 2): a stack of photos that stand up in a row ----------
    const loader = new THREE.TextureLoader();
    const SHOTS = [
        { src: 'assets/design-web-visualizer-preview-poster.webp', name: 'Design Visualizer', rest: [0.32, 0.02, 0.26, 0.32] },
        { src: 'assets/maispend-preview-poster.webp', name: 'maispend', rest: [-0.28, 0.07, -0.08, -0.22] },
        { src: 'assets/maigambar-preview-poster.webp', name: 'MaiGambar.my', rest: [0.04, 0.12, 0.04, 0.05] },
    ];
    const workG = new THREE.Group();
    const photos = SHOTS.map((s) => {
        const g = new THREE.Group();
        g.add(inked(new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.04, 2.45), M.paper)));
        const tex = loader.load(s.src, (t) => {
            // centre-crop the wide screenshot into the 4:3 photo window
            const imgAspect = t.image.width / t.image.height;
            const box = 1.76 / 1.32;
            if (imgAspect > box) { t.repeat.set(box / imgAspect, 1); t.offset.set((1 - box / imgAspect) / 2, 0); }
            else { t.repeat.set(1, imgAspect / box); t.offset.set(0, (1 - imgAspect / box) / 2); }
            wake();
        });
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
        workG.add(g);
        return g;
    });
    addItem('work', workG, [-2.9, 0, -1.3], {
        stop: 2, name: 'My work', sub: '3 live apps',
        focus: [0.3, 1.3, 1.0], dist: 8.2, span: 9.4, guide: [3.85, 0, 1.5],
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

    // ---------- Rates (stop 3): a kraft price tag on a red string ----------
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
    const string = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([
        new THREE.Vector3(-0.85, 0.1, 0), new THREE.Vector3(-0.95, 0.5, 0.05), new THREE.Vector3(-1.5, 0.75, 0.02),
        new THREE.Vector3(-1.85, 0.45, 0), new THREE.Vector3(-2.0, -0.05, 0),
    ]), 40, 0.03, 6), M.red);
    string.castShadow = true;
    tag.add(string);
    const ratesG = new THREE.Group();
    ratesG.add(tag);
    ratesG.rotation.y = 0.06;
    addItem('rates', ratesG, [-0.9, 0, 2.4], {
        stop: 3, name: 'Rates', sub: 'from RM 800',
        focus: [0.4, 1.0, 0.3], dist: 6.2, span: 6.0, guide: [2.4, 0, 0.7],
        update(t, still) {
            const k = ease(this.f);
            const sway = still ? 0 : Math.sin(t * 1.7);
            tag.position.set(0, lerp(0.08 + this.h * 0.3, 1.45, k), lerp(0, 0.1, k));
            tag.rotation.set(lerp(-Math.PI / 2 + 0.1 + this.h * 0.35, -0.15, k), lerp(0, sway * 0.18, k), lerp(-0.14, sway * 0.05, k));
        },
    });

    // ---------- About (stop 4): an ID card on a lanyard ----------
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
    addItem('about', aboutG, [3.0, 0, 1.4], {
        stop: 4, name: 'About me', sub: '6+ years',
        focus: [-0.4, 1.3, 0.3], dist: 6.4, span: 5.4, guide: [-1.95, 0, 0.9],
        update(t, still) {
            const k = ease(this.f);
            card.position.set(0, lerp(0.05 + this.h * 0.32, 1.75, k), 0);
            card.rotation.set(lerp(-Math.PI / 2 + 0.08 + this.h * 0.3, -0.1, k), lerp(0, still ? 0 : Math.sin(t * 0.9) * 0.22, k), lerp(0.2, 0, k));
        },
    });

    // ---------- Contact (stop 5): a paper plane that loops when you visit it ----------
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
    addItem('contact', contactG, [2.0, 1.5, -2.1], {
        stop: 5, name: 'Say hi', sub: 'WhatsApp',
        focus: [-0.5, -0.3, 0.4], dist: 6.6, span: 7.2, guide: [-2.0, -1.5, 0.9], dir: [0, 1.1, 1],
        update(t, still) {
            const k = ease(this.f);
            if (still) {
                plane.position.set(0, this.h * 0.3, 0);
                plane.rotation.set(0.08, -0.55, 0.1);
                return;
            }
            const a = t * 0.9;
            const idleY = Math.sin(t * 1.6) * 0.14 + this.h * 0.3;
            plane.position.set(lerp(0, Math.cos(a) * 1.7, k), lerp(idleY, 0.3 + Math.sin(a * 2) * 0.25, k), lerp(0, Math.sin(a) * 0.9, k));
            plane.rotation.set(lerp(Math.sin(t * 1.3) * 0.1, -0.4, k), lerp(-0.55 - this.h * 0.25, -a - Math.PI / 2, k), lerp(0.1 + this.h * 0.15, Math.cos(a * 2) * 0.1, k));
        },
    });

    // ---------- decor: pencil + doodles that dodge the pointer ----------
    const pencil = new THREE.Group();
    const shaft = inked(new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 2.3, 6), M.yellow));
    const tip3d = inked(new THREE.Mesh(new THREE.ConeGeometry(0.11, 0.35, 6), M.kraft)); tip3d.position.y = 1.325;
    const lead = new THREE.Mesh(new THREE.ConeGeometry(0.035, 0.11, 6), M.ink); lead.position.y = 1.45;
    const eraser = inked(new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.25, 6), M.red)); eraser.position.y = -1.275;
    pencil.add(shaft, tip3d, lead, eraser);
    pencil.rotation.set(0, 0.5, Math.PI / 2);
    pencil.position.set(-0.2, 0.11, -0.2);
    const PENCIL_HOME = pencil.position.clone();
    scene.add(pencil);

    const star = new THREE.Shape();
    for (let i = 0; i < 10; i++) {
        const a = (i / 10) * Math.PI * 2 - Math.PI / 2, rr = i % 2 ? 0.17 : 0.4;
        if (i) star.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); else star.moveTo(Math.cos(a) * rr, Math.sin(a) * rr);
    }
    const doodles = [
        [inked(new THREE.Mesh(new THREE.ExtrudeGeometry(star, { depth: 0.08, bevelEnabled: false }), M.yellow)), [-4.9, 1.4, 0.6]],
        [inked(new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.07, 8, 24), M.blue), 40), [4.3, 1.9, -1.4]],
        [new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([-3, -2, -1, 0, 1, 2, 3]
            .map((x, i) => new THREE.Vector3(x * 0.14, i % 2 ? 0.11 : -0.11, 0))), 40, 0.045, 6), M.red), [-3.6, 1.2, 2.6]],
        [inked(new THREE.Mesh(new THREE.OctahedronGeometry(0.24), M.paper), 1), [-0.4, 1.7, -2.9]],
    ].map(([mesh, home], i) => {
        mesh.userData = { home: new THREE.Vector3(...home), off: new THREE.Vector3(), seed: i * 1.9 };
        scene.add(mesh);
        return mesh;
    });

    // ---------- Kertas, the paper buddy and tour guide ----------
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
    const K_HOME = new THREE.Vector3(0.9, 0, 0.3);
    kertas.position.copy(K_HOME);
    kertas.traverse((o) => { if (o.isMesh) { o.userData.kertas = true; pickables.push(o); } });
    scene.add(kertas);
    const kState = { hop: 0, flip: 0, wave: 1.5, blink: 2.5, pokes: [], pos: K_HOME.clone() };

    function guideSpot(stop) {
        const it = Object.values(items).find((x) => x.stop === stop);
        if (!it) return K_HOME;
        const spot = it.base.clone().add(new THREE.Vector3(...it.guide));
        spot.y = 0;
        return spot;
    }

    // ---------- scroll → tour progress ----------
    let stopAt = [];        // scroll position where each stop is centred
    function measureStops() {
        stopAt = steps.map((el, i) => {
            if (i === 0) return 0;
            const rect = el.getBoundingClientRect();
            return rect.top + window.scrollY + rect.height / 2 - window.innerHeight / 2;
        });
    }
    function scrollProgress() {
        const y = window.scrollY;
        if (!stopAt.length || y <= stopAt[0]) return 0;
        for (let i = 0; i < STOPS - 1; i++) {
            if (y < stopAt[i + 1]) return i + (y - stopAt[i]) / Math.max(1, stopAt[i + 1] - stopAt[i]);
        }
        return STOPS - 1;
    }
    function goToStop(i) {
        measureStops();
        window.scrollTo({ top: Math.max(0, stopAt[i] || 0), behavior: reducedMotion.matches ? 'auto' : 'smooth' });
    }
    railButtons.forEach((b) => b.addEventListener('click', () => goToStop(+b.dataset.tourGo)));
    tour.querySelectorAll('.tour-hint[data-tour-go]').forEach((b) => b.addEventListener('click', () => goToStop(+b.dataset.tourGo)));

    // ---------- camera poses for each stop ----------
    let width = 1, height = 1, wide = true;
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
        b.expandByPoint(K_HOME.clone().setY(1.1));
        b.min.y = 0;
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

    let poses = [];
    function computePoses() {
        wide = width >= 980;
        const vfov = THREE.MathUtils.degToRad(camera.fov);
        const halfTan = Math.tan(vfov / 2) * camera.aspect;
        // where the object sits on screen: right half on desktop (card on the left), top on phones (card at the bottom)
        const focusNdc = wide ? [0.34, 0.02] : [0, 0.42];
        const focusFracW = wide ? 0.5 : 0.9;
        poses = [];
        // 0: hero. Looking straight down, so the desk reads as a flat 2D page; scrolling tilts it into 3D.
        // Desktop: the flat-lay sits on the right. Phones: it waits just below the screen.
        if (wide) {
            const d = fitDistance(overview.center, TOP_DIR, overview.corners, 0.32, 0.72);
            poses.push(framed(overview.center, TOP_DIR, d, 0.64, -0.04));
        } else {
            const d = fitDistance(overview.center, TOP_DIR, overview.corners, 0.94, 0.5);
            poses.push(framed(overview.center, TOP_DIR, d, 0, -1.6));
        }
        // 1: the whole desk
        if (wide) {
            const d = fitDistance(overview.center, OVERVIEW_DIR, overview.corners, 0.56, 0.8);
            poses.push(framed(overview.center, OVERVIEW_DIR, d, 0.36, 0));
        } else {
            const d = fitDistance(overview.center, OVERVIEW_DIR, overview.corners, 0.94, 0.42);
            poses.push(framed(overview.center, OVERVIEW_DIR, d, 0, 0.42));
        }
        // 2-5: one object each
        Object.values(items).sort((a, b) => a.stop - b.stop).forEach((it) => {
            const center = it.base.clone().add(new THREE.Vector3(...it.focus));
            const needed = (it.span / 2) / (halfTan * focusFracW);
            const dist = Math.max(it.dist, needed);
            const dir = it.dir ? new THREE.Vector3(...it.dir).normalize() : FOCUS_DIR;
            poses.push(framed(center, dir, dist, focusNdc[0], focusNdc[1]));
        });
    }

    function resize() {
        const rect = sticky.getBoundingClientRect();
        width = Math.max(1, rect.width); height = Math.max(1, rect.height);
        renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, width < 700 ? 1.75 : 2));
        renderer.setSize(width, height, false);
        camera.aspect = width / height;
        camera.updateProjectionMatrix();
        computePoses();
        measureStops();
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
        const rect = canvas.getBoundingClientRect();
        pointerPx.x = e.clientX - rect.left; pointerPx.y = e.clientY - rect.top;
        ndc.set((pointerPx.x / rect.width) * 2 - 1, -(pointerPx.y / rect.height) * 2 + 1);
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
        sticky.classList.toggle('is-hovering', !!target);
        if (target === 'kertas') tip.innerHTML = 'Kertas<small>poke me</small>';
        else if (target) tip.innerHTML = `${target.name}<small>${target.sub}</small>`;
        tip.classList.toggle('show', !!target);
        wake();
    }

    canvas.addEventListener('pointermove', (e) => {
        pointer.copy(toNdc(e));
        if (e.pointerType === 'mouse') setHover(pick(e));
        wake();
    });
    canvas.addEventListener('pointerleave', () => { pointer.set(9, 9); setHover(null); });

    let downAt = null;
    canvas.addEventListener('pointerdown', (e) => { downAt = [e.clientX, e.clientY]; });
    canvas.addEventListener('pointerup', (e) => {
        if (!downAt || Math.hypot(e.clientX - downAt[0], e.clientY - downAt[1]) > 10) return;
        downAt = null;
        pointer.copy(toNdc(e));
        const target = pick(e);
        if (target === 'kertas') poke();
        else if (target) {
            track('desk-pick', { item: target.id });
            goToStop(target.stop);
        }
        wake();
    });

    // ---------- Kertas talks ----------
    let talkTimer = 0, lastSaid = -1, lastPoke = 0;
    function say(text, ms = 4200) {
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

    const applyTone = () => { floorMat.opacity = root.dataset.tone === 'dark' ? 0.32 : 0.16; paintDesk(); };
    new MutationObserver(() => {
        applyTone();
        const line = PAPER_LINES[root.dataset.paper || 'graph'];
        if (visible && line) {
            if (!reducedMotion.matches) kState.hop = 1;
            lastPoke = performance.now();
            say(line);
        }
        wake();
    }).observe(root, { attributes: true, attributeFilter: ['data-paper', 'data-tone'] });
    applyTone();

    // ---------- loop: only runs while the desk is on screen ----------
    const clock = new THREE.Clock();
    let visible = false, rafId = 0, quietFrames = 0, firstFrame = true;
    const camPos = new THREE.Vector3(), camTarget = new THREE.Vector3();
    const goalPos = new THREE.Vector3(), goalTarget = new THREE.Vector3();

    function wake() {
        quietFrames = 0;
        if (!rafId && visible && !document.hidden && poses.length) { clock.getDelta(); rafId = requestAnimationFrame(frame); }
    }

    function frame() {
        rafId = 0;
        const dt = Math.min(clock.getDelta(), 0.05);
        const t = clock.elapsedTime;
        const still = reducedMotion.matches;
        const p = scrollProgress();
        const near = Math.round(p);

        // camera: rest at each stop, glide between them
        const i = Math.min(STOPS - 2, Math.floor(p));
        const f = smooth((p - i - 0.12) / 0.76);
        goalPos.copy(poses[i].pos).lerp(poses[i + 1].pos, f);
        goalTarget.copy(poses[i].target).lerp(poses[i + 1].target, f);
        lean.lerp(pointer.lengthSq() > 4 || still ? centre : pointer, 1 - Math.exp(-dt * 3));
        goalPos.x += lean.x * 0.35;
        goalPos.y += lean.y * 0.2;
        const k = firstFrame || still ? 1 : 1 - Math.exp(-dt * 7);
        camPos.lerp(goalPos, k);
        camTarget.lerp(goalTarget, k);
        firstFrame = false;
        camera.position.copy(camPos);
        camera.lookAt(camTarget);
        // the far desk fades into the paper colour, like the mockup
        const camDist = camPos.distanceTo(camTarget);
        scene.fog.near = camDist * 1.25;
        scene.fog.far = camDist * 3.2;

        // objects: the one at the current stop gets picked up
        for (const id in items) {
            const it = items[id];
            it.h = lerp(it.h, hovered === it ? 1 : 0, 1 - Math.exp(-dt * (still ? 40 : 8)));
            const goalF = clamp01(1 - Math.abs(p - it.stop) * 1.6);
            it.f = still ? goalF : lerp(it.f, goalF, 1 - Math.exp(-dt * 6));
            it.update(t, still);
        }

        // the desk clears space: other objects slide away from the one in focus
        let star = null;
        for (const id in items) if (!star || items[id].f > star.f) star = items[id];
        const clear = star ? ease(star.f) : 0;
        const push = (obj, base, amount) => {
            // slide sideways and back, never toward the camera
            v.set(base.x - star.base.x, 0, Math.min(0, base.z - star.base.z) * 0.5);
            if (Math.abs(v.x) < 0.5) v.x = Math.sign(v.x || 1) * 0.5;
            v.normalize().multiplyScalar(amount * clear);
            obj.position.set(base.x + v.x, base.y, base.z + v.z);
        };
        for (const id in items) {
            const it = items[id];
            if (it === star) it.group.position.copy(it.base);
            else push(it.group, it.base, 4.4);
        }
        push(pencil, PENCIL_HOME, 4.4);

        // doodles drift and dodge the pointer
        doodles.forEach((d) => {
            const u = d.userData;
            v.copy(d.position).project(camera);
            const dx = v.x - pointer.x, dy = v.y - pointer.y, dist = Math.hypot(dx, dy) || 1;
            if (!still && dist < 0.22) { u.off.x += (dx / dist) * dt * 3; u.off.z -= (dy / dist) * dt * 3; }
            u.off.multiplyScalar(1 - dt * 0.9).clampLength(0, 1.5);
            d.position.set(u.home.x + u.off.x, u.home.y + (still ? 0 : Math.sin(t * 1.1 + u.seed) * 0.18), u.home.z + u.off.z);
            if (!still) { d.rotation.x = t * 0.3 + u.seed; d.rotation.y = t * 0.45 + u.seed; }
        });

        // Kertas walks to the object at each stop
        const spot = guideSpot(i).clone().lerp(guideSpot(i + 1), smooth((p - i - 0.15) / 0.7));
        const beforeX = kState.pos.x, beforeZ = kState.pos.z;
        kState.pos.lerp(spot, still ? 1 : 1 - Math.exp(-dt * 3.5));
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

        // Kertas comments when you arrive at a stop
        if (Math.abs(p - near) < 0.12 && near !== lastSaid) {
            lastSaid = near;
            kState.wave = 1.4;
            if (near <= 1 && performance.now() - lastPoke > 3000) say(STOP_LINES[near]);
            else if (near > 1 && performance.now() - lastPoke > 3000) bubble.classList.remove('show');
        }

        scene.updateMatrixWorld();
        renderer.render(scene, camera);

        // speech bubble over Kertas, hover hint by the pointer
        v.set(0, 1.4, 0).applyMatrix4(kertas.matrixWorld).project(camera);
        const bx = (v.x * 0.5 + 0.5) * width, by = (-v.y * 0.5 + 0.5) * height;
        const bw = bubble.offsetWidth || 180;
        const clampedX = Math.max(bw / 2 + 12, Math.min(width - bw / 2 - 12, bx));
        bubble.style.transform = `translate(${Math.round(clampedX)}px, ${Math.round(by)}px) translate(-50%, -100%)`;
        bubble.style.visibility = v.z > 1 || by < 120 || by > height - 40 ? 'hidden' : 'visible';
        if (hovered) tip.style.transform = `translate(${Math.round(pointerPx.x + 16)}px, ${Math.round(pointerPx.y + 18)}px)`;

        railButtons.forEach((b) => b.classList.toggle('is-on', +b.dataset.tourGo === near));
        sticky.classList.toggle('is-past', window.scrollY > (stopAt[STOPS - 1] || 0) + height * 0.35);

        if (still && ++quietFrames > 20) return;
        if (visible && !document.hidden) rafId = requestAnimationFrame(frame);
    }

    window.addEventListener('scroll', wake, { passive: true });
    new IntersectionObserver(([entry]) => {
        visible = entry.isIntersecting;
        document.body.classList.toggle('desk-in-view', visible);
        if (visible) { measureStops(); wake(); }
    }).observe(tour);
    document.addEventListener('visibilitychange', wake);
    new ResizeObserver(resize).observe(sticky);
    new ResizeObserver(measureStops).observe(tour);

    measureOverview();
    resize();
}

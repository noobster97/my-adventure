// --- Rate Card Editor (owner only) ---
// Runs only on localhost. Edits data/rate-card.json with a live preview, then
// saves/downloads the JSON so it can be committed and pushed to GitHub.
// The public site never writes anything — publishing still requires repo access.

import { loadRateCard, mountRateCard } from './rate-card.js';

const GITHUB_EDIT_URL = 'https://github.com/noobster97/my-adventure/edit/main/data/rate-card.json';
const LOCAL_HOSTS = ['localhost', '127.0.0.1', '::1', '[::1]'];
const app = document.getElementById('editor-app');

const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
}[c]));
const slug = (text) => String(text || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'item';
const today = () => new Date().toISOString().slice(0, 10);

if (!LOCAL_HOSTS.includes(location.hostname)) {
    app.innerHTML = `
        <div class="ed-locked">
            <h1><i class="fas fa-lock"></i> Owner only</h1>
            <p>The rate card can only be edited by the site owner. Prices are published from the GitHub repository.</p>
            <a class="btn-primary" href="./#/rates"><i class="fas fa-tags"></i> View rate card</a>
            <a class="btn-secondary" href="${GITHUB_EDIT_URL}" rel="nofollow">Owner: edit on GitHub</a>
        </div>`;
} else {
    start();
}

async function start() {
    let data;
    try {
        data = await loadRateCard();
    } catch (err) {
        app.innerHTML = `<div class="ed-locked"><h1>Couldn't load</h1><p>${esc(err.message)}. Run <code>npm run dev</code> and open this page from the dev server.</p></div>`;
        return;
    }

    let dirty = false;
    let stampDate = true;
    let fileHandle = null;
    let preview = null;
    let previewTimer = 0;

    app.innerHTML = `
        <header class="ed-bar">
            <h1>Rate Card Editor <small>data/rate-card.json</small></h1>
            <span class="ed-status">All changes saved</span>
            <label class="ed-toggle"><input type="checkbox" data-stamp checked> Stamp today's date</label>
            <button type="button" data-copy><i class="fas fa-copy"></i> Copy JSON</button>
            <button type="button" data-download><i class="fas fa-download"></i> Download</button>
            <button type="button" class="primary" data-save><i class="fas fa-floppy-disk"></i> Save to file</button>
        </header>
        <div class="ed-layout">
            <aside class="ed-form"></aside>
            <main class="ed-preview"><div class="container" id="ed-preview-root"></div></main>
        </div>
        <div class="rc-toast ed-toast" role="status"></div>`;

    const form = app.querySelector('.ed-form');
    const statusEl = app.querySelector('.ed-status');
    const previewRoot = app.querySelector('#ed-preview-root');
    const toastEl = app.querySelector('.ed-toast');

    const toast = (message) => {
        toastEl.textContent = message;
        toastEl.classList.remove('is-on');
        void toastEl.offsetWidth;
        toastEl.classList.add('is-on');
    };

    const setDirty = (value) => {
        dirty = value;
        statusEl.textContent = value ? 'Unsaved changes' : 'All changes saved';
        statusEl.classList.toggle('is-dirty', value);
    };

    window.addEventListener('beforeunload', (e) => {
        if (dirty) e.preventDefault();
    });

    // --- Path helpers (e.g. "categories.0.packages.2.price") ---
    const getAt = (path) => path.split('.').reduce((obj, key) => obj?.[key], data);
    const setAt = (path, value) => {
        const keys = path.split('.');
        const last = keys.pop();
        const target = keys.reduce((obj, key) => {
            obj[key] ??= {};
            return obj[key];
        }, data);
        target[last] = value;
    };

    function field(label, path, { type = 'text', full = false, kind = 'text', placeholder = '' } = {}) {
        let value = getAt(path);
        if (kind === 'lines') value = (value || []).join('\n');
        const attrs = `data-path="${esc(path)}" data-kind="${kind}" placeholder="${esc(placeholder)}"`;
        const control = kind === 'lines'
            ? `<textarea ${attrs}>${esc(value)}</textarea>`
            : `<input type="${type}" ${attrs} value="${esc(value ?? '')}"${type === 'number' ? ' step="any" min="0"' : ''}>`;
        return `<label class="ed-field${full ? ' full' : ''}">${esc(label)}${control}</label>`;
    }

    function renderForm() {
        const meta = data.meta ||= {};
        data.categories ||= [];
        data.addons ||= [];

        form.innerHTML = `
            <p class="ed-help">Edit prices and packages here — the preview updates live. When you're done, click
                <strong>Save to file</strong> (choose <code>data/rate-card.json</code>) or <strong>Download</strong> and replace that file,
                then commit &amp; push. Only people with write access to the GitHub repo can publish changes.</p>

            <details class="ed-group" open>
                <summary>General</summary>
                <div class="ed-body ed-grid">
                    ${field('Title', 'meta.title')}
                    ${field('Currency', 'meta.currency', { placeholder: 'RM' })}
                    ${field('Subtitle', 'meta.subtitle', { full: true })}
                    ${field('Your name', 'meta.owner')}
                    ${field('Role', 'meta.role')}
                    ${field('Greeting name (used in WhatsApp)', 'meta.nickname')}
                    ${field('Email', 'meta.email', { type: 'email' })}
                    ${field('WhatsApp (digits only)', 'meta.whatsapp')}
                    ${field('Website', 'meta.website', { full: true })}
                    ${field('Last updated', 'meta.updated', { type: 'date' })}
                    ${field('Valid until', 'meta.validUntil', { type: 'date' })}
                </div>
            </details>

            <details class="ed-group">
                <summary>Second currency (optional)</summary>
                <div class="ed-body">
                    ${meta.secondaryCurrency ? `
                    <p class="ed-help" style="margin:0">Visitors can switch to this currency. Prices are converted with the rate below
                        (1 ${esc(meta.currency || 'RM')} = rate) and rounded.</p>
                    <div class="ed-grid three">
                        ${field('Code', 'meta.secondaryCurrency.code')}
                        ${field('Symbol', 'meta.secondaryCurrency.symbol')}
                        ${field('Rate', 'meta.secondaryCurrency.rate', { type: 'number', kind: 'number' })}
                    </div>
                    <button type="button" class="ed-add" data-act="cur-del"><i class="fas fa-trash"></i> Remove second currency</button>` : `
                    <p class="ed-help" style="margin:0">Off - prices show in ${esc(meta.currency || 'RM')} only.</p>
                    <button type="button" class="ed-add" data-act="cur-add"><i class="fas fa-plus"></i> Add a currency toggle (e.g. USD)</button>`}
                </div>
            </details>

            ${data.categories.map((cat, ci) => `
                <details class="ed-group" data-cat="${ci}">
                    <summary><i class="fas ${esc(cat.icon || 'fa-star')}"></i> <span class="ed-title">${esc(cat.name || 'Untitled')}</span>
                        <span class="ed-actions">
                            <button type="button" class="ed-icon" data-act="cat-up" data-ci="${ci}" title="Move up"><i class="fas fa-arrow-up"></i></button>
                            <button type="button" class="ed-icon" data-act="cat-down" data-ci="${ci}" title="Move down"><i class="fas fa-arrow-down"></i></button>
                            <button type="button" class="ed-icon danger" data-act="cat-del" data-ci="${ci}" title="Delete category"><i class="fas fa-trash"></i></button>
                        </span>
                    </summary>
                    <div class="ed-body">
                        <div class="ed-grid">
                            ${field('Category name', `categories.${ci}.name`)}
                            ${field('Icon (Font Awesome)', `categories.${ci}.icon`, { placeholder: 'fa-globe' })}
                            ${field('Short description', `categories.${ci}.blurb`, { full: true })}
                        </div>
                        ${(cat.packages || []).map((pkg, pi) => {
                            const base = `categories.${ci}.packages.${pi}`;
                            return `
                            <div class="ed-pkg">
                                <div class="ed-pkg-head"><span class="ed-title">${esc(pkg.name || 'Package')}</span>${pkg.popular ? ' <i class="fas fa-star" style="color:var(--secondary)"></i>' : ''}
                                    <span class="ed-actions">
                                        <button type="button" class="ed-icon" data-act="pkg-up" data-ci="${ci}" data-pi="${pi}" title="Move up"><i class="fas fa-arrow-up"></i></button>
                                        <button type="button" class="ed-icon" data-act="pkg-down" data-ci="${ci}" data-pi="${pi}" title="Move down"><i class="fas fa-arrow-down"></i></button>
                                        <button type="button" class="ed-icon" data-act="pkg-dup" data-ci="${ci}" data-pi="${pi}" title="Duplicate"><i class="fas fa-clone"></i></button>
                                        <button type="button" class="ed-icon danger" data-act="pkg-del" data-ci="${ci}" data-pi="${pi}" title="Delete"><i class="fas fa-trash"></i></button>
                                    </span>
                                </div>
                                <div class="ed-grid">
                                    ${field('Name', `${base}.name`)}
                                    ${field('Price', `${base}.price`, { type: 'number', kind: 'number' })}
                                    ${field('Before price', `${base}.prefix`, { placeholder: 'From' })}
                                    ${field('After price', `${base}.suffix`, { placeholder: '/month' })}
                                    ${field('Tagline', `${base}.tagline`, { full: true })}
                                    ${field('Timeline', `${base}.timeline`, { placeholder: '2 - 4 weeks' })}
                                    <label class="ed-check"><input type="checkbox" data-path="${base}.popular" data-kind="bool"${pkg.popular ? ' checked' : ''}> Most popular</label>
                                    ${field('Features (one per line)', `${base}.features`, { full: true, kind: 'lines' })}
                                </div>
                            </div>`;
                        }).join('')}
                        <button type="button" class="ed-add" data-act="pkg-add" data-ci="${ci}"><i class="fas fa-plus"></i> Add package</button>
                    </div>
                </details>`).join('')}

            <button type="button" class="ed-add" data-act="cat-add" style="width:100%;margin-bottom:1.2rem"><i class="fas fa-folder-plus"></i> Add category</button>

            <details class="ed-group">
                <summary>Add-ons</summary>
                <div class="ed-body">
                    ${data.addons.map((addon, ai) => `
                        <div class="ed-addon">
                            ${field('Name', `addons.${ai}.name`)}
                            ${field('Price', `addons.${ai}.price`, { type: 'number', kind: 'number' })}
                            ${field('Unit', `addons.${ai}.unit`, { placeholder: '/page' })}
                            <button type="button" class="ed-icon danger" data-act="addon-del" data-ai="${ai}" title="Delete"><i class="fas fa-trash"></i></button>
                        </div>`).join('')}
                    <button type="button" class="ed-add" data-act="addon-add"><i class="fas fa-plus"></i> Add add-on</button>
                </div>
            </details>

            <details class="ed-group">
                <summary>Notes &amp; terms</summary>
                <div class="ed-body">${field('One note per line', 'meta.notes', { full: true, kind: 'lines' })}</div>
            </details>`;
    }

    function refreshPreview({ immediate = false } = {}) {
        clearTimeout(previewTimer);
        const run = () => {
            const current = preview?.category;
            preview = mountRateCard(previewRoot, JSON.parse(JSON.stringify(data)), { persist: false, initialCategory: current, intro: false });
        };
        if (immediate) run();
        else previewTimer = setTimeout(run, 350);
    }

    const uniqueId = (base) => {
        const ids = new Set([
            ...data.categories.flatMap((c) => [c.id, ...(c.packages || []).map((p) => p.id)]),
            ...data.addons.map((a) => a.id)
        ]);
        let id = slug(base);
        let n = 2;
        while (ids.has(id)) id = `${slug(base)}-${n++}`;
        return id;
    };

    const move = (list, from, to) => {
        if (to < 0 || to >= list.length) return;
        const [item] = list.splice(from, 1);
        list.splice(to, 0, item);
    };

    // --- Form events ---
    form.addEventListener('input', (e) => {
        const el = e.target.closest('[data-path]');
        if (!el) return;
        const kind = el.dataset.kind;
        let value = el.value;
        if (kind === 'number') value = value === '' ? 0 : Number(value);
        if (kind === 'bool') value = el.checked;
        if (kind === 'lines') value = value.split('\n').map((l) => l.trim()).filter(Boolean);
        setAt(el.dataset.path, value);
        if (/^categories\.\d+\.name$/.test(el.dataset.path)) {
            el.closest('details').querySelector(':scope > summary .ed-title').textContent = value || 'Untitled';
        } else if (/\.packages\.\d+\.name$/.test(el.dataset.path)) {
            el.closest('.ed-pkg').querySelector('.ed-title').textContent = value || 'Package';
        }
        setDirty(true);
        refreshPreview();
    });

    form.addEventListener('click', (e) => {
        const btn = e.target.closest('[data-act]');
        if (!btn) return;
        e.preventDefault();
        const ci = Number(btn.dataset.ci);
        const pi = Number(btn.dataset.pi);
        const cat = data.categories[ci];
        const openCats = new Set(Array.from(form.querySelectorAll('details[data-cat][open]')).map((d) => Number(d.dataset.cat)));

        switch (btn.dataset.act) {
            case 'cat-add':
                data.categories.push({ id: uniqueId('new-category'), name: 'New category', icon: 'fa-star', blurb: '', packages: [] });
                openCats.add(data.categories.length - 1);
                break;
            case 'cat-del':
                if (!confirm(`Delete "${cat.name}" and all its packages?`)) return;
                data.categories.splice(ci, 1);
                break;
            case 'cat-up': move(data.categories, ci, ci - 1); break;
            case 'cat-down': move(data.categories, ci, ci + 1); break;
            case 'pkg-add':
                cat.packages.push({ id: uniqueId(`${cat.id}-package`), name: 'New package', tagline: '', price: 0, prefix: '', suffix: '', timeline: '', popular: false, features: [] });
                openCats.add(ci);
                break;
            case 'pkg-dup': {
                const copy = JSON.parse(JSON.stringify(cat.packages[pi]));
                copy.id = uniqueId(copy.id);
                copy.name = `${copy.name} copy`;
                cat.packages.splice(pi + 1, 0, copy);
                openCats.add(ci);
                break;
            }
            case 'pkg-del':
                if (!confirm(`Delete "${cat.packages[pi].name}"?`)) return;
                cat.packages.splice(pi, 1);
                openCats.add(ci);
                break;
            case 'pkg-up': move(cat.packages, pi, pi - 1); openCats.add(ci); break;
            case 'pkg-down': move(cat.packages, pi, pi + 1); openCats.add(ci); break;
            case 'cur-add':
                data.meta.secondaryCurrency = { code: 'USD', symbol: '$', rate: 0.21 };
                break;
            case 'cur-del':
                delete data.meta.secondaryCurrency;
                break;
            case 'addon-add':
                data.addons.push({ id: uniqueId('addon'), name: 'New add-on', price: 0, unit: '' });
                break;
            case 'addon-del':
                data.addons.splice(Number(btn.dataset.ai), 1);
                break;
            default: return;
        }
        const addonsOpen = btn.dataset.act.startsWith('addon');
        renderForm();
        openCats.forEach((i) => form.querySelector(`details[data-cat="${i}"]`)?.setAttribute('open', ''));
        if (addonsOpen) form.querySelectorAll('details.ed-group')[form.querySelectorAll('details.ed-group').length - 2]?.setAttribute('open', '');
        setDirty(true);
        refreshPreview({ immediate: true });
    });

    // --- Output ---
    const serialize = () => {
        if (stampDate) data.meta.updated = today();
        return `${JSON.stringify(data, null, 2)}\n`;
    };

    app.querySelector('[data-stamp]').addEventListener('change', (e) => { stampDate = e.target.checked; });

    app.querySelector('[data-copy]').addEventListener('click', async () => {
        try {
            await navigator.clipboard.writeText(serialize());
            toast('JSON copied — paste it into data/rate-card.json');
        } catch {
            toast('Clipboard blocked — use Download instead');
        }
    });

    const download = () => {
        const blob = new Blob([serialize()], { type: 'application/json' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = 'rate-card.json';
        a.click();
        setTimeout(() => URL.revokeObjectURL(a.href), 1000);
        setDirty(false);
        toast('Downloaded — replace data/rate-card.json with it');
    };

    app.querySelector('[data-download]').addEventListener('click', download);

    app.querySelector('[data-save]').addEventListener('click', async () => {
        if (!window.showSaveFilePicker) {
            download();
            return;
        }
        try {
            fileHandle ??= await window.showSaveFilePicker({
                suggestedName: 'rate-card.json',
                types: [{ description: 'JSON', accept: { 'application/json': ['.json'] } }]
            });
            const writable = await fileHandle.createWritable();
            await writable.write(serialize());
            await writable.close();
            setDirty(false);
            renderForm();
            refreshPreview({ immediate: true });
            toast('Saved ✓ Now commit & push to publish');
        } catch (err) {
            if (err.name !== 'AbortError') {
                console.error(err);
                toast('Save failed — try Download instead');
            }
        }
    });

    renderForm();
    refreshPreview({ immediate: true });
}

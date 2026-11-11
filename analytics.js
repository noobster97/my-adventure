// Privacy-friendly visitor stats (Umami: no cookies, no personal data).
// Does nothing until an ID is set in index.html:
//   <meta name="analytics-id" content="YOUR-UMAMI-WEBSITE-ID">
// Other scripts report events with:
//   document.dispatchEvent(new CustomEvent('track', { detail: { name: 'paper-change', data: { paper: 'kraft' } } }))

const meta = (name) => document.querySelector(`meta[name="${name}"]`)?.content.trim() || '';
const websiteId = meta('analytics-id');
const scriptSrc = meta('analytics-src') || 'https://cloud.umami.is/script.js';
const isLocal = ['localhost', '127.0.0.1', ''].includes(location.hostname);

if (websiteId && !isLocal) {
    const queue = [];
    let ready = false;

    const send = (job) => {
        if (ready) job(window.umami);
        else queue.push(job);
    };

    const script = document.createElement('script');
    script.defer = true;
    script.src = scriptSrc;
    script.dataset.websiteId = websiteId;
    script.dataset.autoTrack = 'false';
    script.dataset.doNotTrack = 'true';
    script.addEventListener('load', () => {
        if (!window.umami) return;
        ready = true;
        queue.splice(0).forEach((job) => job(window.umami));
    });
    document.head.append(script);

    // Pages: the router sets body[data-view]; report each change as a page view.
    let lastView = null;
    const pageView = () => {
        const view = document.body.dataset.view;
        if (!view || view === lastView) return;
        lastView = view;
        const url = view === 'home' ? '/' : `/${view}`;
        send((umami) => umami.track((props) => ({ ...props, url, title: document.title })));
    };
    new MutationObserver(pageView).observe(document.body, { attributes: true, attributeFilter: ['data-view'] });
    pageView();

    const event = (name, data) => send((umami) => umami.track(name, data));

    // Events from other scripts (paper switcher, Kertas, ...)
    document.addEventListener('track', (e) => {
        if (e.detail?.name) event(e.detail.name, e.detail.data);
    });

    // The clicks that matter for enquiries
    document.addEventListener('click', (e) => {
        const link = e.target.closest?.('a[href]');
        if (link) {
            const href = link.getAttribute('href');
            const page = document.body.dataset.view;
            if (/wa\.me|whatsapp/i.test(href)) event('whatsapp-click', { page });
            else if (href.startsWith('mailto:')) event('email-click', { page });
            else if (/\.pdf(\?|$)/i.test(href)) event('resume-download', { page });
            else if (/^https?:/i.test(href)) event('outbound-click', { to: new URL(href).hostname });
            return;
        }
        if (e.target.closest?.('.rc-add')) event('estimate-add');
    }, true);
}

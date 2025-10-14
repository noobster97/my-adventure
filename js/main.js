// Feature detect pointer precision for custom cursor
(function() {
    var isFinePointer = window.matchMedia('(pointer: fine)').matches;
    if (isFinePointer) { document.body.classList.add('desktop'); }
})();

// Custom cursor (snappy primary, smoother follower)
(function() {
    var cursor = document.querySelector('.cursor');
    var follower = document.querySelector('.cursor-follower');
    if (!cursor || !follower) return;
    var x = 0, y = 0, fx = 0, fy = 0;
    document.addEventListener('mousemove', function(e) {
        x = e.clientX; y = e.clientY;
        cursor.style.transform = 'translate3d(' + (x - 8) + 'px,' + (y - 8) + 'px,0)';
    }, { passive: true });
    function animate() {
        fx += (x - fx) * 0.5; // slightly snappier to reduce residual lag
        fy += (y - fy) * 0.5;
        follower.style.transform = 'translate3d(' + (fx - 14) + 'px,' + (fy - 14) + 'px,0)';
        requestAnimationFrame(animate);
    }
    animate();
})();

// Nav scroll effect
(function() {
    var nav = document.getElementById('nav');
    if (!nav) return;
    function onScroll() { if (window.scrollY > 8) { nav.classList.add('scrolled'); } else { nav.classList.remove('scrolled'); } document.documentElement.style.setProperty('--navH', nav.offsetHeight + 'px'); }
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
})();

// Mobile menu toggle
(function() {
    var btn = document.getElementById('mobileMenu');
    var links = document.getElementById('navLinks');
    var overlay = document.getElementById('navOverlay');
    if (!btn || !links) return;
    btn.addEventListener('click', function() {
        var isOpen = links.classList.toggle('open');
        btn.setAttribute('aria-expanded', String(isOpen));
        if (overlay) overlay.style.display = isOpen ? 'block' : 'none';
    });
    links.querySelectorAll('a').forEach(function(a) { a.addEventListener('click', function() { links.classList.remove('open'); btn.setAttribute('aria-expanded', 'false'); if (overlay) overlay.style.display = 'none'; }); });
    if (overlay) overlay.addEventListener('click', function(){ links.classList.remove('open'); btn.setAttribute('aria-expanded', 'false'); overlay.style.display = 'none'; });
})();

// Typewriter starter (called after data load)
function startTypewriter(customPhrases) {
    var el = document.getElementById('typed-text');
    if (!el) return;
    var phrases = customPhrases && customPhrases.length ? customPhrases : [
        'Full Stack Developer',
        'Laravel, PHP, JavaScript',
        'Flutter & React Native',
        'Building elegant, reliable software'
    ];
    var i = 0, j = 0, forward = true;
    function tick() {
        var current = phrases[i];
        el.textContent = current.slice(0, j);
        if (forward) {
            if (j < current.length) { j++; }
            else { forward = false; setTimeout(tick, 1200); return; }
        } else {
            if (j > 0) { j--; }
            else { forward = true; i = (i + 1) % phrases.length; }
        }
        setTimeout(tick, forward ? 70 : 40);
    }
    tick();
}

// Skill bars animate on view
(function() {
    var bars = document.querySelectorAll('.skill-progress');
    if (!('IntersectionObserver' in window)) { bars.forEach(function(b){ b.style.width = b.getAttribute('data-width') || '0%'; }); return; }
    var io = new IntersectionObserver(function(entries, obs) {
        entries.forEach(function(entry) {
            if (entry.isIntersecting) {
                var el = entry.target;
                var width = el.getAttribute('data-width') || '0%';
                el.style.width = width;
                obs.unobserve(el);
            }
        });
    }, { threshold: 0.4 });
    bars.forEach(function(b){ io.observe(b); });
    // pointer highlight for skill cards
    var skillCards = document.querySelectorAll('.skill');
    skillCards.forEach(function(card){
        card.addEventListener('mousemove', function(e){
            var rect = card.getBoundingClientRect();
            card.style.setProperty('--mx', (e.clientX - rect.left) + 'px');
            card.style.setProperty('--my', (e.clientY - rect.top) + 'px');
        });
    });
})();

// Current year
(function(){
    var y = document.getElementById('year');
    if (y) y.textContent = new Date().getFullYear();
})();

// Render Experience and Projects from JSON
async function renderData() {
    try {
        var exp, projects, skills, profile;
        if (location.protocol === 'file:') {
            // Local fallback: read inline JSON to avoid CORS on file://
            var expTag = document.getElementById('experience-data');
            var projTag = document.getElementById('projects-data');
            var skillsTag = document.getElementById('skills-data');
            var profileTag = document.getElementById('profile-data');
            exp = expTag ? JSON.parse(expTag.textContent || '[]') : [];
            projects = projTag ? JSON.parse(projTag.textContent || '[]') : [];
            skills = skillsTag ? JSON.parse(skillsTag.textContent || '{}') : {};
            profile = profileTag ? JSON.parse(profileTag.textContent || '{}') : {};
        } else {
            var [expRes, projRes, skillsRes, profileRes] = await Promise.all([
                fetch('data/experience.json', { cache: 'no-cache' }),
                fetch('data/projects.json', { cache: 'no-cache' }),
                fetch('data/skills.json', { cache: 'no-cache' }),
                fetch('data/profile.json', { cache: 'no-cache' })
            ]);
            exp = await expRes.json();
            projects = await projRes.json();
            skills = await skillsRes.json();
            profile = await profileRes.json();
        }

        var expContainer = document.querySelector('#experience .timeline');
        if (expContainer) {
            expContainer.innerHTML = exp.map(function(job){
                var points = job.points.map(function(p){ return '<li>' + p + '</li>'; }).join('');
                return '\n<div class="timeline-item">\n  <div class="timeline-bullet" aria-hidden="true"></div>\n  <div class="job-card">\n    <div class="job-title">' + job.title + '</div>\n    <div class="company-role">' + job.company + '</div>\n    <div class="job-meta">' + job.period + ' • ' + job.location + '</div>\n    <ul class="job-points">' + points + '</ul>\n  </div>\n</div>';
            }).join('');
        }

        var projGrid = document.querySelector('#projects .projects-grid');
        if (projGrid) {
            projGrid.innerHTML = projects.map(function(p){
                var tags = p.tags.map(function(t){ return '<span class="tag">' + t + '</span>'; }).join('');
                var linkStart = p.link ? '<a href="' + p.link + '" target="_blank" rel="noopener" class="project-card">' : '<article class="project-card">';
                var linkEnd = p.link ? '</a>' : '</article>';
                return linkStart + '\n  <div class="project-image" aria-hidden="true">' + (p.emoji || '💻') + '</div>\n  <div class="project-info">\n    <h3>' + p.name + '</h3>\n    <p>' + p.description + '</p>\n    <div class="project-tags">' + tags + '</div>\n  </div>\n' + linkEnd;
            }).join('');
        }
        // Dynamic stats derived from data
        var projectsCount = Array.isArray(projects) ? projects.length : 0;
        var earliest = null;
        if (Array.isArray(exp)) {
            exp.forEach(function(job){
                if (!job.period) return;
                var match = String(job.period).match(/([A-Za-z]+)\s+(\d{4})/); // first month year
                if (match) {
                    var monthName = match[1];
                    var year = parseInt(match[2], 10);
                    var monthIndex = ['january','february','march','april','may','june','july','august','september','october','november','december'].indexOf(monthName.toLowerCase());
                    var d = new Date(year, monthIndex > -1 ? monthIndex : 0, 1);
                    if (!earliest || d < earliest) earliest = d;
                }
            });
        }
        var years = 0;
        if (earliest) {
            var now = new Date();
            var months = (now.getFullYear() - earliest.getFullYear()) * 12 + (now.getMonth() - earliest.getMonth());
            years = Math.max(1, Math.floor(months / 12));
        }
        var projectEl = document.querySelector('.stat-number[data-key="projects"]');
        var yearsEl = document.querySelector('.stat-number[data-key="years"]');
        if (projectEl) projectEl.textContent = String(projectsCount) + '+';
        if (yearsEl && years) yearsEl.textContent = String(years) + '+';

        // Render skills summary and badges
        // Clean skill bars (we'll present badges only)
        var skillsWrap = document.querySelector('.skills');
        if (skillsWrap) { skillsWrap.innerHTML = ''; }
        if (skills && skills.badges) {
            var badgesWrap = document.querySelector('.stack-badges');
            if (badgesWrap) {
                badgesWrap.innerHTML = skills.badges.map(function(b){
                    var v = String(b).toLowerCase();
                    var tone = 'tool';
                    if (/(php|javascript|java|html|css)/.test(v)) tone = 'lang';
                    else if (/(laravel|flutter|react native|react|next|tailwind|bootstrap|filament)/.test(v)) tone = 'framework';
                    else if (/(mysql|mysqli|phpmyadmin|api)/.test(v)) tone = 'db';
                    return '<span class="badge" data-tone="' + tone + '">' + b + '</span>';
                }).join('');
            }
        }
        // About text and typewriter from profile
        if (profile && profile.about) {
            var aboutBlocks = document.querySelectorAll('#about .about-text p');
            if (aboutBlocks[0]) aboutBlocks[0].textContent = profile.about.headline || aboutBlocks[0].textContent;
            if (aboutBlocks[1]) {
                var summary = profile.about.summary || aboutBlocks[1].textContent;
                if (summary.indexOf('{years}') > -1) summary = summary.replace('{years}', String(years || ''));
                if (summary.indexOf('{projects}') > -1) summary = summary.replace('{projects}', String(projectsCount || ''));
                aboutBlocks[1].textContent = summary;
            }
            startTypewriter(Array.isArray(profile.about.phrases) ? profile.about.phrases : undefined);
        } else {
            // No profile provided (e.g., file:// without inline profile). Try to normalize years in existing text.
            var aboutBlocks = document.querySelectorAll('#about .about-text p');
            if (aboutBlocks[1]) {
                var txt = aboutBlocks[1].textContent;
                // Replace any N+ years with computed years
                if (years) {
                    txt = txt.replace(/\b\d+\+?\s*years/ig, String(years) + '+ years');
                }
                // Replace any {years}/{projects} tokens if present
                txt = txt.replace('{years}', String(years || ''));
                txt = txt.replace('{projects}', String(projectsCount || ''));
                aboutBlocks[1].textContent = txt;
            }
            startTypewriter();
        }
        // Stats from profile
        if (profile && profile.stats) {
            var projectEl = document.querySelector('.stat-number[data-key="projects"]');
            var yearsEl = document.querySelector('.stat-number[data-key="years"]');
            if (projectEl) projectEl.textContent = String(profile.stats.projects) + '+';
            if (yearsEl) yearsEl.textContent = String(profile.stats.years) + '+';
        }
    } catch (e) {
        console.error('Failed to load data', e);
    }
}

document.addEventListener('DOMContentLoaded', renderData);

// Avoid auto-scrolling to a hash on reload; ensure we start at top unless user navigated
(function() {
    if ('scrollRestoration' in history) {
        history.scrollRestoration = 'manual';
    }
    // If URL has a hash on initial load (e.g., after hard refresh), scroll to top
    if (location.hash && performance && performance.getEntriesByType) {
        // Defer to next frame to avoid fighting layout
        requestAnimationFrame(function(){ window.scrollTo(0, 0); });
    }
})();



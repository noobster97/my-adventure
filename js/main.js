// Horizontal Slide Navigation System
(function() {
    var currentSlide = 0;
    var totalSlides = 6;
    var slidesWrapper = document.querySelector('.slides-wrapper');
    var slides = document.querySelectorAll('.slide');
    var indicators = document.querySelectorAll('.indicator');
    var progressBar = document.querySelector('.progress-bar');
    var isTransitioning = false;
    
    // Initialize slides
    function initSlides() {
        slides.forEach(function(slide, index) {
            if (index === 0) {
                slide.classList.add('active');
            } else {
                slide.classList.remove('active');
            }
        });
        
        updateIndicators();
        updateProgress();
        initNavigation();
    }
    
    // Initialize navigation links
    function initNavigation() {
        var navLinks = document.querySelectorAll('.nav-link');
        navLinks.forEach(function(link) {
            link.addEventListener('click', function(e) {
                e.preventDefault();
                var href = this.getAttribute('href');
                var slideId = href.substring(1); // Remove the #
                
                // Map slide IDs to slide indices
                var slideMap = {
                    'home': 0,
                    'about': 1,
                    'experience': 2,
                    'education': 3,
                    'projects': 4,
                    'contact': 5
                };
                
                var slideIndex = slideMap[slideId];
                if (slideIndex !== undefined) {
                    goToSlide(slideIndex);
                }
            });
        });
        
        // Also handle logo click
        var logo = document.querySelector('.logo');
        if (logo) {
            logo.addEventListener('click', function(e) {
                e.preventDefault();
                goToSlide(0); // Go to home slide
            });
        }
    }
    
    function goToSlide(slideIndex) {
        if (isTransitioning || slideIndex === currentSlide) return;
        
        isTransitioning = true;
        
        // Update current slide
        slides[currentSlide].classList.remove('active');
        slides[slideIndex].classList.add('active');
        
        // Move slides wrapper
        var translateX = -slideIndex * 16.666;
        slidesWrapper.style.transform = 'translateX(' + translateX + '%)';
        
        // Update indicators and progress
        updateIndicators(slideIndex);
        updateProgress(slideIndex);
        
        currentSlide = slideIndex;
        
        // Reset transition lock
        setTimeout(function() {
            isTransitioning = false;
        }, 800);
        
        // Update URL hash
        var sectionNames = ['home', 'about', 'experience', 'education', 'projects', 'contact'];
        if (sectionNames[slideIndex]) {
            history.replaceState(null, null, '#' + sectionNames[slideIndex]);
        }
    }
    
    function nextSlide() {
        var next = (currentSlide + 1) % totalSlides;
        goToSlide(next);
    }
    
    function prevSlide() {
        var prev = (currentSlide - 1 + totalSlides) % totalSlides;
        goToSlide(prev);
    }
    
    function updateIndicators(activeIndex) {
        activeIndex = activeIndex !== undefined ? activeIndex : currentSlide;
        indicators.forEach(function(indicator, index) {
            if (index === activeIndex) {
                indicator.classList.add('active');
            } else {
                indicator.classList.remove('active');
            }
        });
    }
    
    function updateProgress(activeIndex) {
        activeIndex = activeIndex !== undefined ? activeIndex : currentSlide;
        var progress = ((activeIndex + 1) / totalSlides) * 100;
        progressBar.style.width = progress + '%';
    }
    
    // Event listeners
    function addEventListeners() {
        // Indicator clicks
        indicators.forEach(function(indicator, index) {
            indicator.addEventListener('click', function() {
                goToSlide(index);
            });
        });
        
        // Mouse wheel navigation
        var wheelTimeout;
        document.addEventListener('wheel', function(e) {
            if (isTransitioning) return;
            
            clearTimeout(wheelTimeout);
            wheelTimeout = setTimeout(function() {
                if (e.deltaY > 0) {
                    nextSlide();
                } else {
                    prevSlide();
                }
            }, 50);
        }, { passive: true });
        
    // Enhanced touch/swipe navigation for mobile
    var startX = 0;
    var startY = 0;
    var startTime = 0;
    var isSwipe = false;
    var minSwipeDistance = 50;
    var maxSwipeTime = 300;
    var isScrolling = false;
    
    document.addEventListener('touchstart', function(e) {
        startX = e.touches[0].clientX;
        startY = e.touches[0].clientY;
        startTime = Date.now();
        isSwipe = false;
        isScrolling = false;
    }, { passive: true });
    
    document.addEventListener('touchmove', function(e) {
        if (!startX || !startY) return;
        
        var diffX = startX - e.touches[0].clientX;
        var diffY = startY - e.touches[0].clientY;
        
        // Check if user is scrolling vertically (not swiping horizontally)
        if (Math.abs(diffY) > Math.abs(diffX)) {
            isScrolling = true;
            return;
        }
        
        // Determine if this is a horizontal swipe
        if (Math.abs(diffX) > Math.abs(diffY) && Math.abs(diffX) > 10) {
            isSwipe = true;
            
            // Only prevent default if we can actually cancel the event and it's not scrolling
            if (e.cancelable && !isScrolling) {
                e.preventDefault();
            }
            
            // Add visual feedback for swipe
            var swipeIndicator = document.querySelector('.swipe-indicator');
            if (!swipeIndicator) {
                swipeIndicator = document.createElement('div');
                swipeIndicator.className = 'swipe-indicator';
                swipeIndicator.style.cssText = `
                    position: fixed;
                    top: 50%;
                    left: 50%;
                    transform: translate(-50%, -50%);
                    width: 60px;
                    height: 60px;
                    background: rgba(102, 126, 234, 0.2);
                    border: 2px solid var(--primary);
                    border-radius: 50%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-size: 24px;
                    color: var(--primary);
                    z-index: 10000;
                    backdrop-filter: blur(10px);
                    opacity: 0;
                    transition: opacity 0.3s ease;
                    pointer-events: none;
                `;
                document.body.appendChild(swipeIndicator);
            }
            
            if (diffX > 0) {
                swipeIndicator.innerHTML = '→';
                swipeIndicator.style.opacity = '1';
            } else {
                swipeIndicator.innerHTML = '←';
                swipeIndicator.style.opacity = '1';
            }
        }
    }, { passive: false });
    
    document.addEventListener('touchend', function(e) {
        if (!isSwipe || isTransitioning || isScrolling) {
            // Hide swipe indicator
            var swipeIndicator = document.querySelector('.swipe-indicator');
            if (swipeIndicator) {
                swipeIndicator.style.opacity = '0';
                setTimeout(() => swipeIndicator.remove(), 300);
            }
            return;
        }
        
        var diffX = startX - e.changedTouches[0].clientX;
        var diffY = startY - e.changedTouches[0].clientY;
        var swipeTime = Date.now() - startTime;
        
        // Check if it's a valid swipe
        if (Math.abs(diffX) > minSwipeDistance && 
            Math.abs(diffX) > Math.abs(diffY) && 
            swipeTime < maxSwipeTime) {
            
            if (diffX > 0) {
                nextSlide();
            } else {
                prevSlide();
            }
            
            // Add haptic feedback if available
            if (navigator.vibrate) {
                navigator.vibrate(50);
            }
        }
        
        // Hide swipe indicator
        var swipeIndicator = document.querySelector('.swipe-indicator');
        if (swipeIndicator) {
            swipeIndicator.style.opacity = '0';
            setTimeout(() => swipeIndicator.remove(), 300);
        }
        
        startX = 0;
        startY = 0;
        isSwipe = false;
        isScrolling = false;
    }, { passive: true });
        
        // Keyboard navigation
        document.addEventListener('keydown', function(e) {
            if (isTransitioning) return;
            
            switch(e.key) {
                case 'ArrowRight':
                case 'ArrowDown':
                    e.preventDefault();
                    nextSlide();
                    break;
                case 'ArrowLeft':
                case 'ArrowUp':
                    e.preventDefault();
                    prevSlide();
                    break;
                case 'Home':
                    e.preventDefault();
                    goToSlide(0);
                    break;
                case 'End':
                    e.preventDefault();
                    goToSlide(totalSlides - 1);
                    break;
            }
        });
        
        // Next slide button
        var nextSlideBtn = document.querySelector('.next-slide');
        if (nextSlideBtn) {
            nextSlideBtn.addEventListener('click', function() {
                nextSlide();
            });
        }
        
        // Auto-advance (optional - can be disabled)
        var autoAdvance = false;
        if (autoAdvance) {
            setInterval(function() {
                if (!isTransitioning) {
                    nextSlide();
                }
            }, 10000); // 10 seconds
        }
    }
    
    // Initialize
    initSlides();
    addEventListeners();
    
    // Handle initial hash
    var hash = window.location.hash.substring(1);
    var sectionNames = ['home', 'about', 'experience', 'education', 'projects', 'contact'];
    var hashIndex = sectionNames.indexOf(hash);
    if (hashIndex !== -1) {
        goToSlide(hashIndex);
    }
})();

// Contact form handler (no form element to prevent POST requests)
(function() {
    var sendBtn = document.getElementById('sendMessageBtn');
    if (sendBtn) {
        sendBtn.addEventListener('click', function() {
            var name = document.getElementById('contactName').value;
            var email = document.getElementById('contactEmail').value;
            var message = document.getElementById('contactMessage').value;
            
            if (name && email && message) {
                var mailtoLink = 'mailto:muhammadsyafiq1102@gmail.com?subject=Portfolio Contact&body=' + 
                    encodeURIComponent('Name: ' + name + '\nEmail: ' + email + '\nMessage: ' + message);
                
                window.location.href = mailtoLink;
            } else {
                alert('Please fill in all fields');
            }
        });
    }
})();

// Enhanced Interactive Splash Screen
(function() {
    var splashScreen = document.getElementById('splashScreen');
    var loadingText = document.querySelector('.loading-text');
    var splashContent = document.querySelector('.splash-content');
    var splashOrbs = document.querySelectorAll('.splash-orb');
    
    var loadingSteps = [
        'Initializing Experience...',
        'Loading Portfolio Assets...',
        'Preparing Interactive Elements...',
        'Almost Ready...',
        'Welcome to My World!'
    ];
    var currentStep = 0;
    var isInteractive = false;
    
    // Add interactive elements
    function addInteractiveElements() {
        // Add clickable particles
        for (var i = 0; i < 20; i++) {
            var particle = document.createElement('div');
            particle.className = 'splash-particle';
            particle.style.cssText = `
                position: absolute;
                width: 4px;
                height: 4px;
                background: var(--primary);
                border-radius: 50%;
                pointer-events: none;
                opacity: 0;
                animation: particleFloat ${3 + Math.random() * 2}s ease-in-out infinite;
                animation-delay: ${Math.random() * 2}s;
                left: ${Math.random() * 100}%;
                top: ${Math.random() * 100}%;
            `;
            splashScreen.appendChild(particle);
        }
        
        // Add progress bar
        var progressBar = document.createElement('div');
        progressBar.className = 'splash-progress';
        progressBar.innerHTML = '<div class="progress-fill"></div>';
        splashContent.appendChild(progressBar);
        
        // Add skip button
        var skipBtn = document.createElement('button');
        skipBtn.className = 'splash-skip';
        skipBtn.textContent = 'Skip';
        skipBtn.style.cssText = `
            position: absolute;
            bottom: 20px;
            right: 20px;
            background: transparent;
            border: 1px solid rgba(255,255,255,0.3);
            color: rgba(255,255,255,0.7);
            padding: 8px 16px;
            border-radius: 20px;
            font-size: 12px;
            cursor: pointer;
            transition: all 0.3s ease;
            opacity: 0;
        `;
        splashScreen.appendChild(skipBtn);
        
        // Show skip button after 2 seconds
        setTimeout(function() {
            skipBtn.style.opacity = '1';
        }, 2000);
        
        skipBtn.addEventListener('click', hideSplashScreen);
    }
    
    function updateLoadingText() {
        if (currentStep < loadingSteps.length) {
            loadingText.textContent = loadingSteps[currentStep];
            
            // Update progress bar
            var progressFill = document.querySelector('.progress-fill');
            if (progressFill) {
                var progress = ((currentStep + 1) / loadingSteps.length) * 100;
                progressFill.style.width = progress + '%';
            }
            
            currentStep++;
            setTimeout(updateLoadingText, 600);
        }
    }
    
    function addMouseInteraction() {
        splashScreen.addEventListener('mousemove', function(e) {
            if (!isInteractive) return;
            
            var rect = splashScreen.getBoundingClientRect();
            var x = (e.clientX - rect.left) / rect.width;
            var y = (e.clientY - rect.top) / rect.height;
            
            // Move orbs based on mouse position
            splashOrbs.forEach(function(orb, index) {
                var intensity = 20 * (index + 1);
                var moveX = (x - 0.5) * intensity;
                var moveY = (y - 0.5) * intensity;
                
                orb.style.transform = `translate(${moveX}px, ${moveY}px) scale(${1 + (index + 1) * 0.1})`;
            });
        });
    }
    
    function hideSplashScreen() {
        splashScreen.classList.add('fade-out');
        setTimeout(function() {
            splashScreen.style.display = 'none';
            document.body.classList.add('loaded');
        }, 800);
    }
    
    // Initialize interactive elements
    setTimeout(function() {
        isInteractive = true;
        addInteractiveElements();
        addMouseInteraction();
    }, 1000);
    
    // Start loading sequence
    setTimeout(updateLoadingText, 500);
    
    // Hide splash screen after minimum loading time
    setTimeout(hideSplashScreen, 4000);
    
    // Also hide on click/tap for impatient users
    splashScreen.addEventListener('click', function(e) {
        if (e.target.classList.contains('splash-skip')) return;
        if (currentStep >= 2) {
            hideSplashScreen();
        }
    });
})();

// Feature detect pointer precision for custom cursor
(function() {
    var isFinePointer = window.matchMedia('(pointer: fine)').matches;
    if (isFinePointer) { document.body.classList.add('desktop'); }
})();

// Optimized Custom Cursor with GPU acceleration
(function() {
    var cursor = document.querySelector('.cursor');
    var follower = document.querySelector('.cursor-follower');
    if (!cursor || !follower) return;
    
    var x = 0, y = 0, fx = 0, fy = 0;
    var isMoving = false;
    var rafId = null;
    
    // Enable GPU acceleration
    cursor.style.willChange = 'transform';
    follower.style.willChange = 'transform';
    cursor.style.transform = 'translate3d(0, 0, 0)';
    follower.style.transform = 'translate3d(0, 0, 0)';
    
    // Throttled mousemove handler
    var lastMoveTime = 0;
    document.addEventListener('mousemove', function(e) {
        var now = performance.now();
        if (now - lastMoveTime < 16) return; // 60fps throttle
        
        lastMoveTime = now;
        x = e.clientX;
        y = e.clientY;
        
        // Immediate cursor update
        cursor.style.transform = 'translate3d(' + (x - 8) + 'px, ' + (y - 8) + 'px, 0)';
        
        if (!isMoving) {
            isMoving = true;
            animate();
        }
    }, { passive: true });
    
    // Optimized animation loop
    function animate() {
        if (!isMoving) return;
        
        var dx = x - fx;
        var dy = y - fy;
        
        // Use faster easing for better responsiveness
        fx += dx * 0.12;
        fy += dy * 0.12;
        
        follower.style.transform = 'translate3d(' + (fx - 14) + 'px, ' + (fy - 14) + 'px, 0)';
        
        // Stop animation when close enough
        if (Math.abs(dx) < 0.1 && Math.abs(dy) < 0.1) {
            isMoving = false;
            return;
        }
        
        rafId = requestAnimationFrame(animate);
    }
    
    // Hide cursor when leaving window
    document.addEventListener('mouseleave', function() {
        cursor.style.opacity = '0';
        follower.style.opacity = '0';
    });
    
    document.addEventListener('mouseenter', function() {
        cursor.style.opacity = '1';
        follower.style.opacity = '1';
    });
})();

// Logo click to home
(function() {
    var logo = document.querySelector('.logo');
    if (!logo) return;
    logo.addEventListener('click', function() {
        document.getElementById('home').scrollIntoView({ behavior: 'smooth' });
    });
    logo.style.cursor = 'pointer';
})();

// Nav scroll effect
(function() {
    var nav = document.getElementById('nav');
    if (!nav) return;
    function onScroll() { if (window.scrollY > 8) { nav.classList.add('scrolled'); } else { nav.classList.remove('scrolled'); } document.documentElement.style.setProperty('--navH', nav.offsetHeight + 'px'); }
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
})();

// Enhanced Experience Section Scrolling
(function() {
    function initExperienceScrolling() {
        var experienceContainer = document.querySelector('.experience-container');
        if (!experienceContainer) return;
        
        // Add smooth scrolling behavior
        experienceContainer.style.scrollBehavior = 'smooth';
        
        // Add keyboard navigation
        experienceContainer.addEventListener('keydown', function(e) {
            if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
                e.preventDefault();
                var scrollAmount = 100;
                if (e.key === 'ArrowUp') scrollAmount = -scrollAmount;
                experienceContainer.scrollBy(0, scrollAmount);
            }
        });
        
        // Add mouse wheel smooth scrolling
        experienceContainer.addEventListener('wheel', function(e) {
            e.preventDefault();
            var scrollAmount = e.deltaY * 0.5; // Reduce scroll speed
            experienceContainer.scrollBy(0, scrollAmount);
        }, { passive: false });
        
        // Add touch support for mobile
        var startY = 0;
        experienceContainer.addEventListener('touchstart', function(e) {
            startY = e.touches[0].clientY;
        }, { passive: true });
        
        experienceContainer.addEventListener('touchmove', function(e) {
            e.preventDefault();
            var currentY = e.touches[0].clientY;
            var diffY = startY - currentY;
            experienceContainer.scrollBy(0, diffY * 0.5);
            startY = currentY;
        }, { passive: false });
    }
    
    // Initialize experience scrolling when experience slide is active
    function checkExperienceSlide() {
        var experienceSlide = document.getElementById('experience');
        if (experienceSlide && experienceSlide.classList.contains('active')) {
            initExperienceScrolling();
        }
    }
    
    // Monitor slide changes by observing the slides wrapper transform
    var slidesWrapper = document.querySelector('.slides-wrapper');
    if (slidesWrapper) {
        var observer = new MutationObserver(function(mutations) {
            mutations.forEach(function(mutation) {
                if (mutation.type === 'attributes' && mutation.attributeName === 'style') {
                    setTimeout(checkExperienceSlide, 100);
                }
            });
        });
        
        observer.observe(slidesWrapper, {
            attributes: true,
            attributeFilter: ['style']
        });
    }
    
    // Also check when indicators are clicked
    var indicators = document.querySelectorAll('.indicator');
    indicators.forEach(function(indicator) {
        indicator.addEventListener('click', function() {
            setTimeout(checkExperienceSlide, 200);
        });
    });
    
    // Initial check
    setTimeout(checkExperienceSlide, 500);
})();

// Mobile menu toggle
(function() {
    var btn = document.querySelector('.mobile-menu');
    var links = document.querySelector('.nav-links');
    if (!btn || !links) return;
    
    btn.addEventListener('click', function() {
        var isOpen = links.classList.toggle('open');
        btn.setAttribute('aria-expanded', String(isOpen));
        // lock scroll when menu open
        document.body.classList.toggle('menu-open', isOpen);
        
        // Add mobile menu animation
        if (isOpen) {
            btn.style.transform = 'rotate(90deg)';
        } else {
            btn.style.transform = 'rotate(0deg)';
        }
    });
    
    function closeMenu() {
        links.classList.remove('open');
        btn.setAttribute('aria-expanded', 'false');
        document.body.classList.remove('menu-open');
        btn.style.transform = 'rotate(0deg)';
    }
    
    links.querySelectorAll('a').forEach(function(a) { 
        a.addEventListener('click', closeMenu); 
    });
    
    // close on ESC
    document.addEventListener('keydown', function(e){ 
        if (e.key === 'Escape') closeMenu(); 
    });
    
    // close on resize to desktop
    window.addEventListener('resize', function(){ 
        if (window.innerWidth > 768) closeMenu(); 
    });
    
    // Close menu when clicking outside
    document.addEventListener('click', function(e) {
        if (!btn.contains(e.target) && !links.contains(e.target) && links.classList.contains('open')) {
            closeMenu();
        }
    });
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
        var [expRes, projRes, skillsRes, profileRes] = await Promise.all([
            fetch('data/experience.json', { cache: 'no-cache' }),
            fetch('data/projects.json', { cache: 'no-cache' }),
            fetch('data/skills.json', { cache: 'no-cache' }),
            fetch('data/profile.json', { cache: 'no-cache' })
        ]);
        var exp = await expRes.json();
        var projects = await projRes.json();
        var skills = await skillsRes.json();
        var profile = await profileRes.json();

        var expContainer = document.querySelector('#experience .timeline');
        if (expContainer) {
            expContainer.innerHTML = exp.map(function(job){
                var points = job.points.map(function(p){ return '<li>' + p + '</li>'; }).join('');
                return '\n<div class="timeline-item">\n  <div class="timeline-bullet" aria-hidden="true"></div>\n  <div class="job-card">\n    <div class="job-title">' + job.title + '</div>\n    <div class="company-role">' + job.company + '</div>\n    <div class="job-meta">' + job.period + ' • ' + job.location + '</div>\n    <ul class="job-points">' + points + '</ul>\n  </div>\n</div>';
            }).join('');
        }

        var projContainer = document.querySelector('#projects-container');
        if (projContainer) {
            projContainer.innerHTML = projects.map(function(p, index){
                // Determine project category based on tags
                var category = 'Web Application';
                var categoryIcon = '🌐';
                if (p.tags.some(function(tag) { return ['Flutter', 'React Native', 'Expo', 'Android'].includes(tag); })) {
                    category = 'Mobile Application';
                    categoryIcon = '📱';
                } else if (p.tags.some(function(tag) { return ['Laravel', 'Filament v3'].includes(tag); })) {
                    category = 'Web Application';
                    categoryIcon = '🌐';
                }
                
                // Generate tech groups based on tags
                var techGroups = '';
                var frontendTags = p.tags.filter(function(tag) { 
                    return ['Flutter', 'React Native', 'Expo', 'Vue.js', 'JavaScript', 'React', 'Next.js', 'Tailwind CSS'].includes(tag); 
                });
                var backendTags = p.tags.filter(function(tag) { 
                    return ['Laravel', 'PHP', 'MySQL', 'REST API', 'Filament v3'].includes(tag); 
                });
                var otherTags = p.tags.filter(function(tag) { 
                    return !frontendTags.includes(tag) && !backendTags.includes(tag); 
                });
                
                if (frontendTags.length > 0) {
                    techGroups += '<div class="tech-group"><span class="tech-label">Frontend</span><div class="tech-tags">';
                    frontendTags.forEach(function(tag) {
                        var tagClass = tag.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
                        techGroups += '<span class="tech-tag ' + tagClass + '">' + tag + '</span>';
                    });
                    techGroups += '</div></div>';
                }
                
                if (backendTags.length > 0) {
                    techGroups += '<div class="tech-group"><span class="tech-label">Backend</span><div class="tech-tags">';
                    backendTags.forEach(function(tag) {
                        var tagClass = tag.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
                        techGroups += '<span class="tech-tag ' + tagClass + '">' + tag + '</span>';
                    });
                    techGroups += '</div></div>';
                }
                
                if (otherTags.length > 0) {
                    techGroups += '<div class="tech-group"><span class="tech-label">Other</span><div class="tech-tags">';
                    otherTags.forEach(function(tag) {
                        var tagClass = tag.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
                        techGroups += '<span class="tech-tag ' + tagClass + '">' + tag + '</span>';
                    });
                    techGroups += '</div></div>';
                }
                
                // Generate features based on project type
                var features = '';
                if (p.name.toLowerCase().includes('investment')) {
                    features = '<div class="feature-item"><span class="feature-icon">⚡</span><span>Real-time Pricing</span></div><div class="feature-item"><span class="feature-icon">🔒</span><span>Secure Transactions</span></div><div class="feature-item"><span class="feature-icon">📊</span><span>Portfolio Analytics</span></div>';
                } else if (p.name.toLowerCase().includes('attendance')) {
                    features = '<div class="feature-item"><span class="feature-icon">📱</span><span>QR Code Scanning</span></div><div class="feature-item"><span class="feature-icon">📍</span><span>Geolocation</span></div><div class="feature-item"><span class="feature-icon">📊</span><span>Analytics Dashboard</span></div>';
                } else if (p.name.toLowerCase().includes('booking')) {
                    features = '<div class="feature-item"><span class="feature-icon">📅</span><span>Real-time Booking</span></div><div class="feature-item"><span class="feature-icon">💳</span><span>Payment Integration</span></div><div class="feature-item"><span class="feature-icon">📊</span><span>Admin Dashboard</span></div>';
                } else if (p.name.toLowerCase().includes('e-commerce')) {
                    features = '<div class="feature-item"><span class="feature-icon">🛒</span><span>Shopping Cart</span></div><div class="feature-item"><span class="feature-icon">💳</span><span>Payment Gateway</span></div><div class="feature-item"><span class="feature-icon">📱</span><span>WhatsApp Integration</span></div>';
                } else if (p.name.toLowerCase().includes('cooperative')) {
                    features = '<div class="feature-item"><span class="feature-icon">📈</span><span>Real-time Analytics</span></div><div class="feature-item"><span class="feature-icon">📋</span><span>Automated Reporting</span></div><div class="feature-item"><span class="feature-icon">👥</span><span>User Management</span></div>';
                } else {
                    features = '<div class="feature-item"><span class="feature-icon">⚡</span><span>Modern Design</span></div><div class="feature-item"><span class="feature-icon">📱</span><span>Responsive</span></div><div class="feature-item"><span class="feature-icon">🔧</span><span>Customizable</span></div>';
                }
                
                var linkButton = p.link ? '<a href="' + p.link + '" target="_blank" rel="noopener" class="btn-primary"><span>View Project</span><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M7 17L17 7M17 7H7M17 7V17"/></svg></a>' : '<a href="#" class="btn-primary"><span>View Project</span><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M7 17L17 7M17 7H7M17 7V17"/></svg></a>';
                
                return '<div class="project-card" style="--scroll-delay: ' + (index * 2) + 's">' +
                    '<div class="project-image">' +
                        '<div class="project-icon">' + (p.emoji || '💻') + '</div>' +
                        '<div class="project-overlay">' +
                            '<div class="project-links-overlay">' +
                                '<a href="#" class="overlay-link" title="View Project">' +
                                    '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">' +
                                        '<path d="M7 17L17 7M17 7H7M17 7V17"/>' +
                                    '</svg>' +
                                '</a>' +
                            '</div>' +
                        '</div>' +
                        '<div class="project-gradient"></div>' +
                    '</div>' +
                    '<div class="project-content">' +
                        '<div class="project-meta">' +
                            '<div class="project-category">' +
                                '<span class="category-icon">' + categoryIcon + '</span>' +
                                '<span>' + category + '</span>' +
                            '</div>' +
                            '<div class="project-year">2024</div>' +
                        '</div>' +
                        '<h3 class="project-title">' + p.name + '</h3>' +
                        '<div class="project-features">' + features + '</div>' +
                        '<div class="project-tech"><div class="tech-content">' + techGroups + '</div></div>' +
                        '<div class="project-actions">' + linkButton + '</div>' +
                    '</div>' +
                '</div>';
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
        
        // Animate counters
        animateCounter('.stat-number[data-key="projects"]', projectsCount, '+');
        animateCounter('.stat-number[data-key="years"]', years, '+');
        animateCounter('.stat-number[data-key="technologies"]', 15, '+');

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
        // Stats from profile (only override when valid numbers are provided)
        if (profile && profile.stats) {
            var projectEl = document.querySelector('.stat-number[data-key="projects"]');
            var yearsEl = document.querySelector('.stat-number[data-key="years"]');
            var profileProjects = profile.stats.projects;
            var profileYears = profile.stats.years;
            var isValidProjects = typeof profileProjects === 'number' && isFinite(profileProjects);
            var isValidYears = typeof profileYears === 'number' && isFinite(profileYears);
            if (projectEl && isValidProjects) projectEl.textContent = String(profileProjects) + '+';
            if (yearsEl && isValidYears) yearsEl.textContent = String(profileYears) + '+';
        }
    } catch (e) {
        console.error('Failed to load data', e);
        // If opened via file://, guide the user to run a local server
        if (location.protocol === 'file:') {
            var note = document.createElement('div');
            note.textContent = 'For local preview, please run a local server (e.g. npm i -g serve; serve .) to allow loading JSON files.';
            note.style.position = 'fixed';
            note.style.left = '0';
            note.style.right = '0';
            note.style.bottom = '0';
            note.style.padding = '12px 16px';
            note.style.background = 'rgba(0,0,0,0.85)';
            note.style.color = '#fff';
            note.style.fontSize = '14px';
            note.style.textAlign = 'center';
            note.style.zIndex = '2000';
            document.body.appendChild(note);
        }
    }
}

// Animated Counter Function
function animateCounter(selector, targetValue, suffix) {
    var element = document.querySelector(selector);
    if (!element) return;
    
    var startValue = 0;
    var duration = 2000; // 2 seconds
    var startTime = null;
    
    function updateCounter(currentTime) {
        if (startTime === null) startTime = currentTime;
        var progress = Math.min((currentTime - startTime) / duration, 1);
        
        var currentValue = Math.floor(progress * targetValue);
        element.textContent = currentValue + suffix;
        
        if (progress < 1) {
            requestAnimationFrame(updateCounter);
        }
    }
    
    requestAnimationFrame(updateCounter);
}

document.addEventListener('DOMContentLoaded', renderData);

// Mobile-specific enhancements
(function() {
    // Detect mobile device
    var isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    
    if (isMobile) {
        document.body.classList.add('mobile-device');
        
        // Add mobile-specific loading indicator
        var mobileLoader = document.createElement('div');
        mobileLoader.className = 'loading-mobile';
        mobileLoader.innerHTML = '<div class="loading-mobile-spinner"></div>';
        document.body.appendChild(mobileLoader);
        
        // Show loader during slide transitions
        var originalGoToSlide = window.goToSlide;
        if (originalGoToSlide) {
            window.goToSlide = function(slideIndex) {
                mobileLoader.classList.add('active');
                originalGoToSlide(slideIndex);
                setTimeout(function() {
                    mobileLoader.classList.remove('active');
                }, 800);
            };
        }
        
        // Add mobile-specific touch feedback
        document.addEventListener('touchstart', function(e) {
            var target = e.target;
            if (target.matches('button, .btn, .contact-button, .indicator, .nav-link')) {
                target.style.transform = 'scale(0.95)';
                target.style.transition = 'transform 0.1s ease';
            }
        }, { passive: true });
        
        document.addEventListener('touchend', function(e) {
            var target = e.target;
            if (target.matches('button, .btn, .contact-button, .indicator, .nav-link')) {
                setTimeout(function() {
                    target.style.transform = '';
                    target.style.transition = '';
                }, 100);
            }
        }, { passive: true });
        
        // Optimize animations for mobile
        var style = document.createElement('style');
        style.textContent = `
            @media (max-width: 768px) {
                .slide-container {
                    -webkit-overflow-scrolling: touch;
                }
                
                .slide-content {
                    -webkit-overflow-scrolling: touch;
                }
                
                .projects-scroll {
                    -webkit-overflow-scrolling: touch;
                }
                
                .experience-container {
                    -webkit-overflow-scrolling: touch;
                }
                
                .contact-container {
                    -webkit-overflow-scrolling: touch;
                }
            }
        `;
        document.head.appendChild(style);
        
        // Add mobile-specific viewport handling
        var viewport = document.querySelector('meta[name="viewport"]');
        if (viewport) {
            viewport.setAttribute('content', 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no');
        }
        
        // Add mobile-specific performance optimizations
        var slides = document.querySelectorAll('.slide');
        slides.forEach(function(slide) {
            slide.style.willChange = 'transform, opacity';
        });
        
        // Add mobile-specific error handling
        window.addEventListener('error', function(e) {
            console.log('Mobile error:', e.error);
            // Hide any loading indicators on error
            var loader = document.querySelector('.loading-mobile');
            if (loader) {
                loader.classList.remove('active');
            }
        });
        
        // Add mobile-specific orientation change handling
        window.addEventListener('orientationchange', function() {
            setTimeout(function() {
                // Recalculate slide positions after orientation change
                var slidesWrapper = document.querySelector('.slides-wrapper');
                if (slidesWrapper) {
                    var currentSlide = document.querySelector('.slide.active');
                    if (currentSlide) {
                        var slideIndex = Array.from(slides).indexOf(currentSlide);
                        var translateX = -slideIndex * 16.666;
                        slidesWrapper.style.transform = 'translateX(' + translateX + '%)';
                    }
                }
            }, 100);
        });
    }
})();

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



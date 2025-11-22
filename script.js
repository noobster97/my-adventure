// --- Spotlight Effect ---
const spotlightCards = document.querySelectorAll('.spotlight-card');
document.addEventListener('mousemove', (e) => {
    spotlightCards.forEach(card => {
        const rect = card.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        card.style.setProperty('--mouse-x', `${x}px`);
        card.style.setProperty('--mouse-y', `${y}px`);
    });
});

// --- Stack of Cards Logic (Top Peeking & 3D Tilt & Sketchbook Rotation) ---
const stackCards = document.querySelectorAll('.project-card-stack');

function reorderStack() {
    const activeCard = document.querySelector('.project-card-stack.active');
    if (!activeCard) return;

    const activeIndex = parseInt(activeCard.dataset.index);
    const totalCards = stackCards.length;

    stackCards.forEach((card) => {
        const index = parseInt(card.dataset.index);

        // Calculate distance from active card
        let distance = index - activeIndex;
        if (distance < 0) distance += totalCards;

        // 0 is active
        // 1 is immediately behind
        // 2 is further behind

        if (distance === 0) {
            // Active Card
            card.style.transform = `translateY(0) scale(1) rotate(0deg)`;
            card.style.zIndex = 10;
            card.style.opacity = 1;
            card.classList.remove('stacked');

            // Enable 3D Tilt for active card
            card.addEventListener('mousemove', handleTilt);
            card.addEventListener('mouseleave', resetTilt);
        } else {
            // Background Cards - Peeking from TOP (Negative Y)
            const translateY = -40 * distance;
            const scale = 1 - (0.02 * distance);
            const zIndex = 10 - distance;

            // Random rotation for messy stack look (deterministic based on index)
            const randomRotate = (index % 2 === 0 ? 2 : -2) * distance;

            card.style.transform = `translateY(${translateY}px) scale(${scale}) rotate(${randomRotate}deg)`;
            card.style.zIndex = zIndex;
            card.classList.add('stacked');

            // Disable tilt for background cards
            card.removeEventListener('mousemove', handleTilt);
            card.removeEventListener('mouseleave', resetTilt);
            // Reset any tilt transform if it was active
            // Note: The main transform above handles the reset because it overwrites the style
        }
    });
}

// 3D Tilt Logic
function handleTilt(e) {
    const card = this;
    const rect = card.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const centerX = rect.width / 2;
    const centerY = rect.height / 2;

    const rotateX = ((y - centerY) / centerY) * -5; // Reduced tilt for sketch feel
    const rotateY = ((x - centerX) / centerX) * 5;

    card.style.transform = `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) scale(1.01)`;
}

function resetTilt() {
    this.style.transform = `perspective(1000px) rotateX(0) rotateY(0) scale(1) rotate(0deg)`;
}

// Click to bring to front
stackCards.forEach((card) => {
    card.addEventListener('click', () => {
        // Remove active from all
        stackCards.forEach(c => c.classList.remove('active'));
        // Add active to clicked
        card.classList.add('active');
        reorderStack();
    });
});

// Initialize Stack
if (stackCards.length > 0) {
    reorderStack();
}

// --- Navbar Scroll Effect ---
const navbar = document.querySelector('.navbar');
if (navbar) {
    window.addEventListener('scroll', () => {
        if (window.scrollY > 50) {
            navbar.style.background = 'rgba(253, 251, 247, 0.98)';
            navbar.style.boxShadow = '0 4px 0px rgba(0,0,0,0.1)';
        } else {
            navbar.style.background = 'rgba(253, 251, 247, 0.95)';
            navbar.style.boxShadow = 'none';
        }
    });
}

// --- Smooth Scrolling ---
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
        e.preventDefault();
        const target = document.querySelector(this.getAttribute('href'));
        if (target) {
            target.scrollIntoView({
                behavior: 'smooth'
            });
        }
    });
});

// --- Reveal Animations ---
const revealElements = document.querySelectorAll('.section-title, .bento-card, .project-card-stack, .skill-pill, .hero-content > *, .cta-box');

const revealObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            entry.target.style.opacity = '1';
            entry.target.style.transform = 'translateY(0)';
            revealObserver.unobserve(entry.target);
        }
    });
}, {
    threshold: 0.1
});

revealElements.forEach((el, index) => {
    el.style.opacity = '0';
    el.style.transform = 'translateY(30px)';
    el.style.transition = 'all 0.6s ease-out';
    revealObserver.observe(el);
});

// --- Mobile Bottom Nav Active State ---
const sections = document.querySelectorAll('section');
const navItems = document.querySelectorAll('.bottom-nav .nav-item');

window.addEventListener('scroll', () => {
    let current = '';
    sections.forEach(section => {
        const sectionTop = section.offsetTop;
        const sectionHeight = section.clientHeight;
        if (scrollY >= (sectionTop - sectionHeight / 3)) {
            current = section.getAttribute('id');
        }
    });

    navItems.forEach(item => {
        item.classList.remove('active');
        if (item.getAttribute('href').includes(current)) {
            item.classList.add('active');
        }
    });
});

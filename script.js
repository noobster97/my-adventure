// --- Typing Animation ---
const textPart1 = "Turning Ideas into ";
const textPart2 = "Digital Reality";
const typingElement = document.getElementById("typing-text");
const typingDelay = 100;
let charIndex = 0;
let isPart1Done = false;

function typeWriter() {
    if (!typingElement) return;

    if (!isPart1Done) {
        if (charIndex < textPart1.length) {
            typingElement.innerHTML += textPart1.charAt(charIndex);
            charIndex++;
            setTimeout(typeWriter, typingDelay);
        } else {
            isPart1Done = true;
            charIndex = 0;
            typingElement.innerHTML += "<br><span class='gradient-text' id='gradient-part'></span>";
            setTimeout(typeWriter, typingDelay);
        }
    } else {
        const gradientPart = document.getElementById('gradient-part');
        if (gradientPart && charIndex < textPart2.length) {
            gradientPart.innerHTML += textPart2.charAt(charIndex);
            charIndex++;
            setTimeout(typeWriter, typingDelay);
        }
    }
}

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

// Initialize Typing Animation
document.addEventListener("DOMContentLoaded", () => {
    setTimeout(typeWriter, 500);
    initImageCarousel();
    initImageModal();
});

// --- Image Carousel Functionality ---
function initImageCarousel() {
    const carousels = document.querySelectorAll('.project-visual-carousel');
    
    carousels.forEach(carousel => {
        const slides = carousel.querySelectorAll('.carousel-slide');
        const prevBtn = carousel.querySelector('.carousel-prev');
        const nextBtn = carousel.querySelector('.carousel-next');
        const indicators = carousel.querySelectorAll('.carousel-indicators .indicator');
        let currentSlide = 0;

        function showSlide(index) {
            slides.forEach((slide, i) => {
                slide.classList.toggle('active', i === index);
            });
            indicators.forEach((indicator, i) => {
                indicator.classList.toggle('active', i === index);
            });
            currentSlide = index;
        }

        function nextSlide() {
            const next = (currentSlide + 1) % slides.length;
            showSlide(next);
        }

        function prevSlide() {
            const prev = (currentSlide - 1 + slides.length) % slides.length;
            showSlide(prev);
        }

        if (nextBtn) nextBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            nextSlide();
        });

        if (prevBtn) prevBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            prevSlide();
        });

        indicators.forEach((indicator, index) => {
            indicator.addEventListener('click', (e) => {
                e.stopPropagation();
                showSlide(index);
            });
        });

        // Auto-play (optional - can be removed if not needed)
        // setInterval(nextSlide, 5000);

        // Click on carousel to open modal
        carousel.addEventListener('click', (e) => {
            if (!e.target.closest('.carousel-btn') && !e.target.closest('.carousel-indicators')) {
                openModal(carousel, currentSlide);
            }
        });

        // Touch/swipe support for mobile
        let touchStartX = 0;
        let touchEndX = 0;

        carousel.addEventListener('touchstart', (e) => {
            touchStartX = e.changedTouches[0].screenX;
        }, { passive: true });

        carousel.addEventListener('touchend', (e) => {
            touchEndX = e.changedTouches[0].screenX;
            handleSwipe();
        }, { passive: true });

        function handleSwipe() {
            const swipeThreshold = 50;
            const diff = touchStartX - touchEndX;
            
            if (Math.abs(diff) > swipeThreshold) {
                if (diff > 0) {
                    nextSlide(); // Swipe left - next
                } else {
                    prevSlide(); // Swipe right - previous
                }
            }
        }
    });
}

// --- Image Modal Functionality ---
function initImageModal() {
    const modal = document.getElementById('imageModal');
    const modalImage = document.getElementById('modalImage');
    const modalCaption = document.getElementById('modalCaption');
    const modalClose = modal.querySelector('.modal-close');
    const modalPrev = modal.querySelector('.modal-prev');
    const modalNext = modal.querySelector('.modal-next');
    const modalIndicators = document.getElementById('modalIndicators');

    let currentImages = [];
    let currentIndex = 0;

    function openModal(carousel, startIndex = 0) {
        const slides = carousel.querySelectorAll('.carousel-slide img');
        currentImages = Array.from(slides).map(slide => ({
            src: slide.src,
            alt: slide.alt,
            label: slide.closest('.carousel-slide').querySelector('.image-label')?.textContent || ''
        }));
        currentIndex = startIndex;
        updateModal();
        modal.classList.add('active');
        document.body.style.overflow = 'hidden';
    }

    function closeModal() {
        modal.classList.remove('active');
        document.body.style.overflow = '';
    }

    function updateModal() {
        if (currentImages.length === 0) return;
        
        const current = currentImages[currentIndex];
        modalImage.src = current.src;
        modalImage.alt = current.alt;
        modalCaption.textContent = current.label;

        // Update indicators
        modalIndicators.innerHTML = '';
        currentImages.forEach((_, index) => {
            const indicator = document.createElement('span');
            indicator.className = `indicator ${index === currentIndex ? 'active' : ''}`;
            indicator.addEventListener('click', () => {
                currentIndex = index;
                updateModal();
            });
            modalIndicators.appendChild(indicator);
        });
    }

    function nextImage() {
        currentIndex = (currentIndex + 1) % currentImages.length;
        updateModal();
    }

    function prevImage() {
        currentIndex = (currentIndex - 1 + currentImages.length) % currentImages.length;
        updateModal();
    }

    if (modalClose) modalClose.addEventListener('click', closeModal);
    if (modalPrev) modalPrev.addEventListener('click', prevImage);
    if (modalNext) modalNext.addEventListener('click', nextImage);

    modal.querySelector('.modal-overlay').addEventListener('click', closeModal);

    // Keyboard navigation
    document.addEventListener('keydown', (e) => {
        if (!modal.classList.contains('active')) return;
        
        if (e.key === 'Escape') closeModal();
        if (e.key === 'ArrowLeft') prevImage();
        if (e.key === 'ArrowRight') nextImage();
    });

    // Make openModal available globally
    window.openModal = openModal;
}

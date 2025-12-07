// ================= INITIALIZE ON PAGE LOAD =================
document.addEventListener('DOMContentLoaded', () => {
  // Initialize AOS animations
  if (typeof AOS !== 'undefined') {
    AOS.init({
      duration: 1000,
      once: true,
      offset: 100,
      easing: 'ease-out-cubic'
    });
  }

  // Initialize all features
  initializeAuth();
  initializeNavbar();
  initializeCounters();
  initializeBackToTop();
  initializeMobileMenu();
  initializeSmoothScroll();
  initializeParallax();
});

// ================= FIREBASE AUTHENTICATION =================
function initializeAuth() {
  firebase.auth().onAuthStateChanged((user) => {
    if (!user) {
      // No user is signed in, redirect to login
      window.location.href = './auth/login.html';
    } else {
      // User is signed in
      console.log('User logged in:', user.email);

      // Display user email
      const userEmailElement = document.getElementById('userEmail');
      if (userEmailElement && user.email) {
        userEmailElement.textContent = user.email;
      }

      // Setup logout button
      const logoutBtn = document.getElementById('logoutBtn');
      if (logoutBtn) {
        logoutBtn.addEventListener('click', async () => {
          try {
            await firebase.auth().signOut();
            window.location.href = './auth/login.html';
          } catch (error) {
            console.error('Logout error:', error);
            alert('Error logging out. Please try again.');
          }
        });
      }
    }
  });
}

// ================= NAVBAR SCROLL EFFECT =================
function initializeNavbar() {
  const navbar = document.getElementById('navbar');
  let lastScroll = 0;

  window.addEventListener('scroll', () => {
    const currentScroll = window.pageYOffset;

    // Add scrolled class when page is scrolled
    if (currentScroll > 50) {
      navbar.classList.add('scrolled');
    } else {
      navbar.classList.remove('scrolled');
    }

    lastScroll = currentScroll;
  });

  // Active navigation link on scroll
  const sections = document.querySelectorAll('section[id]');
  const navLinks = document.querySelectorAll('.nav-link');

  window.addEventListener('scroll', () => {
    let current = '';
    
    sections.forEach(section => {
      const sectionTop = section.offsetTop;
      const sectionHeight = section.clientHeight;
      
      if (window.pageYOffset >= sectionTop - 200) {
        current = section.getAttribute('id');
      }
    });

    navLinks.forEach(link => {
      link.classList.remove('active');
      if (link.getAttribute('href') === `#${current}`) {
        link.classList.add('active');
      }
    });
  });
}

// ================= MOBILE MENU TOGGLE =================
function initializeMobileMenu() {
  const mobileMenuToggle = document.getElementById('mobileMenuToggle');
  const navLinks = document.getElementById('navLinks');

  if (mobileMenuToggle && navLinks) {
    mobileMenuToggle.addEventListener('click', () => {
      navLinks.classList.toggle('active');
      
      // Animate icon
      const icon = mobileMenuToggle.querySelector('i');
      if (navLinks.classList.contains('active')) {
        icon.className = 'fas fa-times';
      } else {
        icon.className = 'fas fa-bars';
      }
    });

    // Close menu when clicking on a link
    const links = navLinks.querySelectorAll('a');
    links.forEach(link => {
      link.addEventListener('click', () => {
        navLinks.classList.remove('active');
        const icon = mobileMenuToggle.querySelector('i');
        icon.className = 'fas fa-bars';
      });
    });
  }
}

// ================= ANIMATED COUNTERS =================
function initializeCounters() {
  const counters = document.querySelectorAll('.counter');
  const speed = 200; // Animation speed
  let hasAnimated = false;

  const animateCounters = () => {
    if (hasAnimated) return;

    const countersSection = document.querySelector('.stats-bar');
    const sectionPosition = countersSection.getBoundingClientRect().top;
    const screenPosition = window.innerHeight / 1.3;

    if (sectionPosition < screenPosition) {
      hasAnimated = true;

      counters.forEach(counter => {
        const target = +counter.getAttribute('data-target');
        const increment = target / speed;

        const updateCount = () => {
          const count = +counter.innerText;

          if (count < target) {
            counter.innerText = Math.ceil(count + increment);
            setTimeout(updateCount, 10);
          } else {
            counter.innerText = target;
          }
        };

        updateCount();
      });
    }
  };

  window.addEventListener('scroll', animateCounters);
  animateCounters(); // Check on page load
}

// ================= BACK TO TOP BUTTON =================
function initializeBackToTop() {
  const backToTopBtn = document.getElementById('backToTop');

  if (backToTopBtn) {
    window.addEventListener('scroll', () => {
      if (window.pageYOffset > 300) {
        backToTopBtn.classList.add('visible');
      } else {
        backToTopBtn.classList.remove('visible');
      }
    });

    backToTopBtn.addEventListener('click', () => {
      window.scrollTo({
        top: 0,
        behavior: 'smooth'
      });
    });
  }
}

// ================= TYPING EFFECT =================
// Removed typing effect as it's not needed

// ================= SMOOTH SCROLL =================
function initializeSmoothScroll() {
  const links = document.querySelectorAll('a[href^="#"]');

  links.forEach(link => {
    link.addEventListener('click', (e) => {
      const href = link.getAttribute('href');
      
      // Skip if it's just "#"
      if (href === '#') {
        e.preventDefault();
        return;
      }

      const target = document.querySelector(href);
      
      if (target) {
        e.preventDefault();
        
        const offsetTop = target.offsetTop - 80; // Account for fixed navbar
        
        window.scrollTo({
          top: offsetTop,
          behavior: 'smooth'
        });
      }
    });
  });
}

// ================= PARALLAX EFFECT =================
function initializeParallax() {
  const parallaxElements = document.querySelectorAll('.floating');

  if (parallaxElements.length > 0) {
    window.addEventListener('scroll', () => {
      const scrolled = window.pageYOffset;

      parallaxElements.forEach((element, index) => {
        const speed = 0.5 + (index * 0.1); // Different speeds for different elements
        const offset = scrolled * speed;
        element.style.transform = `translateY(${offset}px)`;
      });
    });
  }
}

// ================= STAR ANIMATION FOR TESTIMONIALS =================
// Removed star animation as using Font Awesome

// ================= FEATURE CARD TILT EFFECT =================
function initializeCardTilt() {
  const cards = document.querySelectorAll('.feature-card, .testimonial-card');

  cards.forEach(card => {
    card.addEventListener('mousemove', (e) => {
      const rect = card.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      const centerX = rect.width / 2;
      const centerY = rect.height / 2;

      const rotateX = (y - centerY) / 20;
      const rotateY = (centerX - x) / 20;

      card.style.transform = `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) translateY(-12px)`;
    });

    card.addEventListener('mouseleave', () => {
      card.style.transform = 'perspective(1000px) rotateX(0) rotateY(0) translateY(0)';
    });
  });
}

// Initialize card tilt after page loads
window.addEventListener('load', () => {
  initializeCardTilt();
});

// ================= CURSOR GLOW EFFECT =================
function initializeCursorGlow() {
  const cursor = document.createElement('div');
  cursor.className = 'cursor-glow';
  cursor.style.cssText = `
    position: fixed;
    width: 400px;
    height: 400px;
    border-radius: 50%;
    background: radial-gradient(circle, rgba(16, 185, 129, 0.1), transparent);
    pointer-events: none;
    z-index: 9999;
    transform: translate(-50%, -50%);
    transition: opacity 0.3s ease;
    opacity: 0;
  `;
  document.body.appendChild(cursor);

  let mouseX = 0;
  let mouseY = 0;
  let cursorX = 0;
  let cursorY = 0;

  document.addEventListener('mousemove', (e) => {
    mouseX = e.clientX;
    mouseY = e.clientY;
    cursor.style.opacity = '1';
  });

  document.addEventListener('mouseleave', () => {
    cursor.style.opacity = '0';
  });

  function animate() {
    const dx = mouseX - cursorX;
    const dy = mouseY - cursorY;

    cursorX += dx * 0.1;
    cursorY += dy * 0.1;

    cursor.style.left = cursorX + 'px';
    cursor.style.top = cursorY + 'px';

    requestAnimationFrame(animate);
  }

  animate();
}

// Initialize cursor glow on desktop only
if (window.innerWidth > 768) {
  initializeCursorGlow();
}

// ================= INTERSECTION OBSERVER FOR ANIMATIONS =================
function initializeIntersectionObserver() {
  const observerOptions = {
    threshold: 0.1,
    rootMargin: '0px 0px -100px 0px'
  };

  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('animate-in');
      }
    });
  }, observerOptions);

  // Observe elements that should animate
  const animateElements = document.querySelectorAll('.feature-card, .step-card, .stat-item');
  animateElements.forEach(el => observer.observe(el));
}

// Initialize intersection observer
initializeIntersectionObserver();

// ================= LOADING ANIMATION =================
window.addEventListener('load', () => {
  // Add loaded class to body
  document.body.classList.add('loaded');

  // Refresh AOS
  if (typeof AOS !== 'undefined') {
    AOS.refresh();
  }
});

// ================= PRELOAD CRITICAL IMAGES =================
function preloadImages() {
  const images = [
    './images/wheat.jpg',
    './images/AgriSenseLogo.png'
  ];

  images.forEach(src => {
    const img = new Image();
    img.src = src;
  });
}

preloadImages();

// ================= PERFORMANCE OPTIMIZATION =================
// Debounce function for scroll events
function debounce(func, wait = 10, immediate = true) {
  let timeout;
  return function executedFunction() {
    const context = this;
    const args = arguments;
    const later = function() {
      timeout = null;
      if (!immediate) func.apply(context, args);
    };
    const callNow = immediate && !timeout;
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
    if (callNow) func.apply(context, args);
  };
}

// Optimize scroll event listeners
const optimizedScroll = debounce(() => {
  // Any scroll-based animations here
}, 10);

window.addEventListener('scroll', optimizedScroll);

// ================= ERROR HANDLING =================
window.addEventListener('error', (e) => {
  console.error('An error occurred:', e.error);
});

// Handle unhandled promise rejections
window.addEventListener('unhandledrejection', (e) => {
  console.error('Unhandled promise rejection:', e.reason);
});
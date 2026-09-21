// KPR Crackers - Storefront Logic (app.js)

// Force Load Font Awesome 6 CDN dynamically if missing
(function loadFontAwesome() {
  if (document.getElementById('font-awesome-cdn')) return;
  // Skip when a static <link> for Font Awesome is already present in <head>.
  if (document.querySelector('link[href*="font-awesome"]')) return;
  const link = document.createElement('link');
  link.id = 'font-awesome-cdn';
  link.rel = 'stylesheet';
  link.href = 'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css';
  link.crossOrigin = 'anonymous';
  link.referrerPolicy = 'no-referrer';
  document.head.appendChild(link);
  console.log("Font Awesome forced loaded successfully.");
})();

// Global State variables
let cart = [];

// Own the scroll position explicitly (ScrollToTop equivalent): the browser
// must never race our own placement on refresh, and deferred re-renders must
// never move the page (see forceRevealEvents / no scrollTo in dashboard paint).
if (typeof window !== 'undefined' && 'scrollRestoration' in window.history) {
  try { window.history.scrollRestoration = 'manual'; } catch (e) {}
}
let activeCategory = 'all';
let currentSlide = 0;
let carouselInterval = null;
let selectedState = '';
let CURRENT_MIN_LIMIT = 3000; // Default minimum order value
let MINIMUM_ORDER_VALUE = 3000; // Default fallback for Tamil Nadu / initial load

/**
 * Get the current minimum order limit based on selected state.
 * @returns {number} - The minimum order value
 */
function getCurrentMinLimit() {
  if (selectedState && typeof getStateMinimumOrder === 'function') {
    return getStateMinimumOrder(selectedState);
  }
  return CURRENT_MIN_LIMIT; // Return default if no state selected or function unavailable
}

/**
 * Handle state selection change in cart drawer.
 * Dynamically updates the validation limit based on selected state.
 * @param {string} state - The selected state name
 */
function onStateChange(state) {
  selectedState = state;
  
  // Fetch the minimum order value for the selected state
  const newStateMinValue = getStateMinimumOrder(state);
  
  if (typeof loadStateMinimumRulesFromFirestore === 'function') {
    loadStateMinimumRulesFromFirestore()
      .then(() => {
        CURRENT_MIN_LIMIT = getStateMinimumOrder(state);
        MINIMUM_ORDER_VALUE = CURRENT_MIN_LIMIT;
        console.log('[State] Selected state:', state, 'Min limit:', CURRENT_MIN_LIMIT);
        // Update cart UI and Order Summary AFTER state value is updated
        updateCartUI();
        if (typeof populateOrderSummaryFromCart === 'function') {
          populateOrderSummaryFromCart();
        }
      })
      .catch(() => {
        CURRENT_MIN_LIMIT = newStateMinValue;
        MINIMUM_ORDER_VALUE = CURRENT_MIN_LIMIT;
        // Update cart UI and Order Summary AFTER state value is updated
        updateCartUI();
        if (typeof populateOrderSummaryFromCart === 'function') {
          populateOrderSummaryFromCart();
        }
      });
  } else {
    CURRENT_MIN_LIMIT = newStateMinValue;
    MINIMUM_ORDER_VALUE = CURRENT_MIN_LIMIT;
    // Update cart UI and Order Summary
    updateCartUI();
    if (typeof populateOrderSummaryFromCart === 'function') {
      populateOrderSummaryFromCart();
    }
  }
}

/**
 * Populate the state dropdown from Firestore data.
 * Clears existing options and dynamically adds states from the database.
 * Tamil Nadu is ALWAYS sorted to the top (index 0) regardless of alphabetical order.
 */
function populateStateDropdown() {
  const stateDropdown = document.getElementById('enquiry-state');
  // Dropdown only exists on pages with the enquiry form — return quietly elsewhere.
  if (!stateDropdown) return;

  // Clear static placeholders
  stateDropdown.innerHTML = '';

  // First, populate with default Tamil Nadu while we fetch from Firestore
  const rules = getStateMinimumRules();
  // Sort: Tamil Nadu first, then alphabetically by state name
  const sortedRules = [...rules].sort((a, b) => {
    if (a.state === 'Tamil Nadu') return -1;
    if (b.state === 'Tamil Nadu') return 1;
    return a.state.localeCompare(b.state);
  });
  sortedRules.forEach(rule => {
    const option = document.createElement('option');
    option.value = rule.state;
    option.textContent = `${rule.state} (Min. ₹${Number(rule.minimumOrder).toLocaleString('en-IN')})`;
    stateDropdown.appendChild(option);
  });

  // Then try to fetch from Firestore and update
  if (typeof loadStateMinimumRulesFromFirestore === 'function') {
    loadStateMinimumRulesFromFirestore()
      .then(firestoreRules => {
        if (firestoreRules && firestoreRules.length > 0) {
          // Clear and repopulate with live Firestore data
          stateDropdown.innerHTML = '';
          // Sort: Tamil Nadu first, then alphabetically by state name
          const sortedFirestoreRules = [...firestoreRules].sort((a, b) => {
            if (a.state === 'Tamil Nadu') return -1;
            if (b.state === 'Tamil Nadu') return 1;
            return a.state.localeCompare(b.state);
          });
          sortedFirestoreRules.forEach(rule => {
            const option = document.createElement('option');
            option.value = rule.state;
            option.textContent = `${rule.state} (Min. ₹${Number(rule.minimumOrder).toLocaleString('en-IN')})`;
            stateDropdown.appendChild(option);
          });
          console.log('[State] Dropdown populated with', firestoreRules.length, 'states from Firestore.');
          
          // Set Tamil Nadu as default selected if it exists
          const tamilOption = Array.from(stateDropdown.options).find(opt => opt.value === 'Tamil Nadu');
          if (tamilOption) tamilOption.selected = true;
        }
      })
      .catch(err => {
        console.warn('[State] Could not fetch from Firestore, using cached/default rules:', err);
      });
  }
}

/**
 * Initialize state rules on page load.
 */
function initStateRules() {
  populateStateDropdown();
}

// CRITICAL: Render categories IMMEDIATELY when script loads (before DOMContentLoaded)
// This ensures categories are never blank, even if other code fails
console.log('[Categories] Script loaded. Attempting immediate render...');
try {
  // Wait for DOM to be ready (document.body exists)
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      console.log('[Categories] DOM ready. Rendering from localStorage/defaults...');
      try {
        renderCategoriesGrid();
        renderFilterButtons();
        console.log('[Categories] ✓ Immediate render complete. Count:', getCategories().length);
      } catch (err) {
        console.error('[Categories] ✗ Immediate render failed:', err);
      }
    });
  } else {
    // DOM already loaded (script loaded defer/async)
    console.log('[Categories] DOM already loaded. Rendering now...');
    renderCategoriesGrid();
    renderFilterButtons();
    console.log('[Categories] ✓ Immediate render complete. Count:', getCategories().length);
  }
} catch (fatalErr) {
  console.error('[Categories] ✗ FATAL error during immediate render:', fatalErr);
}

document.addEventListener('DOMContentLoaded', () => {
  // Lock scroll behind the full-screen preloader as early as possible
  document.body.classList.add('preloader-active');
  
  // Categories already rendered by the immediate render block above (lines 10-35)
  // No need to render again here unless Firestore updates them later
  console.log('[Categories] DOMContentLoaded. Categories already rendered. Count:', getCategories().length);
  
  // Initialize app elements
  initCarousel();
  renderProductsCatalog();

  // Cross-page: apply ?category= filter on the products page after the initial
  // catalog render (e.g. arriving from a category card on Home/Categories).
  if (document.getElementById('products-grid')) {
    const params = new URLSearchParams(window.location.search);
    const categoryParam = params.get('category');
    if (categoryParam) {
      filterByCategory(categoryParam);
    }
  }

  renderMobileSlider();
  renderTestimonialsSlider();
  initContactMap();
  // initPromoCountdown(); // DISABLED: Now handled by Firebase-driven startOfferCountdown()
  initEnquiryForm();
  initWhatsAppWidget();
  initScrollAnimations();
  
  // CRITICAL FIX: Force scroll to top and dispatch synthetic scroll/resize
  // events immediately after animations are initialized. This ensures AOS /
  // IntersectionObserver-animated containers render instantly when navigating
  // to this page via JS view switchers (e.g. clicking "Add to Cart" on the
  // enquiry page) — without this, elements stay at opacity:0 until a manual
  // scroll event fires.
  setTimeout(() => {
    forceRevealScrollReset();
    // Reveal any fade-in-up elements that are ALREADY within the viewport
    revealAllFadeInUp();
  }, 50);
  
  initNavbarScroll();
  loadCartFromStorage();
  // KPR Client Portal: bind Firebase Auth state + the mandatory checkout sign-in
  // guard (must run AFTER the cart is hydrated so a parked checkout can resume).
  initClientPortalAuth();
  initPreloader();
  initNoticeModal();
  setupNoticeTrigger();
  
  // Initialize state dropdown from Firestore on page load
  initStateRules();
  
  // Initialize default state as Tamil Nadu on page load
  // This ensures MINIMUM_ORDER_VALUE is set correctly from the start
  onStateChange('Tamil Nadu');
  
  // Initialize coupon UI hydration on page load (for page refresh persistence)
  // This ensures the green checkmark container syncs from localStorage
  renderAppliedCouponsList();

  // Hydrate offer banner from Firestore (async) then render offer section
  loadOfferFromFirestore().then(offer => {
    renderOfferBanner(offer);
  });

  // ==========================================================================
  // FIRESTORE REAL-TIME LISTENERS
  // These replace the one-time loadCategoriesFromFirestore, loadProductsFromFirestore,
  // and loadBannersFromFirestore calls. The listeners:
  //   1. Fetch the initial snapshot from Firestore (replacing the one-time get())
  //   2. Update localStorage with the fresh data
  //   3. Re-render all relevant UI components
  //   4. STAY ACTIVE — any future add/edit/delete from the Admin panel will
  //      instantly propagate to the storefront WITHOUT a page refresh.
  // ==========================================================================
  console.log('[Realtime] ⏳ Initializing Firestore real-time listeners...');

  // Categories listener — also re-renders filter buttons + product catalog
  if (typeof window.listenCategoriesRealtime === 'function') {
    window.listenCategoriesRealtime();
  } else {
    // Fallback: one-time fetch if listener function is unavailable
    console.warn('[Realtime] listenCategoriesRealtime not found. Falling back to one-time fetch.');
    loadCategoriesFromFirestore().then(() => {
      renderCategoriesGrid();
      renderFilterButtons();
      renderProductsCatalog();
    });
  }

  // Products listener — re-renders catalog and syncs action buttons
  if (typeof window.listenProductsRealtime === 'function') {
    window.listenProductsRealtime();
  } else {
    console.warn('[Realtime] listenProductsRealtime not found. Falling back to one-time fetch.');
    loadProductsFromFirestore().then(() => {
      renderProductsCatalog();
      renderMobileSlider();
    });
  }

  // Banners listener — re-initializes carousel
  if (typeof window.listenBannersRealtime === 'function') {
    window.listenBannersRealtime();
  } else {
    console.warn('[Realtime] listenBannersRealtime not found. Falling back to one-time fetch.');
    loadBannersFromFirestore().then(() => {
      initCarousel();
    });
  }

  console.log('[Realtime] ✅ Real-time listeners initialized. Storefront will auto-update when admin makes changes.');
  
  // Close menu on nav link clicks
  const navLinks = document.querySelectorAll('.nav-link');
  const navMenu = document.getElementById('mobile-nav'); // Mobile drawer only
  const menuToggle = document.getElementById('menu-toggle');

  // Guard: the header (with #menu-toggle and #mobile-nav) is static markup
  // present on every page. If a page lacks these elements, skip the bindings
  // so DOMContentLoaded never aborts with a null-reference error.
  if (menuToggle && navMenu) {
    const menuBackdrop = document.getElementById('mobile-menu-backdrop');

    // Highlight the drawer link that matches the page currently loaded.
    // The mobile menu markup is duplicated on every page, so the active
    // state must be derived from the URL at runtime instead of being
    // hardcoded in HTML. Only the mobile drawer (#mobile-nav) is touched —
    // the desktop navbar layout stays untouched.
    const normalizeMenuHref = (raw) => {
      const file = (raw || '').split('#')[0].split('?')[0];
      const base = file.substring(file.lastIndexOf('/') + 1).replace(/\.html$/i, '');
      return base || 'index'; // site root ('/' or '') serves index.html
    };
    const highlightActiveMenuLinks = () => {
      const current = normalizeMenuHref(window.location.pathname);
      navMenu.querySelectorAll('.nav-link').forEach((link) => {
        link.classList.toggle('active', normalizeMenuHref(link.getAttribute('href')) === current);
      });
    };
    highlightActiveMenuLinks();

    // Single source of truth for the full-width dropdown state: panel
    // slide-down, hamburger<->X morph and backdrop visibility stay in sync
    const setMenuOpen = (isOpen) => {
      navMenu.classList.toggle('active', isOpen);
      menuToggle.classList.toggle('active', isOpen);
      if (menuBackdrop) menuBackdrop.classList.toggle('active', isOpen);
      if (isOpen) highlightActiveMenuLinks(); // re-sync in case a click handler marked another link

      const bars = menuToggle.querySelectorAll('.bar');
      if (bars.length < 3) return;
      if (isOpen) {
        bars[0].style.transform = 'rotate(-45deg) translate(-5px, 6px)';
        bars[1].style.opacity = '0';
        bars[2].style.transform = 'rotate(45deg) translate(-5px, -6px)';
      } else {
        bars[0].style.transform = 'none';
        bars[1].style.opacity = '1';
        bars[2].style.transform = 'none';
      }
    };

    navLinks.forEach(link => {
      link.addEventListener('click', (e) => {
        // Set active nav link
        navLinks.forEach(l => l.classList.remove('active'));
        link.classList.add('active');

        // Close mobile menu AND reset the toggle icon back to the hamburger state
        setMenuOpen(false);

        // Keep the URL-derived active state authoritative on mobile: the
        // click-time class above is transient (the browser navigates away),
        // so re-apply highlighting to the drawer links after navigation.
        if (link.closest('#mobile-nav')) {
          navMenu.querySelectorAll('.nav-link').forEach((l) => {
            l.classList.toggle('active', normalizeMenuHref(l.getAttribute('href')) === normalizeMenuHref(link.getAttribute('href')));
          });
        }
      });
    });

    // Hamburger toggle click: open/close the dropdown panel (the morphed X
    // in the main header is the single close control for the menu)
    menuToggle.addEventListener('click', () => {
      setMenuOpen(!navMenu.classList.contains('active'));
    });

    // Tapping the dimmed backdrop below the header closes the dropdown
    if (menuBackdrop) {
      menuBackdrop.addEventListener('click', () => setMenuOpen(false));
    }
  } // end if (menuToggle && navMenu)
});

/* ==========================================================================
   1. Carousel Slider Banner (diwali greeting background auto-rotates)
   ========================================================================== */
function initCarousel() {
  const heroCarousel = document.getElementById('hero-carousel');
  if (!heroCarousel) return;

  // Ensure hero slides container exists
  let slidesContainer = document.getElementById('hero-slides');
  if (!slidesContainer) {
    slidesContainer = document.createElement('div');
    slidesContainer.id = 'hero-slides';
    heroCarousel.insertBefore(slidesContainer, heroCarousel.firstChild);
  }

  // --- Normalize banners to exactly 4 with the 2-column shape ---
  // Expected shape: { tagline, headingTitle, subtitle, description, imageBase64 }
  // `subtitle` renders strictly from banner.subtitle; we never synthesize/duplicate
  // headingTitle into it. If empty, the subtitle stays empty (rendered hidden).
  const normalizeBanner = (item) => ({
    tagline:      (item?.tagline ?? '').toString(),
    headingTitle: (item?.headingTitle ?? '').toString(),
    subtitle:     (item?.subtitle ?? '').toString(),
    description:  (item?.description ?? '').toString(),
    imageBase64:  (item?.imageBase64 ?? '').toString()
  });

  const ensureFourBanners = (parsed) => {
    if (!Array.isArray(parsed)) throw new Error('not array');
    const mapped = parsed.map(normalizeBanner);
    // Pad to 4
    while (mapped.length < 4) {
      const idx = mapped.length + 1;
      mapped.push({
        tagline:      `Banner ${idx}`,
        headingTitle: `Offer ${idx}`,
        subtitle:     'Limited Time',
        description:  'Check out our latest festive offers on premium firecrackers.',
        imageBase64:  ''
      });
    }
    // Truncate to 4
    return mapped.slice(0, 4);
  };

  // --- Load + normalize banners (always exactly 4) ---
  const raw = localStorage.getItem('bannersData');
  let banners;
  if (!raw) {
    const defaults = [
      { tagline: 'MINIMUM ORDER ₹2000', headingTitle: 'Biggest Diwali Sale', subtitle: 'Upto 60% OFF', description: 'Order authentic Sivakasi crackers directly from Supreme Fireworks wholesale & retail dealers. Guaranteed safe transport across India!', imageBase64: '' },
      { tagline: 'SUPER VALUE OFFER', headingTitle: 'Up To 40% OFF on Combo Packs', subtitle: 'Best Deals This Season', description: 'Grab curated combos packed with safety, brightness, and joy.', imageBase64: '' },
      { tagline: 'TRUST & SAFETY', headingTitle: '100% Quality & Safe Delivery', subtitle: 'Tested & Certified', description: 'Sourced from top manufacturers in Sivakasi. Tested for safety and packaged securely.', imageBase64: '' },
      { tagline: 'PREMIUM SELECTION', headingTitle: 'Top Rated Firecrackers', subtitle: 'Customer Favorite', description: 'Highest-rated products from our collection. Trusted by thousands of happy customers.', imageBase64: '' }
    ];
    localStorage.setItem('bannersData', JSON.stringify(defaults));
    banners = defaults;
  } else {
    try {
      const parsed = JSON.parse(raw);
      banners = ensureFourBanners(parsed);
      localStorage.setItem('bannersData', JSON.stringify(banners));
    } catch (e) {
      localStorage.removeItem('bannersData');
      banners = ensureFourBanners([
        { tagline: 'FESTIVAL SALE', headingTitle: 'Festive Special Offers', subtitle: 'Limited Time', description: 'Check out our latest festive offers on premium firecrackers.', imageBase64: '' }
      ]);
      localStorage.setItem('bannersData', JSON.stringify(banners));
    }
  }

  // --- DOM lookups for the fixed 2-column layout ---
  const slideBadge = document.getElementById('slide-badge');
  const slideTitle = document.getElementById('slide-title');
  const slideSubtitle = document.getElementById('slide-subtitle');
  const slideDescription = document.getElementById('slide-description');
  const slideCardImage = document.getElementById('slide-card-image');
  const prevBtn = document.getElementById('carousel-prev');
  const nextBtn = document.getElementById('carousel-next');
  const indicatorsWrap = document.getElementById('carousel-indicators');


  // Static 4 indicators only (fixed 4-banner layout)
  if (indicatorsWrap) {
    indicatorsWrap.innerHTML = '';
    for (let i = 0; i < 4; i++) {
      const ind = document.createElement('span');
      ind.className = `indicator ${i === 0 ? 'active' : ''}`;
      ind.setAttribute('data-slide', String(i));
      indicatorsWrap.appendChild(ind);
    }
  }

  const indicators = heroCarousel.querySelectorAll('.carousel-indicators .indicator');
  let currentSlide = 0;

  // Per-slide primary button config (keyed by 1-based banner number).
  // Icons reuse the project's .hero-btn-icon sizing class (no Tailwind).
  const slidePrimaryButtons = {
    1: {
      text: 'Explore Products',
      href: '#products',
      icon: '<svg class="hero-btn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M14 5l7 7m0 0l-7 7m7-7H3"/></svg>'
    },
    2: {
      text: 'Lucky Spin Wheel',
      href: '#spin-wheel',
      icon: '<svg class="hero-btn-icon" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2a10 10 0 100 20 10 10 0 000-20zm1 14.93V18a1 1 0 11-2 0v-1.07A6.002 6.002 0 016.07 13H5a1 1 0 110-2h1.07A6.002 6.002 0 0111 6.07V5a1 1 0 112 0v1.07A6.002 6.002 0 0117.93 11H19a1 1 0 110 2h-1.07A6.002 6.002 0 0113 16.93z"/></svg>'
    },
    3: {
      text: 'View Combos',
      href: '#combos',
      icon: '<svg class="hero-btn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z"/></svg>'
    },
    4: {
      text: 'Enquiry Now',
      href: '#quick-enquiry',
      icon: '<svg class="hero-btn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"/></svg>'
    }
  };

  // Update the primary action button for the active slide (0-based index).
  function updateBannerButtons(slideIndex) {
    const btnConfig = slidePrimaryButtons[slideIndex + 1] || slidePrimaryButtons[1];
    const primaryBtn = document.getElementById('slide-primary-btn');
    if (primaryBtn && btnConfig) {
      primaryBtn.href = btnConfig.href;
      primaryBtn.innerHTML = `<span>${btnConfig.text}</span> ${btnConfig.icon}`;
    }
  }

  // Default unique background gradient per banner (keyed by 1-based banner number).
  // Premium dark theme (no bright orange) so the yellow heading + emerald buttons
  // keep high contrast.
  const bannerGradients = {
    1: 'linear-gradient(to bottom, #0c0a09 0%, #450a0a 50%, #1c1917 100%)', // Stone -> deep red -> stone (premium dark)
    2: 'linear-gradient(135deg, #180938 0%, #290a59 50%, #1c063b 100%)', // Royal Purple Night
    3: 'linear-gradient(to right, #450a0a 0%, #171717 50%, #020617 100%)', // Ember red -> neutral -> slate (premium dark)
    4: 'linear-gradient(135deg, #4a090a 0%, #630c0e 50%, #3b0506 100%)'  // Deep Crimson Gold
  };

  // Apply the assigned hero background for the active slide (0-based index).
  function applyBannerBackground(slideIndex) {
    const gradient = bannerGradients[slideIndex + 1] || bannerGradients[1];
    // #hero-carousel paints over #home; set both so the full hero area updates.
    ['hero-carousel', 'home'].forEach((elId) => {
      const el = document.getElementById(elId);
      if (!el) return;
      el.style.transition = 'background 0.7s ease-in-out';
      el.style.background = gradient;
    });
  }

  // Update the displayed banner content in the fixed 2-column DOM
  function updateSlide(index) {
    const banner = banners[index];
    if (!banner) return;

    // Tagline badge: animated 4-point SVG sparkle prefix + the slide's tagline
    // text. The SVG uses fill="currentColor" so it matches the badge text.
    // Rendered on every slide that HAS a tagline; only hidden when the tagline
    // is empty/whitespace (after stripping any leading emoji).
    if (slideBadge) {
      const cleanTagline = (banner.tagline || '')
        .replace(/^[\u2190-\u21FF\uD800-\uDFFF\u2600-\u27BF\uFE0F\s]+/, '')
        .trim();
      if (!cleanTagline) {
        slideBadge.innerHTML = '';
        slideBadge.style.display = 'none';
      } else {
        const sparkleSvg = '<svg class="hero-badge-sparkle" viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden="true" focusable="false" style="flex-shrink:0;">' +
          '<path d="M12 2L14.26 9.74L22 12L14.26 14.26L12 22L9.74 14.26L2 12L9.74 9.74L12 2Z"/></svg>';
        // SVG above is a static literal (safe); tagline text is set via textContent.
        slideBadge.innerHTML = sparkleSvg;
        const tagText = document.createElement('span');
        tagText.textContent = cleanTagline;
        slideBadge.appendChild(tagText);
        slideBadge.style.display = 'inline-flex';
        slideBadge.style.alignItems = 'center';
        slideBadge.style.gap = '6px';
      }
    }
    if (slideTitle) slideTitle.textContent = banner.headingTitle || '';
    if (slideSubtitle) {
      // Strictly render banner.subtitle; hide the element entirely when empty so we
      // never duplicate/truncate the heading title.
      slideSubtitle.textContent = banner.subtitle || '';
      slideSubtitle.style.display = banner.subtitle ? '' : 'none';
    }
    if (slideDescription) slideDescription.textContent = banner.description || '';

    // Set image — use Base64 if available, otherwise gradient placeholder.
    // The card starts in an `is-skeleton` state (see index.html); we drop it as
    // soon as real content is available and fade the image in to avoid a flash.
    const imageCard = slideCardImage ? slideCardImage.closest('.hero-image-card') : null;
    if (slideCardImage) {
      if (banner.imageBase64) {
        slideCardImage.classList.remove('img-loaded');
        slideCardImage.onload = () => slideCardImage.classList.add('img-loaded');
        slideCardImage.src = banner.imageBase64;
        slideCardImage.style.background = 'none';
        slideCardImage.style.objectFit = 'cover';
      } else {
        const gradients = [
          'linear-gradient(135deg, #5a1215 0%, #75171b 50%, #420b0d 100%)',
          'linear-gradient(135deg, #420b0d 0%, #631417 50%, #2a0708 100%)',
          'linear-gradient(135deg, #75171b 0%, #5a1215 60%, #2e0708 120%)',
          'linear-gradient(135deg, #631417 0%, #5a1215 50%, #3a090c 100%)'
        ];
        slideCardImage.onload = null;
        slideCardImage.removeAttribute('src');
        slideCardImage.style.background = gradients[index] || gradients[0];
        slideCardImage.style.objectFit = 'none';
        // Gradient placeholder is intentionally visible immediately
        slideCardImage.classList.add('img-loaded');
      }
      if (imageCard) imageCard.classList.remove('is-skeleton');
    }

    // Update indicators
    indicators.forEach((ind, i) => {
      ind.classList.toggle('active', i === index);
    });

    // Sync the per-slide primary action button (secondary stays fixed)
    updateBannerButtons(index);

    // Smoothly transition the hero background to this banner's gradient
    applyBannerBackground(index);

    currentSlide = index;
  }

  // Show a specific slide (normalized to 0-3)
  function showSlide(index) {
    const len = banners.length || 4;
    const target = ((index % len) + len) % len;
    updateSlide(target);
  }

  const nextSlide = () => showSlide(currentSlide + 1);
  const prevSlide = () => showSlide(currentSlide - 1);

  const startAutoplay = () => {
    stopAutoplay();
    carouselInterval = setInterval(nextSlide, 5000);
  };

  const stopAutoplay = () => {
    if (carouselInterval) clearInterval(carouselInterval);
  };

  // Controls
  if (prevBtn) prevBtn.addEventListener('click', () => {
    showSlide(currentSlide - 1);
    startAutoplay();
  });

  if (nextBtn) nextBtn.addEventListener('click', () => {
    showSlide(currentSlide + 1);
    startAutoplay();
  });

  indicators.forEach((ind, i) => {
    ind.addEventListener('click', () => {
      showSlide(i);
      startAutoplay();
    });
  });

  // Pause on hover
  const heroSection = document.getElementById('home');
  if (heroSection) {
    heroSection.addEventListener('mouseenter', stopAutoplay);
    heroSection.addEventListener('mouseleave', startAutoplay);
  }

  // --- Force an immediate, synchronous render of Slide 0 BEFORE starting the
  // auto-slide timer. Without this, the carousel only painted on the first
  // interval tick (nextSlide -> slide 1), so slide 1 stayed blank until the
  // cycle wrapped all the way back around. ---
  currentSlide = 0;
  showSlide(0);

  startAutoplay();
}


function escapeHtml(text) {
  if (!text) return '';
  const map = { '&': '&amp;', '<': '<', '>': '>', '"': '"', "'": '&#039;' };
  return String(text).replace(/[&<>"']/g, m => map[m]);
}

/* ==========================================================================
   2. Category Cards Rendering
   ========================================================================== */
const CATEGORY_INITIAL_LIMIT = 16; // 4 rows x 4 columns on desktop
let categoriesExpanded = false;    // becomes true after "Load More Categories"

function renderCategoriesGrid() {
  // The categories grid only exists on index.html, but realtime listeners in
  // data.js call this on every page — return quietly when the container is
  // absent instead of logging a console error (e.g. on products.html).
  const grid = document.getElementById('categories-grid');
  if (!grid) return;
  console.log('[renderCategoriesGrid] Function called. Grid element: FOUND');

  const categories = getCategories();
  console.log('[renderCategoriesGrid] Categories loaded:', categories);
  console.log('[renderCategoriesGrid] Categories count:', categories.length);
  console.log('[renderCategoriesGrid] Is array?', Array.isArray(categories));
  
  if (!Array.isArray(categories) || categories.length === 0) {
    console.error('[renderCategoriesGrid] ✗ Categories is empty or not an array!');
    grid.innerHTML = '<div class="category-card-placeholder">No categories available.</div>';
    return;
  }
  
  grid.innerHTML = '';
  console.log('[renderCategoriesGrid] Grid cleared. Starting forEach loop...');
  
  categories.forEach((cat, index) => {
    console.log(`[renderCategoriesGrid] Processing category ${index}:`, cat);
    
    try {
      const card = document.createElement('div');
      card.className = `category-card fade-in-up visible`; // 'visible' ensures opacity:1 — without it, cards stay invisible (opacity:0) until scroll observer fires
      // Only the first CATEGORY_INITIAL_LIMIT (16) cards show until "Load More" is clicked.
      if (!categoriesExpanded && index >= CATEGORY_INITIAL_LIMIT) {
        card.classList.add('category-hidden');
      }
      card.style.transitionDelay = `${index * 50}ms`;
      card.setAttribute('onclick', `filterByCategory('${cat.slug}')`);
      
      // Create random or distinct gradient placeholders (fallback only)
      const emojiMap = {
        'ground-chakkars': '<i class="fa-solid fa-tornado"></i>',
        'flower-pots': '<i class="fa-solid fa-volcano"></i>',
        'fancy-fountains': '<i class="fa-solid fa-fountain"></i>',
        'pencils': '<i class="fa-solid fa-pencil"></i>',
        'sparklers': '<i class="fa-solid fa-wand-magic-sparkles"></i>',
        'atom-bombs': '<i class="fa-solid fa-bomb"></i>',
        'rockets': '<i class="fa-solid fa-rocket"></i>',
        'bijili-crackers': '<i class="fa-solid fa-bolt"></i>',
        'combo-packs': '<i class="fa-solid fa-gift"></i>'
      };
      const emoji = emojiMap[cat.slug] || '<i class="fa-solid fa-fire"></i>';
      // Calculate bgClass using category letter position (A=1, B=2, etc.)
      const catLetter = String(cat.id).toUpperCase();
      const bgClass = `cat-g-${(catLetter.charCodeAt(0) - 64) % 9 + 1}`;

      // Validate image URL: must be a real URL (http/https/data:/blob:) or a path with file extension
      const rawUrl = (cat.categoryImageUrl ?? cat.image ?? '').toString().trim();
      const isValidUrl = rawUrl && (
        rawUrl.startsWith('http://') ||
        rawUrl.startsWith('https://') ||
        rawUrl.startsWith('data:') ||
        rawUrl.startsWith('blob:') ||
        /\.(jpg|jpeg|png|gif|webp|svg|avif)(\?.*)?$/i.test(rawUrl)
      );
      const categoryImageUrl = isValidUrl ? rawUrl : '';

      card.innerHTML = `
        <div class="cat-bg ${bgClass}">${categoryImageUrl ? '' : emoji}</div>
        ${categoryImageUrl
          ? `<img src="${categoryImageUrl}" alt="${escapeHtml(cat.name)}" class="category-card-img" loading="lazy" onerror="this.style.display='none';this.previousElementSibling.innerHTML='${emoji}';">`
          : ''}
        <div class="category-overlay"></div>
        <div class="category-info">
          <h3 class="category-name">${escapeHtml(cat.name)}</h3>
          <span class="category-link">View Collection <i class="fa-solid fa-arrow-right"></i></span>
        </div>
      `;
      grid.appendChild(card);
      console.log(`[renderCategoriesGrid] ✓ Category ${index} rendered: ${cat.name}`);
    } catch (cardErr) {
      console.error(`[renderCategoriesGrid] ✗ Error rendering category ${index}:`, cardErr, cat);
    }
  });
  
  console.log('[renderCategoriesGrid] ✓ Render complete. Grid children count:', grid.children.length);

  // Reveal/hide the Load More + View All Products actions based on total count.
  updateCategoryActions(categories.length);
}

// Show/hide the category action buttons. "Load More Categories" appears only when
// there are more than CATEGORY_INITIAL_LIMIT categories still collapsed; otherwise
// the primary "View All Products" button is shown (immediately when <= 16, or once
// everything has been expanded).
function updateCategoryActions(total) {
  const loadMoreBtn = document.getElementById('load-more-categories');
  const viewAllBtn = document.getElementById('view-all-products');
  if (!loadMoreBtn && !viewAllBtn) return;

  const hasMoreToShow = total > CATEGORY_INITIAL_LIMIT && !categoriesExpanded;
  if (loadMoreBtn) loadMoreBtn.style.display = hasMoreToShow ? '' : 'none';
  if (viewAllBtn) viewAllBtn.style.display = hasMoreToShow ? 'none' : '';
}

// Reveal the remaining (hidden) category cards, then swap in "View All Products".
function loadMoreCategories() {
  categoriesExpanded = true;
  const grid = document.getElementById('categories-grid');
  if (grid) {
    grid.querySelectorAll('.category-hidden').forEach(function (card) {
      card.classList.remove('category-hidden');
    });
  }
  updateCategoryActions(getCategories().length);
}
window.loadMoreCategories = loadMoreCategories;

function updateMobileCategoryBanner() {
  const label = document.getElementById('mobile-category-label');
  if (!label) return;

  const slug = (activeCategory || 'all').toString().trim().toLowerCase();

  if (!slug || slug === 'all' || slug === 'all-items') {
    label.textContent = 'ALL ITEMS';
  } else {
    const categories = getCategories();
    const cat = categories.find(c => c.slug.toLowerCase() === slug);
    label.textContent = cat ? cat.name.toUpperCase() : 'ALL ITEMS';
  }
}

/* Navigate mobile slider to the slide matching a category slug */
function navigateMobileSliderTo(slug) {
  const container = document.getElementById('mobile-slider-container');
  if (!container) return;

  const normalizedSlug = (slug || 'all').toString().trim().toLowerCase();
  let targetIndex = 0; // default: "All Items" (slide 0)

  if (normalizedSlug !== 'all' && normalizedSlug !== 'all-items') {
    const categories = getCategories();
    const catIndex = categories.findIndex(c => c.slug.toLowerCase() === normalizedSlug);
    if (catIndex >= 0) {
      targetIndex = catIndex + 1; // +1 because slide 0 is "All Items"
    }
  }

  const slides = container.querySelectorAll('.category-slide-page');
  const targetSlide = slides[targetIndex];
  if (targetSlide) {
    container.scrollTo({
      left: targetSlide.offsetLeft,
      behavior: 'smooth'
    });
  }
}

function filterByCategory(slug) {
  // Cross-page: if the catalog grid isn't on this page (e.g. Home or Categories),
  // navigate to the products page with the category as a query param.
  if (!document.getElementById('products-grid')) {
    window.location.href = 'products.html?category=' + encodeURIComponent(slug);
    return;
  }

  activeCategory = slug;
  
  // Update mobile banner
  updateMobileCategoryBanner();

  // Update filter buttons
  const buttons = document.querySelectorAll('.filter-btn');
  buttons.forEach(btn => {
    if (btn.getAttribute('data-category') === slug) {
      btn.classList.add('active');
    } else {
      btn.classList.remove('active');
    }
  });

  scrollToActiveCategoryPill();
  
  renderProductsCatalog();

  // Mobile: navigate slider to matching category slide
  if (window.innerWidth <= 768) {
    navigateMobileSliderTo(slug);
  }
  
  // Scroll to products
  const productsSection = document.getElementById('products');
  if (productsSection) productsSection.scrollIntoView({ behavior: 'smooth' });
}

/* ==========================================================================
   3. Product Catalog Grid with Search / Filters & Add-To-Cart
   ========================================================================== */
/* Center the currently-active category pill within the horizontally scrollable
   filter bar. Scrolls ONLY the container (not the page) to avoid layout jumps. */
function scrollToActiveCategoryPill() {
  const filterBar = document.getElementById('filter-bar');
  if (!filterBar) return;
  const activePill = filterBar.querySelector('.filter-btn.active');
  if (!activePill) return;

  const barRect = filterBar.getBoundingClientRect();
  const pillRect = activePill.getBoundingClientRect();
  const delta = (pillRect.left - barRect.left) - (filterBar.clientWidth / 2) + (pillRect.width / 2);
  filterBar.scrollTo({ left: filterBar.scrollLeft + delta, behavior: 'smooth' });
}

function renderFilterButtons() {
  const filterBar = document.getElementById('filter-bar');
  if (!filterBar) return;

  const categories = getCategories();

  // Explicitly set data-category="all" so the filter logic can reliably detect it.
  filterBar.innerHTML = '';

  // Honor the currently-selected category so the correct pill stays highlighted across
  // re-renders (initial load, ?category= deep-link, and Firestore realtime updates).
  const currentCategory = (activeCategory || 'all').toString().trim().toLowerCase();
  const isAllActive = !currentCategory || currentCategory === 'all' || currentCategory === 'all-items';

  const allBtn = document.createElement('button');
  allBtn.className = 'filter-btn' + (isAllActive ? ' active' : '');
  allBtn.setAttribute('data-category', 'all');
  allBtn.innerText = 'All Items';
  allBtn.addEventListener('click', () => {
    document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
    allBtn.classList.add('active');
    activeCategory = 'all';
    updateMobileCategoryBanner();
    renderProductsCatalog();
    scrollToActiveCategoryPill();
  });

  filterBar.appendChild(allBtn);

  categories.forEach(cat => {
    const btn = document.createElement('button');
    btn.className = 'filter-btn' + ((cat.slug || '').toString().trim().toLowerCase() === currentCategory ? ' active' : '');
    btn.setAttribute('data-category', cat.slug);
    btn.innerText = cat.name;

    btn.addEventListener('click', () => {
      document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      activeCategory = cat.slug;
      updateMobileCategoryBanner();
      renderProductsCatalog();
      scrollToActiveCategoryPill();
    });

    filterBar.appendChild(btn);
  });

  // Search input handler — only attach once to avoid duplicate listeners on re-render
  const searchInput = document.getElementById('product-search');
  if (searchInput && !searchInput.dataset.filterBound) {
    searchInput.dataset.filterBound = 'true';
    searchInput.addEventListener('input', () => {
      renderProductsCatalog();
      renderMobileSlider();
    });
  }

  // Center the active pill within the scrollable filter bar after render
  // (covers initial load, ?category= deep-link, and Firestore realtime re-renders).
  setTimeout(scrollToActiveCategoryPill, 100);
}

function renderProductsCatalog() {
  const grid = document.getElementById('products-grid');
  if (!grid) return;

  // Keep mobile banner in sync
  updateMobileCategoryBanner();

  const products = getProducts();
  const categories = getCategories();
  const searchQuery = document.getElementById('product-search')?.value.toLowerCase() || '';

  grid.innerHTML = '';

  // Determine selected category
  const selectedCategory = (activeCategory || '').toString().trim();
  const normalizedCategory = selectedCategory.toLowerCase();
  const isAll = !normalizedCategory || normalizedCategory === 'all' || normalizedCategory === 'all-items';

  // Filter products - use string matching for categoryId
  let filtered = products;

  if (!isAll) {
    const cat = categories.find(c => c.slug === normalizedCategory);
    if (cat) {
      filtered = products.filter(p => String(p.categoryId).toUpperCase() === String(cat.id).toUpperCase());
    }
  }

  // Search filter (name or description)
  if (searchQuery.trim() !== '') {
    filtered = filtered.filter(p =>
      (p.name || '').toLowerCase().includes(searchQuery) ||
      (p.description || '').toLowerCase().includes(searchQuery)
    );
  }

  if (filtered.length === 0) {
    grid.innerHTML = `
      <div class="product-card-placeholder">
        <i class="fa-solid fa-magnifying-glass"></i> No firecrackers match your search description. Try another keyword!
      </div>
    `;
    return;
  }

  filtered.forEach((prod, index) => {
    const card = document.createElement('div');
    card.className = `product-card ${!prod.inStock ? 'out-of-stock' : ''}`;
    
    // Category mapping for colorful placeholder background - use string letter position
    const catLetter = String(prod.categoryId).toUpperCase();
    const bgIndex = (catLetter.charCodeAt(0) - 64) % 9 + 1; // A=1, B=2, etc.
    const emojiMap = { 1: '<i class="fa-solid fa-tornado"></i>', 2: '<i class="fa-solid fa-volcano"></i>', 3: '<i class="fa-solid fa-fountain"></i>', 4: '<i class="fa-solid fa-pencil"></i>', 5: '<i class="fa-solid fa-wand-magic-sparkles"></i>', 6: '<i class="fa-solid fa-bomb"></i>', 7: '<i class="fa-solid fa-rocket"></i>', 8: '<i class="fa-solid fa-bolt"></i>', 9: '<i class="fa-solid fa-gift"></i>', 10: '<i class="fa-solid fa-tornado"></i>', 11: '<i class="fa-solid fa-volcano"></i>', 12: '<i class="fa-solid fa-fountain"></i>' };
    const emoji = emojiMap[bgIndex] || '<i class="fa-solid fa-fire"></i>';
    
    // Check quantity in cart
    const cartItem = cart.find(item => String(item.id) === String(prod.id));
    const cartQty = cartItem ? cartItem.quantity : 0;
    
    let cardImgContent = `<div class="card-placeholder-bg p-bg-${bgIndex}">${emoji}</div>`;
    if (prod.image) {
      cardImgContent = `<img src="${prod.image}" alt="${prod.name}" class="product-card-img" style="width: 100%; height: 100%; object-fit: cover; transition: var(--transition);">`;
    }

   // Conditionally render discount badge only if discount exists and is not empty
    const hasValidDiscount = prod.discount && String(prod.discount).trim() !== '' && prod.discount !== 'Special';
    
    card.innerHTML = `
      ${getWishlistBtnHTML(prod.id)}
      <div class="card-img-container">
        ${cardImgContent}
        ${hasValidDiscount ? `<span class="card-discount-badge">${prod.discount}</span>` : ''}
      </div>
      <div class="product-card-body">
        <h3 class="product-card-title" title="${escapeHtml(prod.name)}">${prod.name}</h3>
        ${getProductBadgeRowHTML(prod)}
         <span class="product-card-qty">${prod.qty}</span>
         <p class="product-card-desc">${prod.description}</p>
        <div class="product-card-price-row">
          <span class="current-price">₹${prod.price}</span>
          ${hasValidDiscount ? `<span class="original-price">₹${prod.originalPrice}</span>` : ''}
        </div>
        ${buildActionContainer(prod, cartQty)}
      </div>
    `;
    grid.appendChild(card);
  });
}

/* ==========================================================================
   Mobile Slider — swipeable category slides with pagination dots
   ========================================================================== */
function renderMobileSlider() {
  const container = document.getElementById('mobile-slider-container');
  const paginationAll = document.getElementById('mobile-pagination-all');
  if (!container || !paginationAll) return;

  // Only render on mobile (≤768px)
  if (window.innerWidth > 768) {
    container.innerHTML = '';
    paginationAll.innerHTML = '';
    return;
  }

  const products = getProducts();
  const categories = getCategories();
  const searchQuery = document.getElementById('product-search')?.value.toLowerCase() || '';

  // Build slide data: "All Items" + each category
  const slides = [];

  // All Items slide
  let allProducts = [...products];
  if (searchQuery.trim() !== '') {
    allProducts = allProducts.filter(p =>
      (p.name || '').toLowerCase().includes(searchQuery) ||
      (p.description || '').toLowerCase().includes(searchQuery)
    );
  }
  slides.push({ slug: 'all', name: 'ALL ITEMS', products: allProducts });

  // Category slides
  categories.forEach(cat => {
    let catProducts = products.filter(p => String(p.categoryId).toUpperCase() === String(cat.id).toUpperCase());
    if (searchQuery.trim() !== '') {
      catProducts = catProducts.filter(p =>
        (p.name || '').toLowerCase().includes(searchQuery) ||
        (p.description || '').toLowerCase().includes(searchQuery)
      );
    }
    slides.push({ slug: cat.slug, name: cat.name.toUpperCase(), products: catProducts });
  });

  const totalSlides = slides.length;

  // Clear containers
  container.innerHTML = '';
  paginationAll.innerHTML = '';

  // Build slides with arrow headers
  slides.forEach((slide, index) => {
    // Create slide element
    const slideEl = document.createElement('div');
    slideEl.className = 'category-slide-page';
    slideEl.setAttribute('data-slide-index', index);
    slideEl.setAttribute('data-category', slide.slug);

    // Green header with left/right arrows
    const header = document.createElement('div');
    header.className = 'slide-category-header';

    // Left arrow
    const leftArrow = document.createElement('button');
    leftArrow.className = 'slide-arrow slide-arrow-left';
    leftArrow.textContent = '\u2039';
    leftArrow.setAttribute('aria-label', 'Previous category');
    leftArrow.addEventListener('click', (e) => {
      e.stopPropagation();
      navigateSlide(-1);
    });
    header.appendChild(leftArrow);

    // Centered title
    const title = document.createElement('span');
    title.className = 'slide-category-title';
    title.textContent = slide.name;
    header.appendChild(title);

    // Right arrow
    const rightArrow = document.createElement('button');
    rightArrow.className = 'slide-arrow slide-arrow-right';
    rightArrow.textContent = '\u203a';
    rightArrow.setAttribute('aria-label', 'Next category');
    rightArrow.addEventListener('click', (e) => {
      e.stopPropagation();
      navigateSlide(1);
    });
    header.appendChild(rightArrow);

    slideEl.appendChild(header);

    // Scrollable product list
    const listEl = document.createElement('div');
    listEl.className = 'slide-products-list';

    if (slide.products.length === 0) {
      listEl.innerHTML = '<div class="product-card-placeholder">No items in this category</div>';
    } else {
      slide.products.forEach(prod => {
        const cartItem = cart.find(item => item.id === prod.id);
        const cartQty = cartItem ? cartItem.quantity : 0;
        listEl.appendChild(createMobileProductCard(prod, cartQty));
      });
    }

    slideEl.appendChild(listEl);
    container.appendChild(slideEl);
  });

  // "All Items" pill — clicking scrolls to slide 0
  const pill = document.createElement('span');
  pill.className = 'pagination-pill active';
  pill.textContent = 'All Items';
  pill.setAttribute('data-slide', 0);
  pill.addEventListener('click', () => {
    const slidesList = container.querySelectorAll('.category-slide-page');
    if (slidesList.length > 0) {
      slidesList[0].scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'start' });
    }
  });
  paginationAll.appendChild(pill);

  // Set up IntersectionObserver for arrow & pill state
  setupSliderPaginationObserver();

  // Honor the currently-selected category (e.g. arriving via ?category= deep-link on
  // mobile) so the slider opens on the matching slide instead of defaulting to "All
  // Items". Covers initial load and Firestore realtime re-renders. Deferred so the
  // freshly-appended slides have valid layout offsets before we scroll.
  const currentSlug = (activeCategory || 'all').toString().trim().toLowerCase();
  if (currentSlug && currentSlug !== 'all' && currentSlug !== 'all-items') {
    setTimeout(function () { navigateMobileSliderTo(currentSlug); }, 100);
  }
}

/* Helper: create a single product card DOM node for the mobile slider */
function createMobileProductCard(prod, cartQty) {
  const card = document.createElement('div');
  card.className = `product-card ${!prod.inStock ? 'out-of-stock' : ''}`;

  // Use string letter position for bgIndex (A=1, B=2, etc.)
  const catLetter = String(prod.categoryId).toUpperCase();
  const bgIndex = (catLetter.charCodeAt(0) - 64) % 9 + 1;
  const emojiMap = { 1: '<i class="fa-solid fa-tornado"></i>', 2: '<i class="fa-solid fa-volcano"></i>', 3: '<i class="fa-solid fa-fountain"></i>', 4: '<i class="fa-solid fa-pencil"></i>', 5: '<i class="fa-solid fa-wand-magic-sparkles"></i>', 6: '<i class="fa-solid fa-bomb"></i>', 7: '<i class="fa-solid fa-rocket"></i>', 8: '<i class="fa-solid fa-bolt"></i>', 9: '<i class="fa-solid fa-gift"></i>', 10: '<i class="fa-solid fa-tornado"></i>', 11: '<i class="fa-solid fa-volcano"></i>', 12: '<i class="fa-solid fa-fountain"></i>' };
  const emoji = emojiMap[bgIndex] || '<i class="fa-solid fa-fire"></i>';

  let cardImgContent = `<div class="card-placeholder-bg p-bg-${bgIndex}">${emoji}</div>`;
  if (prod.image) {
    cardImgContent = `<img src="${prod.image}" alt="${prod.name}" class="product-card-img" style="width: 100%; height: 100%; object-fit: cover; transition: var(--transition);">`;
  }

 // Conditionally render discount badge only if discount exists and is not empty
   const hasValidDiscount = prod.discount && String(prod.discount).trim() !== '' && prod.discount !== 'Special';
   
   card.innerHTML = `
     ${getWishlistBtnHTML(prod.id)}
     <div class="card-img-container">
       ${cardImgContent}
       ${hasValidDiscount ? `<span class="card-discount-badge">${prod.discount}</span>` : ''}
     </div>
     <div class="product-card-body">
      <h3 class="product-card-title" title="${escapeHtml(prod.name)}">${prod.name}</h3>
      ${getProductBadgeRowHTML(prod)}
      <span class="product-card-qty">${prod.qty}</span>
      <p class="product-card-desc">${prod.description}</p>
      <div class="product-card-price-row">
        <span class="current-price">₹${prod.price}</span>
        ${hasValidDiscount ? `<span class="original-price">₹${prod.originalPrice}</span>` : ''}
      </div>
      ${buildActionContainer(prod, cartQty)}
    </div>
  `;

  return card;
}

/* Arrow navigation: scroll slider one page left (-1) or right (+1) */
function navigateSlide(direction) {
  const container = document.getElementById('mobile-slider-container');
  if (!container) return;

  const slidesList = container.querySelectorAll('.category-slide-page');
  if (!slidesList.length) return;

  const totalSlides = slidesList.length;
  const currentIndex = window._currentSlideIndex || 0;

  let newIndex = currentIndex + direction;
  if (newIndex < 0) newIndex = 0;
  if (newIndex >= totalSlides) newIndex = totalSlides - 1;
  if (newIndex === currentIndex) return;

  slidesList[newIndex].scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'start' });
}

/* Enable/disable all left & right arrows based on current slide position */
function updateArrowStates(currentIndex, totalSlides) {
  const leftArrows = document.querySelectorAll('.slide-arrow-left');
  const rightArrows = document.querySelectorAll('.slide-arrow-right');

  leftArrows.forEach(a => a.classList.toggle('disabled', currentIndex <= 0));
  rightArrows.forEach(a => a.classList.toggle('disabled', currentIndex >= totalSlides - 1));
}

/* IntersectionObserver: sync arrow disabled states + All Items pill when slide changes */
function setupSliderPaginationObserver() {
  const slides = document.querySelectorAll('.category-slide-page');
  const pill = document.querySelector('.pagination-pill');
  if (!slides.length) return;

  const totalSlides = slides.length;

  // Disconnect any previous observer
  if (window._sliderObserver) window._sliderObserver.disconnect();

  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const index = parseInt(entry.target.getAttribute('data-slide-index'));
        window._currentSlideIndex = index;

        // Highlight "All Items" pill only when on slide 0
        if (pill) {
          pill.classList.toggle('active', index === 0);
        }

        // Update arrow disabled states
        updateArrowStates(index, totalSlides);
      }
    });
  }, { threshold: 0.6, root: document.getElementById('mobile-slider-container') });

  window._sliderObserver = observer;
  slides.forEach(slide => observer.observe(slide));

  // Initial arrow state (slide 0 starts active)
  updateArrowStates(0, totalSlides);
}

/* ==========================================================================
   3b. JCS-style product action: ADD button ⇄ quantity stepper
   The same product can appear in several lists at once (All Items grid,
   category slides, filtered views). We therefore sync EVERY matching card
   via [data-action-for="<id>"] + querySelectorAll instead of a single id.
   ========================================================================== */
function getCartQty(prodId) {
  const item = cart.find(i => i.id === prodId);
  return item ? item.quantity : 0;
}

// Inner HTML for a single card's action area based on current quantity.
function buildProductActionInner(prodId, qty, inStock) {
  // Escape prodId for safe HTML attribute use
  const escapedId = String(prodId).replace(/"/g, '"');
  if (!inStock) {
    return `<button class="jcs-add-btn" disabled>SOLD OUT</button>`;
  }
  if (qty > 0) {
    return `
      <div class="jcs-stepper-wrap">
        <button class="jcs-step-btn" onclick="event.stopPropagation(); catalogStepQty('${escapedId}', -1)" aria-label="Decrease quantity">−</button>
        <span class="jcs-step-count">${qty}</span>
        <button class="jcs-step-btn" onclick="event.stopPropagation(); catalogStepQty('${escapedId}', 1)" aria-label="Increase quantity">+</button>
      </div>
    `;
  }
  return `<button class="jcs-add-btn" onclick="event.stopPropagation(); catalogAddQty('${escapedId}')">ADD</button>`;
}

// Full pinned container (used by both the desktop grid and the mobile slider).
function buildActionContainer(prod, qty) {
  const escapedId = String(prod.id).replace(/"/g, '"');
  return `<div class="action-container-right" data-action-for="${prod.id}">${buildProductActionInner(prod.id, qty, prod.inStock)}</div>`;
}

// Re-render EVERY on-screen action control for this product (global sync).
function syncProductAction(prodId) {
  const prod = getProducts().find(p => String(p.id) === String(prodId));
  const inStock = prod ? prod.inStock : true;
  const qty = getCartQty(prodId);
  document.querySelectorAll(`.action-container-right[data-action-for="${prodId}"]`).forEach(container => {
    container.innerHTML = buildProductActionInner(prodId, qty, inStock);
  });
}

// ADD button clicked → puts the first unit in the cart and toggles to stepper.
function catalogAddQty(prodId) {
  const prod = getProducts().find(p => String(p.id) === String(prodId));
  if (!prod || !prod.inStock) return;
  updateCartItemQuantity(prodId, getCartQty(prodId) + 1);
  syncProductAction(prodId);
  // Toast disabled: silent add to cart (no popup)
}

// Stepper +/- clicked → adjust; reaching 0 reverts back to the ADD button.
function catalogStepQty(prodId, change) {
  const newQty = Math.max(0, getCartQty(prodId) + change);
  updateCartItemQuantity(prodId, newQty);
  syncProductAction(prodId);
}

// Backward-compatible alias for any older callers.
function adjustCatalogQty(prodId, change) {
  catalogStepQty(prodId, change);
}

/* ==========================================================================
   OFFER BANNER — Storefront Render & Countdown
   Hydrates the offer section from Firestore data and runs a live countdown.
   ========================================================================== */

let offerCountdownInterval = null;

function renderOfferBanner(offer) {
  console.log('[Offer] renderOfferBanner called. active:', offer.active);

  const section = document.getElementById('promo-banner-section');
  // Offer banner only exists on some pages — return quietly elsewhere.
  if (!section) return;

  // Hide if offer is inactive
  if (offer.active === false) {
    section.style.display = 'none';
    console.log('[Offer] Offer is inactive. Hiding banner.');
    return;
  }

  // Populate text content (targeting original red banner elements)
  const tagEl = document.getElementById('promo-tag');
  const titleEl = document.getElementById('promo-title');
  const subtitleEl = document.getElementById('promo-subtitle');
  const descEl = document.getElementById('promo-desc');
  const btnEl = document.getElementById('promo-btn');

  if (tagEl) tagEl.textContent = offer.tag || '';
  if (titleEl) titleEl.textContent = offer.title || '';
  if (subtitleEl) subtitleEl.textContent = offer.subTitle || '';
  if (descEl) descEl.textContent = offer.description || '';
  if (btnEl) {
    btnEl.textContent = offer.buttonText || 'Claim Offer';
    // Always route the offer CTA to the products page, regardless of the
    // admin-configured buttonLink — the discount is claimed by ordering.
    btnEl.href = 'products.html';
  }

  // Show the section
  section.style.display = 'block';

  // Start countdown
  startOfferCountdown(offer.targetDate);
}

/**
 * Start a clean, independent countdown timer using the Firebase targetDate.
 * This runs completely offline - no database reads inside the interval.
 * Only updates the specific text elements for days/hours/mins/secs.
 */
function startOfferCountdown(targetDateStr) {
  // Clear any existing interval to prevent duplicates
  if (offerCountdownInterval) {
    clearInterval(offerCountdownInterval);
    offerCountdownInterval = null;
  }

  const targetDate = new Date(targetDateStr).getTime();
  if (isNaN(targetDate)) {
    console.warn('[Offer] Invalid targetDate:', targetDateStr);
    return;
  }

  // Cache DOM references for performance (avoid repeated getElementById calls)
  const daysEl = document.getElementById('days');
  const hoursEl = document.getElementById('hours');
  const minsEl = document.getElementById('minutes');
  const secsEl = document.getElementById('seconds');

  function updateCountdown() {
    const now = Date.now();
    const diff = targetDate - now;

    if (diff <= 0) {
      // Offer expired
      clearInterval(offerCountdownInterval);
      const section = document.getElementById('promo-banner-section');
      if (section) section.style.display = 'none';
      console.log('[Offer] Countdown expired. Hiding banner.');
      return;
    }

    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    const secs = Math.floor((diff % (1000 * 60)) / 1000);

    // Use cached DOM references (no getElementById calls inside the interval)
    if (daysEl) daysEl.textContent = String(days).padStart(2, '0');
    if (hoursEl) hoursEl.textContent = String(hours).padStart(2, '0');
    if (minsEl) minsEl.textContent = String(mins).padStart(2, '0');
    if (secsEl) secsEl.textContent = String(secs).padStart(2, '0');
  }

  updateCountdown();
  offerCountdownInterval = setInterval(updateCountdown, 1000);
  console.log('[Offer] Countdown started. Target:', new Date(targetDate).toISOString());
}

/* ==========================================================================
   5. Testimonials Slider
   ========================================================================== */
function renderTestimonialsSlider() {
  const slider = document.getElementById('testimonials-slider');
  if (!slider) return;
  
  const testimonials = getTestimonials();
  slider.innerHTML = '';
  
  testimonials.forEach(test => {
    const card = document.createElement('div');
    card.className = 'testimonial-card';
    
    // Initials
    const initials = test.name.split(' ').map(n => n[0]).join('');
    
    // Stars
    let starsHtml = '';
    for (let i = 1; i <= 5; i++) {
      starsHtml += i <= test.rating ? '<i class="fa-solid fa-star"></i>' : '<i class="fa-regular fa-star"></i>';
    }
    
    card.innerHTML = `
      <div class="testimonial-header">
        <div class="avatar-circle">${initials}</div>
        <div class="avatar-info">
          <h4>${test.name}</h4>
          <span><i class="fa-solid fa-location-dot"></i> ${test.location}</span>
        </div>
      </div>
      <div class="star-rating">${starsHtml}</div>
      <p class="testimonial-comment">"${test.comment}"</p>
    `;
    slider.appendChild(card);
  });
  
  // Slider Controls
  const prevBtn = document.getElementById('testimonial-prev');
  const nextBtn = document.getElementById('testimonial-next');
  
  if (prevBtn && nextBtn) {
    prevBtn.addEventListener('click', () => {
      slider.scrollBy({ left: -320, behavior: 'smooth' });
    });
    
    nextBtn.addEventListener('click', () => {
      slider.scrollBy({ left: 320, behavior: 'smooth' });
    });
  }
}

/* ==========================================================================
   6. Shopping Cart API & Sticky Drawer Side
   ========================================================================== */
function toggleCartDrawer() {
  document.getElementById('cart-drawer').classList.toggle('active');
  document.getElementById('cart-drawer-overlay').classList.toggle('active');
}

function loadCartFromStorage() {
  const savedCart = localStorage.getItem('kpr_cart');
  if (savedCart) {
    try {
      cart = JSON.parse(savedCart);
    } catch (e) {
      cart = [];
    }
  }
  // Always sync the UI — first-time visitors (no saved key) still need the
  // empty-cart state painted (e.g. the enquiry page empty-cart notice).
  // Cross-account mismatches are reconciled moments later by the
  // onAuthStateChanged → applyCartOwnership() gate (single source of truth).
  updateCartUI();
}

/* ---------- Account-isolated cart (guest ↔ signed-in ownership) ----------
   'kpr_cart' always mirrors the VISIBLE cart; 'kpr_cart_owner' stamps whose
   account it belongs to ('' = guest); 'kpr_cart_user_<uid>' keeps a private
   per-device copy for instant offline repaint; and the SERVER SOURCE OF
   TRUTH is the user's Firestore document field 'users/{uid}.cart' — written
   on every cart mutation while signed in, so the cart follows the account
   across devices and a fresh account's cart starts EMPTY. User A's items
   never reach User B: every transition reconciles against the current
   account's own document only. */
const CART_OWNER_KEY = 'kpr_cart_owner';
let _kprCartLastLocalWrite = 0; // guards reconcile-vs-fast-edit races

function userCartKey(uid) {
  return 'kpr_cart_user_' + uid;
}

/** True for Spin Wheel free-gift lines (legacy id prefix + all flag variants). */
function isGiftCartItem(item) {
  if (!item) return false;
  return !!(item.isGift || item.isFreeGift || item.isSpinReward ||
    String(item.id).indexOf('GIFT-') === 0);
}

/** Copy of the cart with every free-gift line pinned to the top (stable). */
function cartWithGiftsFirst() {
  return [...cart].sort((a, b) => (isGiftCartItem(a) ? 0 : 1) - (isGiftCartItem(b) ? 0 : 1));
}

/** Fire-and-forget write of the signed-in user's cart to users/{uid}. */
function persistCartToFirestore() {
  const user = (typeof getKprAuthUser === 'function') ? getKprAuthUser() : null;
  if (!user || !user.uid || !window.db) return;

  try {
    window.db.collection('users').doc(user.uid)
      .set({ cart: cartWithGiftsFirst(), cartUpdatedAt: new Date().toISOString() }, { merge: true })
      .catch(err => {
        // Merge-set never clobbers the spin-cooldown fields in the same doc.
        console.error('[Cart] ✗ Firestore cart sync failed. Code:', err && err.code, 'Message:', err && err.message, err);
      });
  } catch (e) {
    console.error('[Cart] ✗ Firestore cart sync threw:', e);
  }
}

/**
 * Pull users/{uid}.cart from the SERVER and adopt it as the visible cart.
 * ONLY called on genuine auth transitions (first sign-in / account switch),
 * never on same-account page navigation (see applyCartOwnership).
 *   • server has a cart AND the local per-account copy is NEWER (a DB write
 *     killed by a fast page navigation) → local wins and is re-pushed
 *   • server has a cart → server wins (cross-device sync)
 *   • server has no cart field → the current uid-owned local cart (a guest
 *     cart adopted at sign-in, or offline edits) is canonical → written down
 *   • fetch failed / offline → keep the local mirror state
 */
function reconcileUserCartWithServer(uid) {
  if (!uid || !window.db) return;
  const startedAt = Date.now();

  window.db.collection('users').doc(uid).get({ source: 'server' })
    .then(docSnap => {
      if (_kprCartLastLocalWrite > startedAt) return; // local edits are newer
      const data = (docSnap && docSnap.exists) ? docSnap.data() : null;
      if (data && Array.isArray(data.cart)) {
        // Staleness tiebreaker: compare the server cart's write time against
        // this device's last LOCAL write for THIS account. If the local copy
        // is newer (e.g. the DB write died mid-navigation to dashboard.html),
        // keep — do not clobber — it and let the save below re-push it.
        let localTs = 0;
        try { localTs = Number(localStorage.getItem(userCartKey(uid) + '_ts')) || 0; } catch (e) {}
        const serverTs = data.cartUpdatedAt ? new Date(data.cartUpdatedAt).getTime() : 0;
        if (!(localTs > serverTs)) {
          cart = data.cart; // server is current → adopt
        }
      }
      // Persist the final authoritative cart (also stamps the local ts).
      saveCartToStorage(); // rewrites kpr_cart + mirror + users/{uid}.cart
      updateCartUI();
    })
    .catch(err => {
      console.error('[Cart] ✗ Could not fetch user cart from Firestore. Code:', err && err.code, 'Message:', err && err.message, err);
      // Offline / read failure: keep the local mirror as canonical and make
      // sure ownership + the local slots are fully written (DB write inside
      // is fire-and-forget and simply retries on the next mutation).
      saveCartToStorage();
      updateCartUI();
    });
}

function saveCartToStorage() {
  try {
    _kprCartLastLocalWrite = Date.now();
    // Gift lines are stored index-0 so every renderer (and the DB copy) keeps
    // the Free Gift pinned at the top of the list.
    localStorage.setItem('kpr_cart', JSON.stringify(cartWithGiftsFirst()));
    // Stamp ownership and mirror the account-scoped private copy.
    const user = (typeof getKprAuthUser === 'function') ? getKprAuthUser() : null;
    const uid = (user && user.uid) ? user.uid : '';
    localStorage.setItem(CART_OWNER_KEY, uid);
    if (uid) {
      localStorage.setItem(userCartKey(uid), JSON.stringify(cart));
      // Per-account write stamp: lets reconcileUserCartWithServer tell a
      // genuinely-newer local cart from one whose DB write was lost when a
      // page navigation interrupted it (profile-icon click, etc.).
      localStorage.setItem(userCartKey(uid) + '_ts', String(Date.now()));
    }
  } catch (e) {
    console.error('[Cart] ✗ Failed to persist the cart:', e);
  }
  // Requirement 1: every add/update/delete by a signed-in user syncs to DB.
  persistCartToFirestore();
}

/**
 * Reconcile the visible cart with the CURRENT auth account. Called from the
 * onAuthStateChanged listener (fires on every page load once Firebase
 * resolves the real session — never guesses signed-out prematurely) and on
 * explicit sign-out.
 *   • guest → signed-in : items carry over ONLY until the server is consulted
 *                         (fresh account with no saved cart → guest items are
 *                         adopted & persisted; saved cart → server wins)
 *   • uid A → uid B     : A's items wiped; B's own cart restored (local mirror
 *                         instantly, then B's Firestore document — fresh
 *                         account → EMPTY, never any of A's items)
 *   • uid  → signed out : visible cart wiped so the next visitor starts clean
 *                         (the account's saved cart REMAINS in the DB)
 *   • same uid nav/load : NOTHING runs — the locally saved cart (already
 *                         painted from kpr_cart) is left untouched. A server
 *                         reconcile here used to clobber the just-added items
 *                         whose fire-and-forget write was killed by the page
 *                         navigation ("cart resets on Profile visit" bug).
 */
function applyCartOwnership(user) {
  const uid = (user && user.uid) ? user.uid : '';
  let owner = '';
  try {
    owner = localStorage.getItem(CART_OWNER_KEY) || '';
  } catch (e) {
    return; // private-mode storage — leave the in-memory cart untouched
  }

  const accountChanged = (owner !== uid);
  if (accountChanged) {
    if (uid && owner && owner !== uid) {
      // Account switch: drop the previous user's cart, restore this account's
      // own local mirror instantly (server doc reconciles right after).
      cart = [];
      try {
        const saved = localStorage.getItem(userCartKey(uid));
        if (saved) cart = JSON.parse(saved) || [];
      } catch (e) {
        cart = [];
      }
      console.log('[Cart] Account switch ' + owner + ' → ' + uid + ': restored ' + cart.length + ' item(s) for the new account.');
    } else if (!uid && owner) {
      // Logged out: the shared 'kpr_cart' slot must not leak the old account's
      // items to the next guest. The private kpr_cart_user_<owner> copy stays
      // intact and the owner's Firestore cart persists server-side, so signing
      // back in restores their own cart everywhere.
      cart = [];
      console.log('[Cart] Signed out — visible cart cleared for the next visitor.');
    }
    // else: guest signed IN with no prior owner stamp — current cart simply
    // carries over; the reconcile below adopts or replaces it per the DB.

    // Update the LOCAL slots instantly (mirror UX) but deliberately NOT via
    // saveCartToStorage(): no server write may race ahead of the reconcile
    // fetch below, or an empty fresh-device state would clobber the account's
    // saved server cart. reconcileUserCartWithServer() persists the final
    // authoritative cart once the server doc has been consulted.
    try {
      localStorage.setItem('kpr_cart', JSON.stringify(cart));
      localStorage.setItem(CART_OWNER_KEY, uid);
      if (uid) localStorage.setItem(userCartKey(uid), JSON.stringify(cart));
    } catch (e) {
      console.error('[Cart] ✗ Failed to update local cart slots:', e);
    }
    updateCartUI();
  }

  // Fetch the DB cart ONLY on a genuine auth change (first sign-in / account
  // switch) — never on ordinary route navigation with the same account, so
  // navigating to the Profile dashboard can never reset the live cart.
  if (accountChanged && uid) reconcileUserCartWithServer(uid);
}

function addProductToCart(productId) {
  const products = getProducts();
  const prod = products.find(p => p.id === productId);
  if (!prod || !prod.inStock) return;
  
  const catalogQty = parseInt(document.getElementById(`catalog-qty-${productId}`)?.innerText) || 0;
  const addQty = catalogQty > 0 ? catalogQty : 1;
  
  const existing = cart.find(item => item.id === productId);
  if (existing) {
    existing.quantity = catalogQty > 0 ? catalogQty : existing.quantity + 1;
  } else {
    cart.push({
      id: prod.id,
      name: prod.name,
      price: prod.price,
      quantity: addQty,
      categoryId: prod.categoryId,
      image: prod.image
    });
  }
  
  if (catalogQty === 0) {
    // Sync the catalog counter to 1 if it was 0
    const qtyLabel = document.getElementById(`catalog-qty-${productId}`);
    if (qtyLabel) qtyLabel.innerText = 1;
  }
  
  saveCartToStorage();
  updateCartUI();
  // Toast disabled: silent add to cart (no popup)
}

function updateCartItemQuantity(productId, newQty) {
  const existing = cart.find(item => item.id === productId);
  // Free-gift lines have no quantity controls — reject external edits.
  if (existing && isGiftCartItem(existing)) return;
  if (existing) {
    if (newQty === 0) {
      cart = cart.filter(item => item.id !== productId);
    } else {
      existing.quantity = newQty;
    }
  } else if (newQty > 0) {
    const products = getProducts();
    const prod = products.find(p => p.id === productId);
    if (prod) {
      cart.push({
        id: prod.id,
        name: prod.name,
        price: prod.price,
        quantity: newQty,
        categoryId: prod.categoryId,
        image: prod.image
      });
    }
  }
  
  saveCartToStorage();
  updateCartUI();
}

function removeCartItem(productId) {
  // Free-gift lines are non-removable (the drawer hides their Delete button;
  // this guards any other caller too).
  const target = cart.find(i => String(i.id) === String(productId));
  if (target && isGiftCartItem(target)) {
    if (typeof showToast === 'function') showToast('Free Gift items cannot be removed from the cart.', 'info');
    return;
  }
  cart = cart.filter(item => item.id !== productId);
  saveCartToStorage();
  updateCartUI();
  
  // Sync every on-screen catalog control for this product
  syncProductAction(productId);
  // Toast disabled: silent item removal (no popup)
}

function calculateSubtotal() {
  return cart.reduce((total, item) => total + (item.price * item.quantity), 0);
}

/**
 * Resolve a cart item's categoryId to a 1-based number for placeholder styling.
 * Supports the current alphanumeric model (letter IDs like "A" -> 1, "B" -> 2)
 * and any legacy numeric IDs. Falls back to 1 for unknown values so the
 * placeholder class is never "p-bg-NaN".
 * @param {string|number} categoryId
 * @returns {number}
 */
function getCartItemCategoryNumber(categoryId) {
  if (typeof categoryId === 'number' && Number.isFinite(categoryId)) {
    return categoryId;
  }
  const str = String(categoryId || '').trim().toUpperCase();
  if (/^[A-Z]$/.test(str)) {
    return str.charCodeAt(0) - 64; // 'A' -> 1, 'B' -> 2, ...
  }
  const num = parseInt(str, 10);
  return Number.isFinite(num) ? num : 1;
}

function updateCartUI() {
  const cartCountElem = document.getElementById('cart-count');
  const cartTotalElem = document.getElementById('cart-total');
  const container = document.getElementById('cart-items-container');
  const drawerSubtotal = document.getElementById('drawer-subtotal');
  const minOrderAlert = document.getElementById('min-order-alert');
  const minOrderRem = document.getElementById('min-order-remaining');
  const checkoutBtn = document.getElementById('checkout-btn');
  
  const subtotal = calculateSubtotal();
  const itemCount = cart.reduce((sum, item) => sum + item.quantity, 0);
  
  // Navbar widget count update
  if (cartCountElem) cartCountElem.innerText = itemCount;
  if (cartTotalElem) cartTotalElem.innerText = `₹${subtotal.toLocaleString()}`;
  if (drawerSubtotal) drawerSubtotal.innerText = `₹${subtotal.toLocaleString()}`;

  // Empty-cart notice above the enquiry form (enquiry/contact pages only):
  // visible when the cart is empty, hidden as soon as it has items.
  const emptyCartNotice = document.getElementById('empty-cart-notice');
  if (emptyCartNotice) emptyCartNotice.style.display = itemCount === 0 ? 'block' : 'none';
  
  // Keep the Order Summary card in sync with cart changes
  populateOrderSummaryFromCart();
  
  // Clear drawer list
  if (!container) return;
  container.innerHTML = '';
  
  if (cart.length === 0) {
    container.innerHTML = `
      <div class="empty-cart-message">
        <span class="empty-cart-icon"><i class="fa-solid fa-cart-shopping"></i></span>
        <p>Your cart is empty!</p>
        <p class="sub-text">Add at least ₹${MINIMUM_ORDER_VALUE.toLocaleString()} worth of firecrackers to place an enquiry.</p>
        <button class="btn btn-primary" onclick="toggleCartDrawer()">Continue Shopping</button>
      </div>
    `;
    
    // AUTO-RESET COUPONS when cart is emptied: clear applied coupons from localStorage
    clearCouponStack();
    renderAppliedCouponsList();
    
    if (minOrderAlert) minOrderAlert.classList.remove('active');
    if (checkoutBtn) checkoutBtn.disabled = true;
    
    // Sync all product card action buttons to ADD state when cart is emptied
    const allProducts = getProducts();
    allProducts.forEach(prod => syncProductAction(prod.id));
    
    return;
  }
  
  // Render cart items — free gifts pinned to index 0 (display order only;
  // in-memory cart keeps its natural add order for merge/qty logic).
  cartWithGiftsFirst().forEach(item => {
    const itemRow = document.createElement('div');

    // ---- SPIN WHEEL FREE GIFT CARD (compact gradient row, no qty/delete/price) ----
    if (isGiftCartItem(item)) {
      itemRow.className = 'cart-item cart-gift-item';

      // Real product photo inside the standard thumbnail plate (80×56);
      // onerror swaps to the hidden FA gift fallback so a broken URL can
      // never leave an empty box in the banner.
      let giftImgContent;
      if (item.image) {
        giftImgContent = `
          <div class="cart-gift-thumb">
            <img src="${item.image}" alt="${item.name}" class="cart-gift-img"
                 onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';">
            <span class="cart-gift-thumb-fallback" aria-hidden="true"><i class="fa-solid fa-gift"></i></span>
          </div>`;
      } else {
        giftImgContent = `
          <div class="cart-gift-thumb">
            <span class="cart-gift-thumb-fallback shown" aria-hidden="true"><i class="fa-solid fa-gift"></i></span>
          </div>`;
      }

      itemRow.innerHTML = `
        ${giftImgContent}
        <div class="cart-gift-info">
          <h4 class="cart-gift-name">${item.name}</h4>
          <span class="cart-gift-badge animate-gift-shine"><i class="fa-solid fa-gift" aria-hidden="true"></i> SPIN WHEEL FREE GIFT</span>
        </div>
        <div class="cart-gift-right">
          <span class="cart-gift-unlocked">Unlocked</span>
        </div>
      `;
      container.appendChild(itemRow);
      return;
    }

    // ---- REGULAR PRODUCT CART ITEM ----
    itemRow.className = 'cart-item';
    
    const bgIndex = (getCartItemCategoryNumber(item.categoryId) % 9) + 1;
    const emojiMap = { 1: '<i class="fa-solid fa-tornado"></i>', 2: '<i class="fa-solid fa-volcano"></i>', 3: '<i class="fa-solid fa-fountain"></i>', 4: '<i class="fa-solid fa-pencil"></i>', 5: '<i class="fa-solid fa-wand-magic-sparkles"></i>', 6: '<i class="fa-solid fa-bomb"></i>', 7: '<i class="fa-solid fa-rocket"></i>', 8: '<i class="fa-solid fa-bolt"></i>', 9: '<i class="fa-solid fa-gift"></i>' };
    const emoji = emojiMap[bgIndex] || '<i class="fa-solid fa-fire"></i>';
    
let cartImgContent = `<div class="cart-item-img-placeholder p-bg-${bgIndex}">${emoji}</div>`;
    if (item.image) {
      cartImgContent = `<img src="${item.image}" alt="${item.name}" style="width: 80px; aspect-ratio: 18 / 13; object-fit: contain; border-radius: var(--radius-sm); flex-shrink: 0; border: 1px solid var(--border-color);">`;
    }

    itemRow.innerHTML = `
      ${cartImgContent}
      <div class="cart-item-details">
        <h4 class="cart-item-name">${item.name}</h4>
        <span class="cart-item-price">₹${item.price} x ${item.quantity}</span>
      </div>
      <div class="cart-item-actions">
        <button class="cart-item-delete" onclick="removeCartItem('${item.id}')">Delete</button>
        <div class="qty-counter">
          <button class="qty-btn minus" onclick="adjustDrawerQty('${item.id}', -1)">-</button>
          <span class="qty-number">${item.quantity}</span>
          <button class="qty-btn plus" onclick="adjustDrawerQty('${item.id}', 1)">+</button>
        </div>
      </div>
    `;
    container.appendChild(itemRow);
  });
  
  // Minimum Order checks
  if (subtotal < MINIMUM_ORDER_VALUE) {
    if (minOrderAlert) {
      minOrderAlert.classList.add('active');
      if (minOrderRem) minOrderRem.innerText = `₹${(MINIMUM_ORDER_VALUE - subtotal).toLocaleString()}`;
    }
    if (checkoutBtn) checkoutBtn.disabled = true;
  } else {
    if (minOrderAlert) minOrderAlert.classList.remove('active');
    if (checkoutBtn) checkoutBtn.disabled = false;
  }
  
  // Sync all product card action buttons to reflect current cart state
  cart.forEach(item => syncProductAction(item.id));
}

function adjustDrawerQty(prodId, change) {
  const item = cart.find(i => i.id === prodId);
  if (!item) return;
  
  const newQty = item.quantity + change;
  updateCartItemQuantity(prodId, newQty);
  
  // Sync every on-screen catalog control for this product
  syncProductAction(prodId);
}

// Expose cart mutation handlers on window so inline onclick attributes resolve
// reliably (and to guard against any future move to module scope). The aliases
// map the conventional API names to this project's actual function names.
if (typeof window !== 'undefined') {
  window.adjustDrawerQty = adjustDrawerQty;
  window.removeCartItem = removeCartItem;
  window.updateCartItemQuantity = updateCartItemQuantity;
  window.addProductToCart = addProductToCart;
  // Conventional aliases
  window.changeCartQty = adjustDrawerQty;
  window.updateCartQuantity = updateCartItemQuantity;
  window.removeFromCart = removeCartItem;
}

/**
 * Cart drawer CTA — "Place Order Enquiry".
 * Gate order:
 *   1. Minimum-order validation (below-minimum orders shake + block, unchanged).
 *   2. MANDATORY Firebase sign-in through the KPR Client Portal.
 * Browsing and "Add to Cart" stay open to everyone; only this checkout exit
 * point (and the Quick Enquiry submit) requires a signed-in client.
 */
function checkoutCart() {
  // Check if below minimum order - trigger shake and block
  const checkoutBtn = document.getElementById('checkout-btn');
  if (checkoutBtn && checkoutBtn.disabled) {
    triggerMinimumOrderShake();
    showToast(`Please add more crackers to reach the minimum order of ₹${MINIMUM_ORDER_VALUE.toLocaleString()}!`, 'error');
    return;
  }

  // Gate 2: require an authenticated client. When nobody is signed in,
  // requireAuthForOrder() parks this callback in window.pendingOrderSubmit and
  // opens the portal modal; the callback runs automatically after sign-in.
  requireAuthForOrder(proceedToCheckoutFlow);
}

/**
 * The actual checkout hand-off. Only ever called once the customer is
 * authenticated (either already signed in, or straight after the portal
 * sign-in succeeds via window.pendingOrderSubmit).
 */
function proceedToCheckoutFlow() {
  toggleCartDrawer();

  // Cross-page: if the enquiry form isn't on this page, send the user to the
  // dedicated enquiry page. The cart is already persisted in localStorage, so
  // the order summary will populate there.
  if (!document.getElementById('enquiry-form')) {
    window.location.href = 'enquiry.html';
    return;
  }
  
  // NOTE: The enquiry message textarea is intentionally NOT pre-filled with a
  // cart summary. Cart products are persisted separately in the `cartItems`
  // array (and shown in the admin breakdown modal), so the `message` field must
  // contain ONLY the customer's own optional text.
  
  // Populate the Order Summary card with live cart calculations
  populateOrderSummaryFromCart();
  
  // Auto scroll to enquiry form
  const enquirySection = document.getElementById('quick-enquiry');
  if (enquirySection) enquirySection.scrollIntoView({ behavior: 'smooth' });
  showToast('Please fill in your details below to complete the enquiry!', 'info');
}

/* ==========================================================================
   Order Summary Calculation Engine
   Computes Total, Discounted Price (with weighted %), Non-Discounted Items,
   Spin Wheel placeholder, and Grand Total from the current cart state.
   ========================================================================== */

/**
 * Calculate the full financial breakdown from the current cart.
 * Returns an object with all computed values.
 */
function calculateOrderSummaryData() {
  const products = getProducts();
  let totalOriginal = 0;          // Sum of originalPrice × qty for ALL items
  let totalDiscounted = 0;        // Sum of price × qty for ALL items
  let totalSavings = 0;           // Sum of (originalPrice - price) × qty for discounted items
  let nonDiscountedTotal = 0;     // Sum of price × qty for items WITHOUT discount badge (final amount)
  let discountedItemCount = 0;    // Count of items that have a discount badge
  let totalDiscountPercentSum = 0; // Sum of discount percentages for weighted average

  cart.forEach(cartItem => {
    const prod = products.find(p => p.id === cartItem.id);
    if (!prod) return;

    const qty = cartItem.quantity;
    const origPrice = prod.originalPrice || prod.price;
    const discPrice = prod.price;
    const itemOriginalTotal = origPrice * qty;
    const itemDiscountedTotal = discPrice * qty;

    // Add to overall totals
    totalOriginal += itemOriginalTotal;
    totalDiscounted += itemDiscountedTotal;

// Check if this product has an active discount badge
    // Empty string or 'Special' means no discount
    const hasDiscount = prod.discount && String(prod.discount).trim() !== '' && prod.discount !== 'Special';

    if (hasDiscount) {
      // Calculate savings for this item
      const itemSavings = (origPrice - discPrice) * qty;
      totalSavings += itemSavings;
      discountedItemCount++;

      // Extract percentage from discount badge string e.g. "40% OFF" -> 40
      const percentMatch = String(prod.discount).match(/(\d+)/);
      if (percentMatch) {
        totalDiscountPercentSum += parseFloat(percentMatch[1]) * qty;
      }
    } else {
      // No discount badge — add to non-discounted total (use final price: price × qty)
      nonDiscountedTotal += itemDiscountedTotal;
    }
  });

  // Calculate weighted average discount percentage
  let overallPercent = 0;
  if (totalOriginal > 0) {
    // Weighted average: totalSavings / totalOriginal * 100
    overallPercent = Math.round((totalSavings / totalOriginal) * 100);
  }

  // Spin wheel placeholder (injectable later)
  let spinWheelDiscount = 0;

  // Coupon discount calculation - use multi-coupon system from coupon-stack.js
  const couponData = calculateCouponDiscounts ? calculateCouponDiscounts(totalOriginal, totalSavings) : { totalCouponCashDiscount: 0, effectiveCouponPercent: 0, appliedCoupons: [] };
  const couponDiscount = couponData.totalCouponCashDiscount;
  const couponPercent = couponData.effectiveCouponPercent;

  // Grand Total = Total - Total Savings - Spin Wheel Discount - Coupon Discount
  const grandTotal = totalOriginal - totalSavings - spinWheelDiscount - couponDiscount;

  return {
    totalOriginal,           // Sum of all original prices × qty
    totalDiscounted,         // Sum of all discounted prices × qty
    totalSavings,            // Absolute savings amount
    overallPercent,          // Weighted average discount % (integer)
    nonDiscountedTotal,      // Sum of non-discounted items (final price × qty)
    spinWheelDiscount,       // Placeholder (0)
    couponDiscount,          // Coupon discount amount (multi-coupon support)
    couponPercent,           // Coupon discount percentage (effective)
    grandTotal,               // Final payable amount
    appliedCoupons: couponData.appliedCoupons || [] // For UI rendering
  };
}

/* ==========================================================================
   COUPON CODE - Front-end Verification & Application
   Handles APPLY button click, validates against Firestore, and shows success UI.
   ========================================================================== */

/**
  * Apply coupon code to the current cart.
  * Validates against Firestore and shows success/error feedback.
  * Includes guard rails: empty cart check, minimum order amount validation, and duplicate prevention.
  */
function applyCoupon() {
  const couponInput = document.getElementById('coupon-input');
  const couponApplyBtn = document.getElementById('coupon-apply-btn');
  
  if (!couponInput) return;
  
  const code = couponInput.value.trim().toUpperCase();
  if (!code) {
    showToast('Please enter a coupon code.', 'error');
    return;
  }

  // === VALIDATION CHECK 0: Prevent Duplicate Coupon Stacking ===
  const appliedCouponsList = getAppliedCouponsList ? getAppliedCouponsList() : [];
  if (appliedCouponsList.find(c => c.code === code)) {
    showToast('This coupon code is already applied to this order summary!', 'error');
    return;
  }

  // === VALIDATION CHECK 1: Empty Cart Check ===
  if (cart.length === 0 || calculateSubtotal() <= 0) {
    showToast('Please add products to your cart first before applying a coupon code!', 'error');
    // Scroll to products section
    const productsSection = document.getElementById('products');
    if (productsSection) {
      productsSection.scrollIntoView({ behavior: 'smooth' });
    }
    return;
  }

  // === VALIDATION CHECK 2: Minimum Order Purchase Cap ===
  const orderSummary = calculateOrderSummaryData();
  const eligibleTotal = orderSummary.totalOriginal - orderSummary.totalSavings;
  
  if (eligibleTotal < MINIMUM_ORDER_VALUE) {
    showToast(`Minimum purchase amount required to use this coupon code is ₹${MINIMUM_ORDER_VALUE.toLocaleString()}.`, 'error');
    // Scroll to products section
    const productsSection = document.getElementById('products');
    if (productsSection) {
      productsSection.scrollIntoView({ behavior: 'smooth' });
    }
    return;
  }

  // Disable input during validation
  couponInput.disabled = true;
  couponApplyBtn.style.opacity = '0.6';
  couponApplyBtn.style.cursor = 'not-allowed';

  // Fetch coupons from Firestore and validate
  const validationPromise = window.db ? 
    loadCouponsFromFirestore() : 
    Promise.resolve(getCoupons ? getCoupons() : []);

  validationPromise.then(coupons => {
    const coupon = coupons.find(c => c.code === code);
    
    if (!coupon) {
      showToast('Invalid coupon code!', 'error');
      resetCouponInput();
      return;
    }
    
    if (!coupon.active) {
      showToast('This coupon is currently inactive.', 'error');
      resetCouponInput();
      return;
    }
    
    // Check validity date
    if (coupon.validUntil) {
      const validUntil = new Date(coupon.validUntil);
      if (validUntil < new Date()) {
        showToast('This coupon has expired.', 'error');
        resetCouponInput();
        return;
      }
    }
    
// Valid coupon - apply to stack and show success
    // Use applyCouponToStack to add to the multi-coupon stack
    applyCouponToStack(code, coupon.discountPercent);
    
    // Also set legacy key for backward compatibility with calculateOrderSummaryData
    localStorage.setItem('applied_coupon_code', code);
    
    // Render the stacked coupons container (green checkmark UI)
    renderAppliedCouponsList();
    
    populateOrderSummaryFromCart();
    
    // Re-enable coupon input for the next coupon code (duplicate check prevents same code)
    couponInput.disabled = false;
    couponInput.classList.add('coupon-applied');
    
    // Clear the input value after successful application
    couponInput.value = '';
    
    showToast(`Coupon ${code} applied successfully! ${coupon.discountPercent}% discount activated.`, 'success');
  }).catch(err => {
    console.error('[Coupon] Validation failed:', err);
    showToast('Could not verify coupon. Please try again.', 'error');
    resetCouponInput();
  });
}

/**
 * Reset coupon input after validation failure.
 */
function resetCouponInput() {
  const couponInput = document.getElementById('coupon-input');
  const couponApplyBtn = document.getElementById('coupon-apply-btn');
  
  if (couponInput) {
    couponInput.disabled = false;
    couponInput.value = '';
    couponInput.classList.remove('coupon-applied');
  }
  if (couponApplyBtn) {
    couponApplyBtn.style.opacity = '1';
    couponApplyBtn.style.cursor = 'pointer';
  }
}

/**
 * Initialize coupon apply button click handler.
 */
document.addEventListener('DOMContentLoaded', () => {
  const couponApplyBtn = document.getElementById('coupon-apply-btn');
  if (couponApplyBtn) {
    couponApplyBtn.addEventListener('click', applyCoupon);
  }
  
  // Also handle Enter key in coupon input
  const couponInput = document.getElementById('coupon-input');
  if (couponInput) {
    couponInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        applyCoupon();
      }
    });
  }
});

/**
 * Read current cart, compute order summary, and update the Order Summary card DOM.
 * Called by checkoutCart() and updateCartUI() to keep the card in sync.
 */
function populateOrderSummaryFromCart() {
  const data = calculateOrderSummaryData();

  // Update DOM elements
  const totalEl = document.getElementById('summary-total');
  const discountEl = document.getElementById('summary-discount');
  const discountBadge = document.querySelector('.discount-badge');
  const nonDiscountedEl = document.getElementById('summary-non-discounted');
  const spinWheelEl = document.getElementById('summary-spin-wheel');
  const grandTotalEl = document.getElementById('summary-grand-total');
  const couponDiscountEl = document.getElementById('summary-coupon-discount');
  const couponBadgeEl = document.getElementById('coupon-discount-badge');

  if (totalEl) totalEl.textContent = `₹${data.totalOriginal.toLocaleString()}`;

  if (discountEl) {
    discountEl.textContent = data.totalSavings > 0 ? `-₹${data.totalSavings.toLocaleString()}` : '-₹0';
  }

  // Update the discount badge with weighted average percentage
  if (discountBadge) {
    discountBadge.textContent = data.overallPercent > 0 ? `${data.overallPercent}% OFF` : '0% OFF';
  }

  if (nonDiscountedEl) {
    nonDiscountedEl.textContent = `₹${data.nonDiscountedTotal.toLocaleString()}`;
  }

  if (spinWheelEl) {
    // DYNAMIC SPIN GIFT NAME: show the exact won product's name (green pill
    // text, ellipsis-truncated) — or '--' when no reward sits in the cart.
    const spinGift = cart.find(isGiftCartItem);
    if (spinGift) {
      const giftName = spinGift.name || 'Free Gift';
      spinWheelEl.textContent = giftName;
      spinWheelEl.title = giftName;
      spinWheelEl.classList.add('summary-gift-name');
    } else {
      spinWheelEl.textContent = '--';
      spinWheelEl.removeAttribute('title');
      spinWheelEl.classList.remove('summary-gift-name');
    }
  }

  // Coupon discount display
  if (couponDiscountEl) {
    if (data.couponDiscount > 0) {
      couponDiscountEl.innerHTML = `<span style="color: #dc2626 !important; font-weight: 600;">-₹${data.couponDiscount.toLocaleString()}</span>`;
    } else {
      couponDiscountEl.textContent = '—';
    }
  }
  if (couponBadgeEl) {
    couponBadgeEl.style.display = data.couponDiscount > 0 ? 'inline-block' : 'none';
    if (data.couponDiscount > 0) {
      couponBadgeEl.textContent = `${data.couponPercent}% OFF`;
    }
  }

  if (grandTotalEl) {
    grandTotalEl.textContent = `₹${data.grandTotal.toLocaleString()}`;
  }

  // Render the applied coupons list (green checkmark container) for hydration
  renderAppliedCouponsList();

   // === DYNAMIC SUBMIT BUTTON STATE (POST-COUPON VALUE) ===
   // Evaluate submit button state based on FINAL grandTotal after coupons
   const submitBtn = document.getElementById('enquiry-submit-btn');
   const warningBox = document.getElementById('order-summary-warning');
   
   // Check if coupon is applied (any coupon in the stack)
   const appliedCoupons = getAppliedCouponsList ? getAppliedCouponsList() : [];
   const isCouponApplied = appliedCoupons.length > 0;
   
   // Calculate short amount dynamically
   const shortAmount = MINIMUM_ORDER_VALUE - data.grandTotal;
   
   // === PRECISE WARNING RENDER CONDITIONS ===
   // Calculate subtotal for precise warning logic
   const cartSubtotal = data.totalOriginal - data.totalSavings;
   
  // 1. BASE CASE: Cart Subtotal itself is below minimum
  if (cartSubtotal < MINIMUM_ORDER_VALUE) {
    // Disable submit button
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.classList.add('btn-disabled');
    }
    
     // Render ONLY the standard baseline warning box (Hide the coupon drop message entirely)
     const warningTextEl = document.querySelector('#order-summary-warning .warning-text');
     if (warningTextEl) {
       warningTextEl.textContent = `Minimum order required: ₹${MINIMUM_ORDER_VALUE.toLocaleString()}. Add ₹${(MINIMUM_ORDER_VALUE - cartSubtotal).toLocaleString()} more.`;
     }
    
    // Show warning box
    if (warningBox) {
      warningBox.style.display = 'flex';
    }
  } 
  // 2. COUPON DROP CASE: Subtotal was valid (>=minimum) BUT Coupon applied drops Grand Total below minimum
  else if (cartSubtotal >= MINIMUM_ORDER_VALUE && data.grandTotal < MINIMUM_ORDER_VALUE) {
    // Disable submit button
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.classList.add('btn-disabled');
    }
    
    // Render ONLY this premium drop message warning box
    const warningTextEl = document.querySelector('#order-summary-warning .warning-text');
    if (warningTextEl) {
      warningTextEl.textContent = `Oops! Your final total dropped to ₹${data.grandTotal.toLocaleString()} after the coupon discount. Please add ₹${(MINIMUM_ORDER_VALUE - data.grandTotal).toLocaleString()} more worth of crackers to complete your order!`;
    }
    
    // Show warning box
    if (warningBox) {
      warningBox.style.display = 'flex';
    }
  } else {
    // Enable submit button and hide warning box
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.classList.remove('btn-disabled');
    }
    if (warningBox) {
      warningBox.style.display = 'none';
    }
  }
  
  // === SYNC WARNING TO CART DRAWER SIDEBAR ===
  updateCartDrawerWarning(data.grandTotal, data.couponDiscount, isCouponApplied);
}

/**
 * Update the cart drawer sidebar with grand total and coupon warning.
 * Uses dynamic state-based minimum order validation.
 */
function updateCartDrawerWarning(grandTotal, couponDiscount, isCouponApplied) {
  const drawerSubtotal = document.getElementById('drawer-subtotal');
  const drawerCouponRow = document.getElementById('cart-coupon-row');
  const drawerCouponDiscount = document.getElementById('drawer-coupon-discount');
  const drawerGrandTotalRow = document.getElementById('cart-grand-total-row');
  const drawerGrandTotal = document.getElementById('drawer-grand-total');
  const cartTotal = document.getElementById('cart-total');
  const minOrderAlert = document.getElementById('min-order-alert');
  const checkoutBtn = document.getElementById('checkout-btn');

  // Calculate subtotal from cart
  const subtotal = calculateSubtotal();
  const minLimit = getCurrentMinLimit();
  
  // Update cart subtotal in header and drawer
  if (drawerSubtotal) drawerSubtotal.textContent = `₹${subtotal.toLocaleString()}`;
  
   // === CONDITIONAL RENDERING ===
   // State A: No coupon applied - only show Cart Subtotal
   // State B: Coupon applied - show Coupon Applied row + Grand Total
   if (couponDiscount && couponDiscount > 0) {
     // COUPON APPLIED STATE
     if (drawerCouponRow) drawerCouponRow.style.display = 'flex';
     if (drawerCouponDiscount) drawerCouponDiscount.innerHTML = `<span style="color: #dc2626 !important; font-weight: 600;">-₹${couponDiscount.toLocaleString()}</span>`;
    
    // Show Grand Total row
    if (drawerGrandTotalRow) drawerGrandTotalRow.style.display = 'flex';
    if (drawerGrandTotal) drawerGrandTotal.textContent = `₹${grandTotal.toLocaleString()}`;
    
    // Update top navbar cart total to show grand total
    if (cartTotal) cartTotal.textContent = `₹${grandTotal.toLocaleString()}`;
  } else {
    // NO COUPON STATE
    // Hide Coupon Applied and Grand Total rows
    if (drawerCouponRow) drawerCouponRow.style.display = 'none';
    if (drawerGrandTotalRow) drawerGrandTotalRow.style.display = 'none';
    
    // Update top navbar cart total to show subtotal
    if (cartTotal) cartTotal.textContent = `₹${subtotal.toLocaleString()}`;
  }

  // === SINGLE WARNING BOX LOGIC (using min-order-alert) ===
  // Ensure ONLY ONE warning box displays at any given time
  if (minOrderAlert) {
    // Use a wrapper span for the icon + text to avoid duplicate emoji
    const buildWarningHTML = (text) => `<img src="./assets/img/icons/warning.png" alt="Warning" class="warning-icon-img"><span>${text}</span>`;
    
    // 1. BASE CASE: Cart Subtotal itself is below minLimit
    if (subtotal < minLimit) {
      // Render ONLY the standard baseline warning box
      minOrderAlert.style.display = 'flex';
      minOrderAlert.innerHTML = buildWarningHTML(`Minimum order required: ₹${minLimit.toLocaleString()}. Add ₹${(minLimit - subtotal).toLocaleString()} more.`);
      if (checkoutBtn) checkoutBtn.disabled = true;
    } 
    // 2. COUPON DROP CASE: Subtotal was valid (>= minLimit) BUT Coupon applied drops Grand Total below minLimit
    else if (subtotal >= minLimit && grandTotal < minLimit) {
      // Render ONLY this premium drop message warning box
      minOrderAlert.style.display = 'flex';
      minOrderAlert.innerHTML = buildWarningHTML(`Oops! Your final total dropped to ₹${grandTotal.toLocaleString()} after the coupon discount. Please add ₹${(minLimit - grandTotal).toLocaleString()} more worth of crackers to complete your order!`);
      if (checkoutBtn) checkoutBtn.disabled = true;
    } else {
      // No warning - hide the box
      minOrderAlert.style.display = 'none';
      if (checkoutBtn) checkoutBtn.disabled = false;
    }
  }
}

/**
 * Trigger shake animation on the warning box when user attempts to submit
 * while grandTotal is below minimum order value.
 */
function triggerMinimumOrderShake() {
  const warningBox = document.getElementById('order-summary-warning');
  if (!warningBox || warningBox.style.display === 'none') return;
  
  warningBox.classList.add('order-summary-shake');
  setTimeout(() => {
    warningBox.classList.remove('order-summary-shake');
  }, 300);
}

/**
 * Render the applied coupons list (green checkmark container) from localStorage.
 * This ensures the UI syncs correctly on page refresh (hydration fix).
 */
function renderAppliedCouponsList() {
  const container = document.getElementById('coupon-stacked-container');
  if (!container) return;
  
  // Get applied coupons from localStorage
  const appliedCoupons = getAppliedCouponsList ? getAppliedCouponsList() : [];
  
  // Clear container
  container.innerHTML = '';
  
  // If no coupons, hide container
  if (appliedCoupons.length === 0) {
    container.style.display = 'none';
    return;
  }
  
  // Show container
  container.style.display = 'block';
  
  // Render each applied coupon as a green checkmark item
  appliedCoupons.forEach(coupon => {
    const item = document.createElement('div');
    item.className = 'coupon-stack-item';
    item.innerHTML = `
      <span class="coupon-code-name">${escapeHtml(coupon.code)}</span>
      <span class="coupon-checkmark"><i class="fa-solid fa-check"></i></span>
    `;
    container.appendChild(item);
  });
}

/**
 * Reset all coupon-related UI state to initial values.
 * Called after successful enquiry submission to clear the coupon display.
 */
function resetCouponState() {
  // Remove applied coupons from localStorage
  clearCouponStack();
  
  // Reset coupon input field
  const couponInput = document.getElementById('coupon-input');
  if (couponInput) {
    couponInput.value = '';
    couponInput.disabled = false;
    couponInput.classList.remove('coupon-applied');
  }
  
  // Hide the stacked container
  const stackedContainer = document.getElementById('coupon-stacked-container');
  if (stackedContainer) {
    stackedContainer.innerHTML = '';
    stackedContainer.style.display = 'none';
  }
  
  // Reset coupon discount row to default state
  const couponDiscountEl = document.getElementById('summary-coupon-discount');
  const couponBadgeEl = document.getElementById('coupon-discount-badge');
  if (couponDiscountEl) {
    couponDiscountEl.textContent = '—';
  }
  if (couponBadgeEl) {
    couponBadgeEl.style.display = 'none';
  }
}

/* ==========================================================================
   7. Enquiry Form submission
   ========================================================================== */
/**
 * Modern order-success popup (osm-* markup injected by components.js).
 * Shows Order ID, submission Date & Time and the order Total — payment
 * method intentionally excluded — then "Go to my account" → dashboard.
 */
function openSuccessModal(orderId, grandTotal) {
  const overlay = document.getElementById('success-modal-overlay');
  if (!overlay) return;

  // Order ID cell (e.g. KPR-2026-8492)
  const orderIdEl = document.getElementById('success-modal-order-id');
  if (orderIdEl) orderIdEl.textContent = orderId || 'Pending';

  // Date & Time — captured NOW, at the success moment
  const dtEl = document.getElementById('success-modal-datetime');
  if (dtEl) {
    dtEl.textContent = new Date().toLocaleString('en-IN', {
      day: '2-digit', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit'
    });
  }

  // Total cell (₹ formatted, Indian digit grouping)
  const totalEl = document.getElementById('success-modal-total');
  if (totalEl) {
    const amount = Number(grandTotal || 0);
    totalEl.textContent = '\u20B9' + amount.toLocaleString('en-IN');
  }

  overlay.classList.add('open');
  overlay.setAttribute('aria-hidden', 'false');

  // Optional: prevent background scroll while modal is open
  document.body.classList.add('success-modal-active');

  const okBtn = document.getElementById('success-modal-ok');
  if (okBtn) okBtn.focus();

  // Wire close handlers once (idempotent)
  if (!overlay.dataset.handlersBound) {
    overlay.dataset.handlersBound = 'true';

    // "Go to my account" — dismiss, then land on the client dashboard
    // (renders the guest layout automatically when the session is signed out)
    if (okBtn) {
      okBtn.addEventListener('click', (evt) => {
        evt.preventDefault();
        closeSuccessModal();
        window.location.href = 'dashboard.html';
      });
    }

    // Click on backdrop closes modal, but clicks inside the card should not
    overlay.addEventListener('click', (evt) => {
      const card = overlay.querySelector('.success-modal');
      if (!card) return;
      const clickedInside = card.contains(evt.target);
      if (!clickedInside) closeSuccessModal();
    });

    // Escape key closes modal
    document.addEventListener('keydown', (evt) => {
      if (evt.key === 'Escape') closeSuccessModal();
    });
  }
}

function closeSuccessModal() {
  const overlay = document.getElementById('success-modal-overlay');
  if (!overlay) return;

  overlay.classList.remove('open');
  overlay.setAttribute('aria-hidden', 'true');

  document.body.classList.remove('success-modal-active');
}

function triggerSuccessConfetti() {
  // canvas-confetti is loaded via CDN on every storefront page
  try {
    if (typeof window.confetti !== 'function') return;

    const festive = ['#FFC107', '#004d40', '#d32f2f', '#ffffff', '#0B7A3E'];
    window.confetti({ particleCount: 150, spread: 80, origin: { y: 0.6 }, colors: festive });
    // Twin side cannons for the celebratory "burst" feel
    setTimeout(() => {
      try {
        window.confetti({ particleCount: 80, angle: 60, spread: 55, origin: { x: 0, y: 0.7 }, colors: festive });
        window.confetti({ particleCount: 80, angle: 120, spread: 55, origin: { x: 1, y: 0.7 }, colors: festive });
      } catch (e) { /* cosmetic only */ }
    }, 180);
  } catch (e) {
    // Fail silently if confetti script is blocked/unavailable
  }
}

function initEnquiryForm() {
  const form = document.getElementById('enquiry-form');
  // Enquiry form only exists on some pages — return quietly elsewhere.
  if (!form) return;
  
  console.log('[Enquiry] Form found. Attaching submit handler...');
  
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    console.log('[Enquiry] Form submitted.');
    
  // Check if grandTotal is below minimum - trigger shake animation and block submission
  const enquirySubmitBtn = document.getElementById('enquiry-submit-btn');
  if (enquirySubmitBtn && enquirySubmitBtn.disabled) {
    console.log('[Enquiry] Submit blocked: grandTotal below minimum');
    triggerMinimumOrderShake();
    showToast(`Please add more crackers to reach the minimum order of ₹${MINIMUM_ORDER_VALUE.toLocaleString()}!`, 'error');
    return;
  }
    
      // ======================================================================
      // MANDATORY SIGN-IN (KPR Client Portal)
      // Everything that persists the enquiry lives inside this closure. When the
      // visitor is anonymous, requireAuthForOrder() parks it in
      // window.pendingOrderSubmit, opens the portal modal, and replays the exact
      // same submission as soon as sign-in / account creation succeeds — so no
      // form data or cart contents are ever lost.
      // ======================================================================
      const submitEnquiryToFirestore = () => {
      const name = document.getElementById('enquiry-name')?.value.trim();
      const phone = document.getElementById('enquiry-phone')?.value.trim();
      const address = document.getElementById('enquiry-delivery-address')?.value.trim();
      const pincode = document.getElementById('enquiry-pincode')?.value.trim();
      // Capture the selected state name from the dropdown
      const stateSelect = document.getElementById('enquiry-state');
      let selectedStateName = "";
      if (stateSelect && stateSelect.value) {
        // Extract state name from option text (remove " (Min. ₹...)" suffix if present)
        const selectedOption = stateSelect.options[stateSelect.selectedIndex];
        selectedStateName = selectedOption.text.split('(')[0].trim() || stateSelect.value;
      }
      // Default fallback to "Tamil Nadu" if state is empty/undefined
      const state = selectedStateName || "Tamil Nadu";
      // Optional enquiry message field
      const enquiryMessage = document.getElementById('enquiry-message')?.value.trim() || "";
      // Optional contact email (auto-filled from the signed-in KPR account)
      const enquiryEmail = document.getElementById('enquiry-email')?.value.trim() || "";

      console.log('[Enquiry] Data:', { name, phone, email: enquiryEmail, address, pincode, state, enquiryMessage });
    
    const submitBtn = form.querySelector('button[type="submit"]');
    const originalBtnText = submitBtn ? submitBtn.innerText : '';
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.innerText = 'Submitting...';
    }
    
    // SAFETY TIMEOUT: Set IMMEDIATELY after disabling the button, BEFORE any
    // code that could throw synchronously (e.g. firebase.firestore.FieldValue
    // access, payload construction). This guarantees the button ALWAYS resets,
    // preventing the infinite "Submitting..." state.
    const safetyTimeout = setTimeout(() => {
      console.warn('[Enquiry] ⚠ Safety timeout fired after 30s. Resetting button forcefully.');
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.innerText = originalBtnText;
      }
    }, 30000);
    
    if (!window.db) {
      clearTimeout(safetyTimeout);
      console.error('[Enquiry] ✗ window.db is NULL. Firestore not initialized.');
      alert('Sorry, the enquiry service is temporarily unavailable. Please reach us on WhatsApp.');
      showToast('Enquiry service unavailable. Please try again later.', 'error');
      if (submitBtn) { submitBtn.disabled = false; submitBtn.innerText = originalBtnText; }
      return;
    }
    
    console.log('[Enquiry] window.db is available. Writing to Firestore...');
    
    // Wrap payload construction in try-catch to handle synchronous errors
    // (e.g. firebase.firestore.FieldValue.serverTimestamp() throwing if SDK
    //  is partially loaded). Without this, the error propagates uncaught and
    //  the button stays stuck on "Submitting..." forever.
    try {
      // Compute the latest financial breakdown from the current cart state
      const orderSummary = calculateOrderSummaryData();
      
      // Build cart items array with product details
      const products = getProducts();
      const cartItemsPayload = cart.map(cartItem => {
        const prod = products.find(p => p.id === cartItem.id);
        return {
          productId: cartItem.id,
          productName: cartItem.name,
          quantity: cartItem.quantity,
          unitPrice: cartItem.price,
          originalUnitPrice: prod ? (prod.originalPrice || prod.price) : cartItem.price,
          totalPrice: cartItem.price * cartItem.quantity,
          totalOriginalPrice: prod ? ((prod.originalPrice || prod.price) * cartItem.quantity) : (cartItem.price * cartItem.quantity),
          discountBadge: prod ? (prod.discount || '') : '',
          categoryId: cartItem.categoryId
        };
      });
      
      // Generate a clean branded Order ID (e.g. KPR-2026-8492) for this enquiry.
      // The same ID is passed to saveEnquiryToFirestore (which keeps it if present)
      // and to the success modal so the customer sees their reference number.
      const generatedOrderId = (typeof generateUniqueOrderId === 'function')
        ? generateUniqueOrderId()
        : ('KPR-' + new Date().getFullYear() + '-' + Math.floor(1000 + Math.random() * 9000));
      
      const authUser = getKprAuthUser();

      // Build the structured payload with ALL Order Summary fields
      const enquiryPayload = {
        // Branded Order ID (e.g. KPR-2026-8492)
        orderId: generatedOrderId,
        // Customer Details
        customer: {
          name,
          phone,
          address,
          pincode,
          state,
          // Firebase Auth identity of the signed-in client (mandatory at checkout)
          userId: authUser ? authUser.uid : '',
          // Customer-typed email wins; otherwise the Firebase identity email
          // (for mobile-number accounts this is the mapped <number>@kprcrackers.com)
          email: enquiryEmail || (authUser ? (authUser.email || '') : '')
        },
        // Cart Items Array
        cartItems: cartItemsPayload,
        // Final Financial Breakdown (Total, Discounted Price %, Non-Discounted Sum, Grand Total, Coupon)
        // Safe fallbacks ensure Firestore never receives undefined values
        financialBreakdown: {
          totalOriginal: orderSummary.totalOriginal || 0,
          totalDiscounted: orderSummary.totalDiscounted || 0,
          totalSavings: orderSummary.totalSavings || 0,
          overallDiscountPercent: orderSummary.overallPercent || 0,
          nonDiscountedTotal: orderSummary.nonDiscountedTotal || 0,
          spinWheelDiscount: orderSummary.spinWheelDiscount || 0,
          couponDiscount: orderSummary.couponDiscount || 0,
          couponPercent: orderSummary.couponPercent || 0,
          grandTotal: orderSummary.grandTotal || 0
        },
        // Enquiry Message (optional)
        enquiryMessage: enquiryMessage || "",
        // Status & Timestamp
        status: 'new',
        timestamp: firebase.firestore.FieldValue.serverTimestamp()
      };
      
      console.log('[Enquiry] Payload:', JSON.stringify(enquiryPayload, null, 2));
      
      // Save the enquiry into the Firestore "enquiries" collection via the
      // shared data-layer helper (attaches a server timestamp + default status).
      saveEnquiryToFirestore(enquiryPayload)
        .then((docId) => {
          clearTimeout(safetyTimeout);
          console.log('[Enquiry] ✓ Successfully written to Firestore. Doc ID:', docId);
          
          // Exit loading state IMMEDIATELY on success (before modal/confetti)
          if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.innerText = originalBtnText;
          }
          
          // Clear cart if enquiry was submitted from cart
          if (cart.length > 0) {
            cart = [];
            saveCartToStorage();
            updateCartUI();
            // Reset ALL product card UI to ADD button state (not just qty-number)
            const allProducts = getProducts();
            allProducts.forEach(prod => syncProductAction(prod.id));
          }
          
          form.reset();

          // Re-fill name / phone / email from the signed-in KPR account so the
          // next enquiry is pre-populated again after the reset above.
          hydrateEnquiryFormFromAuth(getKprAuthUser());

          // Reset coupon state along with cart and order summary
          resetCouponState();
          
          // Reset the Order Summary card to zero state after submission
          populateOrderSummaryFromCart();
          
          // Pop the modern success modal (Order ID, Date & Time, Total) and
          // fire the festive confetti burst together.
          openSuccessModal(generatedOrderId, orderSummary.grandTotal);
          
          // Trigger explosive festive confetti animation (fullscreen)
          triggerSuccessConfetti();
          
          // Smooth scroll ONLY to Premium Crackers catalog (no footer auto-scroll)
          const premiumAnchor = document.getElementById('premium-crackers');
          if (premiumAnchor) {
            setTimeout(() => {
              premiumAnchor.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }, 50);
          }
        })
        .catch((err) => {
          clearTimeout(safetyTimeout);
          console.error('[Enquiry] ✗ Firestore write FAILED:', err);
          console.error('[Enquiry] Error code:', err.code, 'Message:', err.message);
          alert('Sorry, something went wrong while submitting your enquiry. Please try again or contact us on WhatsApp.');
          showToast('Could not submit enquiry. Please try again.', 'error');
          
          // Reset button explicitly in .catch()
          if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.innerText = originalBtnText;
          }
        });
    } catch (syncErr) {
      // Catch synchronous errors during payload construction (e.g. if
      // firebase.firestore.FieldValue.serverTimestamp() throws because the
      // SDK is partially loaded). Without this catch block, the error
      // propagates uncaught and the button stays stuck on "Submitting..."
      // since the safety timeout was already set but the .add() promise
      // was never created, so .then()/.catch() never fire.
      clearTimeout(safetyTimeout);
      console.error('[Enquiry] ✗ Synchronous error during payload construction:', syncErr);
      alert('Sorry, something went wrong while submitting your enquiry. Please try again or contact us on WhatsApp.');
      showToast('Could not submit enquiry. Please try again.', 'error');
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.innerText = originalBtnText;
      }
    }
      }; // end submitEnquiryToFirestore()

      // The Firestore write is only reachable through the sign-in gate: an
      // anonymous visitor gets the KPR Client Portal instead of a submission.
      requireAuthForOrder(submitEnquiryToFirestore);
  });
}

/* ==========================================================================
   8. WhatsApp Widget Toggle & Actions
   ========================================================================== */
function toggleWhatsAppPopup() {
  const popup = document.getElementById('whatsapp-popup');
  popup.classList.toggle('active');
}

function initWhatsAppWidget() {
  const popupForm = document.getElementById('whatsapp-quick-form');
  if (!popupForm) return;
  
  popupForm.addEventListener('submit', (e) => {
    e.preventDefault();
    
    const name = document.getElementById('wa-name').value;
    const phone = document.getElementById('wa-phone').value;
    const msg = document.getElementById('wa-msg').value;
    
    // Generate a clean branded Order ID (e.g. KPR-2026-8492) for this WhatsApp
    // widget enquiry so it also appears with a clean reference in the admin panel.
    const waOrderId = (typeof generateUniqueOrderId === 'function')
      ? generateUniqueOrderId()
      : ('KPR-' + new Date().getFullYear() + '-' + Math.floor(1000 + Math.random() * 9000));
    
    // Build a structured payload matching the admin panel's enquiry schema
    // (customer object + message). This lets WhatsApp Quick Widget enquiries
    // appear in the admin dashboard exactly like full checkout enquiries.
    const enquiryPayload = {
      // Branded Order ID (e.g. KPR-2026-8492)
      orderId: waOrderId,
      customer: {
        name,
        phone,
        address: '',
        pincode: '',
        state: ''
      },
      category: 'whatsapp',
      message: `[Submitted via WhatsApp Quick Widget]:\n${msg}`,
      enquiryMessage: msg,
      cartItems: [],
      financialBreakdown: null,
      status: 'new'
    };

    // PRIMARY persistence: write directly to the Firestore "enquiries" collection.
    if (typeof saveEnquiryToFirestore === 'function' && window.db) {
      saveEnquiryToFirestore(enquiryPayload)
        .then((docId) => {
          console.log('[WhatsApp Enquiry] ✓ Saved to Firestore. Doc ID:', docId);
        })
        .catch((err) => {
          console.error('[WhatsApp Enquiry] ✗ Firestore save failed, kept local cache only:', err);
        });
    } else {
      console.warn('[WhatsApp Enquiry] Firestore unavailable — saving to local cache only.');
    }

    // OFFLINE CACHE fallback so the enquiry is never lost if Firestore is unreachable.
    const enquiries = getEnquiries();
    const newId = generateId(enquiries);
    const newEnquiry = {
      id: newId,
      name,
      phone,
      deliveryAddress: '',
      category: 'whatsapp',
      message: `[Submitted via WhatsApp Quick Widget]:\n${msg}`,
      date: new Date().toISOString(),
      status: 'new'
    };
    
    enquiries.push(newEnquiry);
    saveEnquiries(enquiries);
    
    // Create WhatsApp URL API link redirect
    const businessPhone = '919876543210';
const textMsg = encodeURIComponent(`Hi KPR Crackers! My name is ${name} (${phone}). I am interested in: ${msg}`);
    const whatsappUrl = `https://api.whatsapp.com/send?phone=${businessPhone}&text=${textMsg}`;
    
    // Reset form & close
    popupForm.reset();
    toggleWhatsAppPopup();
    showToast('Redirecting to WhatsApp chat... <i class="fa-solid fa-rocket"></i>', 'success');
    
    // Open new tab
    setTimeout(() => {
      window.open(whatsappUrl, '_blank');
    }, 1000);
  });
  
  // Close popup if clicking outside
  document.addEventListener('click', (e) => {
    const popup = document.getElementById('whatsapp-popup');
    const widget = document.getElementById('whatsapp-widget');
    if (popup.classList.contains('active') && !widget.contains(e.target)) {
      popup.classList.remove('active');
    }
  });
}

/* ==========================================================================
   9. Map Placeholder Interaction
   ========================================================================== */
function initContactMap() {
  const mapBox = document.querySelector('.styled-map-placeholder');
  if (!mapBox) return;
  
  mapBox.addEventListener('click', () => {
    const lat = '9.4533';
    const lon = '77.8024';
    const gmapsUrl = `https://www.google.com/maps/search/?api=1&query=${lat},${lon}`;
    window.open(gmapsUrl, '_blank');
  });
}

/* ==========================================================================
   10. Scroll & Active Navbar Highlights
   ========================================================================== */
function initPreloader() {
  const preloader = document.getElementById('preloader');
  if (!preloader) {
    document.body.classList.remove('preloader-active');
    return;
  }

  const MIN_DISPLAY_MS = 2000;   // extended 2s minimum so the local animation plays fully
  const SAFETY_TIMEOUT_MS = 6000; // never trap the user if the Lottie script/asset fails
  const start = Date.now();
  let hidden = false;

  const hide = () => {
    if (hidden) return;
    // A parked dashboard arrival holds the loader via data-dashboard-mask
    // until the dashboard paints — never let the normal timer release it.
    try {
      if (preloader.getAttribute('data-dashboard-mask') === '1') return;
    } catch (e) {}
    hidden = true;
    const elapsed = Date.now() - start;
    const wait = Math.max(0, MIN_DISPLAY_MS - elapsed);
    setTimeout(() => {
      preloader.classList.add('preloader-hidden');
      document.body.classList.remove('preloader-active');
      // Remove from DOM after the fade-out transition completes
      setTimeout(() => {
        if (preloader.parentNode) preloader.parentNode.removeChild(preloader);
      }, 700);
    }, wait);
  };

  // Primary trigger: everything (images, fonts, Lottie script) finished loading
  if (document.readyState === 'complete') {
    hide();
  } else {
    window.addEventListener('load', hide);
  }

  // Safety net: force-hide if load never fires
  setTimeout(hide, SAFETY_TIMEOUT_MS);
}

function initNavbarScroll() {
  const greenBar = document.querySelector('.green-top-bar') || document.querySelector('.top-bar');
  const navbar = document.querySelector('.main-header') || document.querySelector('header');
  const mainEl = document.querySelector('main');

  if (!greenBar || !navbar) return;

  const triggerHeight = greenBar.offsetHeight || 40;
  let isFixed = false;
  let spacerAdded = false;

  window.addEventListener('scroll', () => {
    if (window.scrollY >= triggerHeight) {
      if (!isFixed) {
        // Lock header to top of viewport (JS fallback for position:sticky broken by overflow-x:hidden)
        navbar.style.setProperty('position', 'fixed', 'important');
        navbar.style.setProperty('top', '0', 'important');
        navbar.style.setProperty('left', '0', 'important');
        navbar.style.setProperty('width', '100%', 'important');
        navbar.style.setProperty('z-index', '9999', 'important');
        navbar.style.setProperty('box-shadow', '0 6px 18px rgba(0, 0, 0, 0.16)', 'important');
        // Add spacer to prevent content jump
        if (!spacerAdded && mainEl) {
          const spacer = navbar.offsetHeight;
          document.body.style.paddingTop = spacer + 'px';
          spacerAdded = true;
        }
        isFixed = true;
      }
    } else {
      if (isFixed) {
        // Restore normal flow
        navbar.style.setProperty('position', 'sticky', 'important');
        navbar.style.removeProperty('box-shadow');
        if (spacerAdded) {
          document.body.style.removeProperty('padding-top');
          spacerAdded = false;
        }
        isFixed = false;
      }
    }
    highlightNavLink();
  }, { passive: true });
}

function highlightNavLink() {
  // While the Client Dashboard owns the page, the profile icon (not Home)
  // is the "active" marker — never let scroll-spy re-light the Home pill.
  if (typeof isAccountDashboardVisible === 'function' && isAccountDashboardVisible()) {
    return;
  }

  const sections = document.querySelectorAll('section[id]');
  const scrollY = window.pageYOffset;
  
  sections.forEach(current => {
    const sectionHeight = current.offsetHeight;
    const sectionTop = current.offsetTop - 150;
    const sectionId = current.getAttribute('id');
    const navLink = document.querySelector(`.nav-menu a[href*=${sectionId}]`);
    
    if (navLink) {
      if (scrollY > sectionTop && scrollY <= sectionTop + sectionHeight) {
        document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
        navLink.classList.add('active');
      }
    }
  });
}

/* ==========================================================================
   11. Scroll Animations (IntersectionObserver)
   ========================================================================== */

/**
 * Force-reveal every element carrying the .fade-in-up class by adding
 * .visible (opacity:1, transform:none). This is the CRITICAL fix for the
 * "blank screen" bug when navigating to a page via JS link switches —
 * without a real scroll event, the IntersectionObserver may never fire
 * and elements stay hidden at opacity:0.
 */
function revealAllFadeInUp() {
  document.querySelectorAll('.fade-in-up').forEach(el => el.classList.add('visible'));
}

/**
 * Trigger a synthetic scroll + resize event so any lazy-loaders,
 * IntersectionObservers, or scroll-triggered logic re-evaluate immediately.
 * Also forces window.scrollTo(0,0) — ONLY for genuine view-switch moments
 * where jumping to the top is the intended UX (e.g. "show products").
 */
function forceRevealScrollReset() {
  try { window.scrollTo(0, 0); } catch (e) {}
  forceRevealEvents();
}

/**
 * Event wake-up WITHOUT touching scroll position — used by delayed fallback
 * passes where the user may already be mid-scroll (a scrollTo there was the
 * "page yanks back to top seconds after refresh" bug).
 */
function forceRevealEvents() {
  // Dispatch synthetic events so observers/listeners re-run instantly
  window.dispatchEvent(new Event('scroll'));
  window.dispatchEvent(new Event('resize'));
}

function initScrollAnimations() {
  const animElements = document.querySelectorAll('.fade-in-up');
  
  if ('IntersectionObserver' in window) {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible');
          observer.unobserve(entry.target); // Trigger only once
        }
      });
    }, { threshold: 0.1, rootMargin: '0px 0px -50px 0px' });
    
    animElements.forEach(el => observer.observe(el));

    // IMMEDIATE FALLBACK #1: After the observer is set up, scan elements that
    // are ALREADY within the viewport and reveal them right away. This prevents
    // a blank screen when arriving at a page via JS navigation (e.g. clicking
    // "Add to Cart" on the enquiry page → products.html) because the browser
    // does NOT fire a scroll event during programmatic view switching.
    setTimeout(() => {
      const nowVisible = document.querySelectorAll('.fade-in-up:not(.visible)');
      nowVisible.forEach(el => {
        const rect = el.getBoundingClientRect();
        const isInViewport = (
          rect.top < (window.innerHeight - 50) &&
          rect.bottom > 0
        );
        if (isInViewport) {
          el.classList.add('visible');
          observer.unobserve(el);
        }
      });
      
      // IMMEDIATE FALLBACK #2: Safety net — after the preloader's 2s minimum
      // display + fade-out (700ms), force-reveal everything that is still
      // hidden. This guarantees no section remains invisible even if the
      // observer failed for any reason (layout shift, scroll restoration,
      // preloader overlay interfering with IntersectionObserver, etc.).
      setTimeout(() => {
        revealAllFadeInUp();
        // Dispatch synthetic scroll + resize ONLY — no scrollTo(0,0) here:
        // this fallback fires seconds after load, by which time the user may
        // already be scrolling, and forcing top made the page snap back
        // mid-scroll on refresh / first navigation.
        forceRevealEvents();
      }, 3200);
    }, 100);
    
    // IMMEDIATE FALLBACK #3: On any manual scroll, immediately reveal any
    // remaining hidden fade-in-up elements that enter the viewport. This
    // covers the edge case where the observer's -50px rootMargin causes
    // elements right at the bottom edge to stay hidden.
    window.addEventListener('scroll', function onScrollReveal() {
      document.querySelectorAll('.fade-in-up:not(.visible)').forEach(el => {
        const rect = el.getBoundingClientRect();
        const isInViewport = (
          rect.top < (window.innerHeight - 50) &&
          rect.bottom > 0
        );
        if (isInViewport) {
          el.classList.add('visible');
          observer.unobserve(el);
        }
      });
    }, { passive: true });
    
  } else {
    // Fallback for browsers without IntersectionObserver: reveal everything
    animElements.forEach(el => el.classList.add('visible'));
  }
}

// Expose animation helpers globally so they can be called from any inline
// onclick handler or external script (e.g. after a JS view switcher shows
// the products page, the caller can invoke window.forceRevealScrollReset()).
if (typeof window !== 'undefined') {
  window.revealAllFadeInUp = revealAllFadeInUp;
  window.forceRevealScrollReset = forceRevealScrollReset;
}

/* ==========================================================================
   12. Toast notifications Utility
   ========================================================================== */
function showToast(message, type = 'success') {
  const container = document.getElementById('toast-container');
  if (!container) return;
  
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  
  toast.innerHTML = `
    <span>${message}</span>
    <button class="toast-close" onclick="this.parentElement.remove()"><i class="fa-solid fa-xmark"></i></button>
  `;
  
  container.appendChild(toast);
  
  // Auto-dismiss
  setTimeout(() => {
    toast.style.animation = 'slideInToast 0.3s ease-out reverse';
    setTimeout(() => {
      toast.remove();
    }, 300);
  }, 4000);
}

/* ==========================================================================
   13. Important Notice Modal (Bilingual, Scroll-triggered, once per session)
   ========================================================================== */

const NOTICE_STORAGE_KEY = 'noticeAcknowledged';

/**
 * Opens the Important Notice modal and locks body scroll.
 */
function openNoticeModal() {
  const overlay = document.getElementById('notice-modal-overlay');
  if (!overlay) return;

  // Show the modal
  overlay.classList.add('open');
  overlay.setAttribute('aria-hidden', 'false');

  // Strict scroll lock on body and html
  document.body.classList.add('notice-modal-active');
  document.documentElement.style.overflow = 'hidden';
  document.body.style.overflow = 'hidden';
  document.body.style.position = 'fixed';
  document.body.style.width = '100%';
}

/**
 * Closes the Important Notice modal and unlocks body scroll.
 */
function closeNoticeModal() {
  const overlay = document.getElementById('notice-modal-overlay');
  if (!overlay) return;

  // Hide the modal
  overlay.classList.remove('open');
  overlay.setAttribute('aria-hidden', 'true');

  // Unlock scroll - restore original state
  document.body.classList.remove('notice-modal-active');
  document.documentElement.style.overflow = '';
  document.body.style.overflow = '';
  document.body.style.position = '';
  document.body.style.width = '';

  // Mark as seen so it never shows again this session
  try {
    sessionStorage.setItem(NOTICE_STORAGE_KEY, 'true');
  } catch (e) {
    // sessionStorage may not be available, silently ignore
  }

  // Chained popup: hand off to the Lucky Spin Wheel info modal (js/spin-wheel.js
  // shows the info modal on every page load OR after this close when the
  // notice was still pending; guarded so pages without the module — e.g.
  // admin — close the notice untouched).
  try {
    if (typeof window.openSpinInfoModalAfterNotice === 'function') {
      window.openSpinInfoModalAfterNotice();
    }
  } catch (e) {
    console.error('[SpinWheel] ✗ Failed to raise the spin info modal after the notice:', e);
  }
}

/**
 * Switch language between English and Tamil.
 */
function switchNoticeLanguage(lang) {
  const track = document.getElementById('notice-slide-track');
  const enBtn = document.getElementById('notice-lang-en');
  const taBtn = document.getElementById('notice-lang-ta');
  
  if (!track) return;
  
  if (lang === 'ta') {
    track.classList.add('lang-ta');
    track.classList.remove('lang-en');
    if (enBtn) enBtn.classList.remove('active');
    if (taBtn) taBtn.classList.add('active');
  } else {
    track.classList.add('lang-en');
    track.classList.remove('lang-ta');
    if (taBtn) taBtn.classList.remove('active');
    if (enBtn) enBtn.classList.add('active');
  }
}

/**
 * Initialize Notice Modal event listeners and behavior.
 * Called when DOM is ready.
 */
function initNoticeModal() {
  const checkbox = document.getElementById('notice-agree-checkbox');
  const button = document.getElementById('notice-understand-btn');
  const footer = document.querySelector('.notice-modal-footer');
  
  // Set up checkbox change handler
  if (checkbox) {
    checkbox.addEventListener('change', () => {
      if (button) {
        button.disabled = !checkbox.checked;
      }
    });
  }
  
  // Set up button click handler to close modal
  if (button) {
    button.addEventListener('click', () => {
      if (!button.disabled) {
        closeNoticeModal();
      }
    });
  }
}

/**
 * Trigger when the categories section scrolls into view.
 * Only fires once per session (checks sessionStorage).
 */
function setupNoticeTrigger() {
  // Check if already seen this session
  try {
    if (sessionStorage.getItem(NOTICE_STORAGE_KEY) === 'true') return;
  } catch (e) {
    // If sessionStorage is unavailable, always show
  }

  const targetSection = document.getElementById('categories');
  if (!targetSection) return;

  // Use IntersectionObserver to detect when categories section comes into view
  if ('IntersectionObserver' in window) {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          // Only trigger once
          observer.disconnect();
          openNoticeModal();
        }
      });
    }, {
      rootMargin: '0px',
      threshold: 0.1 // Trigger when at least 10% of the section is visible
    });

    observer.observe(targetSection);
  } else {
    // Fallback: show modal after a short delay if IntersectionObserver not supported
    setTimeout(() => {
      openNoticeModal();
    }, 3000);
  }
}

/* ==========================================================================
   14. KPR CLIENT PORTAL — Firebase Auth & Mandatory Checkout Sign-In
   --------------------------------------------------------------------------
   Requirement: customers browse freely and build a cart without signing in.
   The moment they try to check out ("Place Order Enquiry" in the cart drawer)
   or submit the enquiry form ("Submit Quick Enquiry"), requireAuthForOrder()
   verifies the Firebase session. When no user is signed in, the callback is
   parked in window.pendingOrderSubmit and the "KPR Client Portal" modal
   (injected by js/components.js -> kprAuthModalHTML) is displayed.

   Supports: Google popup sign-in (with a redirect fallback when the popup is
   blocked), email/password sign-in, account creation (with display name), and
   password reset. Requires firebase-auth-compat.js on the page.
   ========================================================================== */

let currentAuthTab = 'signin';
window.pendingOrderSubmit = null;
window.currentKprUser = null;

// Session marker used only for the popup-blocked -> signInWithRedirect fallback.
const KPR_PORTAL_PENDING_ACTION_KEY = 'kpr_pending_order_action';

/** Firebase Auth handle, or null when the Auth SDK failed to load. */
function getKprAuth() {
  if (typeof firebase === 'undefined' || !firebase.auth) {
    console.error('[Portal] Firebase Auth SDK not loaded. Ensure firebase-auth-compat.js is included before app.js.');
    return null;
  }
  return firebase.auth();
}

/** The signed-in Firebase user, or null for anonymous visitors. */
function getKprAuthUser() {
  const auth = getKprAuth();
  return auth ? auth.currentUser : null;
}

/** Display label for a Firebase user (name -> email -> phone). */
function getKprUserLabel(user) {
  if (!user) return '';
  return user.displayName || user.email || user.phoneNumber || 'KPR Client';
}

/* ---------- Email OR mobile-number sign-in mapping ----------
   Firebase Email/Password auth only accepts an email identifier, so a customer
   who types a 10-digit mobile number (e.g. 9876543210) is transparently mapped
   to the synthetic address 9876543210@kprcrackers.com. The reverse mapping
   (authEmailToPhone) lets the enquiry form be pre-filled with the WhatsApp
   number for mobile-number accounts and detects them again for password reset. */
const KPR_PHONE_AUTH_DOMAIN = 'kprcrackers.com';

/** Strip spaces / dashes / +91 country code / leading 0 down to 10 digits. */
function normalizePhoneDigits(value) {
  let digits = String(value || '').replace(/\D/g, '');
  if (digits.length === 12 && digits.startsWith('91')) digits = digits.slice(2);
  if (digits.length === 11 && digits.startsWith('0')) digits = digits.slice(1);
  return digits;
}

/** True when the value is a valid Indian mobile number (starts with 6-9). */
function isKprPhoneNumber(value) {
  return /^[6-9]\d{9}$/.test(normalizePhoneDigits(value));
}

/** 9876543210 -> 9876543210@kprcrackers.com (Firebase Email/Password identifier). */
function phoneToAuthEmail(phone) {
  return normalizePhoneDigits(phone) + '@' + KPR_PHONE_AUTH_DOMAIN;
}

/** 9876543210@kprcrackers.com -> 9876543210 (empty string for real emails). */
function authEmailToPhone(email) {
  const normalized = String(email || '').trim().toLowerCase();
  const suffix = '@' + KPR_PHONE_AUTH_DOMAIN;
  if (!normalized.endsWith(suffix)) return '';
  const localPart = normalized.slice(0, -suffix.length);
  return /^[6-9]\d{9}$/.test(localPart) ? localPart : '';
}

/** True when the Firebase email is the synthetic mobile-number address. */
function isPhoneBasedAuthEmail(email) {
  return !!authEmailToPhone(email);
}

/**
 * Resolve the portal "Email or 10-digit Phone Number" input into the Firebase
 * Email/Password identifier.
 * @param {string} rawValue - Raw text typed into #authEmailOrPhone
 * @returns {{email: string, phone: string, isPhone: boolean, valid: boolean, message: string}}
 *   email   - identifier to hand to Firebase (mapped for phone numbers)
 *   phone   - bare 10-digit number when isPhone, otherwise ''
 *   isPhone - true when the customer signed in with a mobile number
 *   valid   - false when the input is neither a valid email nor a 10-digit number
 *   message - customer-friendly validation copy for the invalid case
 */
function resolveAuthIdentifier(rawValue) {
  const raw = String(rawValue || '').trim();
  if (!raw) {
    return { email: '', phone: '', isPhone: false, valid: false, message: 'Please enter your email address or 10-digit mobile number.' };
  }

  if (raw.indexOf('@') !== -1) {
    const email = raw.toLowerCase();
    const valid = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email);
    return {
      email: valid ? email : '',
      phone: '',
      isPhone: false,
      valid: valid,
      message: valid ? '' : 'Please enter a valid email address (e.g. name@example.com).'
    };
  }

  if (isKprPhoneNumber(raw)) {
    const phone = normalizePhoneDigits(raw);
    return { email: phoneToAuthEmail(phone), phone: phone, isPhone: true, valid: true, message: '' };
  }

  return {
    email: '',
    phone: '',
    isPhone: false,
    valid: false,
    message: 'Please enter a valid email address or a 10-digit mobile number (e.g. 9876543210).'
  };
}

/* ---------- Portal modal open / close ---------- */
function openAuthModal() {
  const modal = document.getElementById('kprAuthModal');
  if (!modal) {
    console.error('[Portal] #kprAuthModal not found. Check the js/components.js injection.');
    return;
  }
  modal.classList.remove('hidden');
  modal.setAttribute('aria-hidden', 'false');
  syncPortalScrollLock();

  // Combined "Email or 10-digit Phone Number" identifier field (the legacy
  // #authEmail id is kept as a fallback for cached pages).
  const emailInput = document.getElementById('authEmailOrPhone') || document.getElementById('authEmail');
  if (emailInput) setTimeout(() => emailInput.focus(), 60);
}

function closeAuthModal() {
  const modal = document.getElementById('kprAuthModal');
  if (!modal) return;

  const active = document.activeElement;
  modal.classList.add('hidden');
  modal.setAttribute('aria-hidden', 'true');
  syncPortalScrollLock();

  // Drop focus if it currently sits on a field inside the modal
  if (active && modal.contains(active) && typeof active.blur === 'function') active.blur();
}

/** Click on the dark backdrop (never on the card) closes the portal. */
function handleAuthModalBackdrop(event) {
  if (event && event.target && event.target.id === 'kprAuthModal') closeAuthModal();
}

/* ---------- Sign In / Create Account toggle ---------- */
function switchAuthTab(tab) {
  currentAuthTab = (tab === 'signup') ? 'signup' : 'signin';

  const signInBtn = document.getElementById('tabSignIn');
  const signUpBtn = document.getElementById('tabSignUp');
  const nameGroup = document.getElementById('nameFieldGroup');
  const submitBtn = document.getElementById('authSubmitBtn');
  const passwordInput = document.getElementById('authPassword');

  clearAuthNotice();

  if (currentAuthTab === 'signin') {
    if (signInBtn) signInBtn.classList.add('active');
    if (signUpBtn) signUpBtn.classList.remove('active');
    if (nameGroup) nameGroup.classList.add('hidden');
    if (submitBtn) submitBtn.innerHTML = 'Sign In to Portal <span class="kpr-auth-arrow">→</span>';
    if (passwordInput) passwordInput.setAttribute('autocomplete', 'current-password');
  } else {
    if (signUpBtn) signUpBtn.classList.add('active');
    if (signInBtn) signInBtn.classList.remove('active');
    if (nameGroup) nameGroup.classList.remove('hidden');
    if (submitBtn) submitBtn.innerHTML = 'Create Account <span class="kpr-auth-arrow">→</span>';
    if (passwordInput) passwordInput.setAttribute('autocomplete', 'new-password');
  }
}

/* ---------- Inline messages (instead of blocking alert() dialogs) ---------- */
/**
 * The shared in-modal message element (#authErrorMsg). If it is missing — e.g.
 * a cached components.js that predates the portal — the box is created on the
 * fly and attached to the portal card so auth errors are never swallowed.
 */
function createErrorBox() {
  let box = document.getElementById('authErrorMsg');
  if (box) return box;

  const host = document.querySelector('#kprAuthModal .kpr-auth-body')
    || document.querySelector('#kprAuthModal .kpr-auth-card')
    || document.getElementById('kprAuthModal');
  if (!host) return null;

  box = document.createElement('div');
  box.id = 'authErrorMsg';
  box.className = 'kpr-auth-error';
  box.style.display = 'none';

  // Sit directly above the form so the message reads as part of the portal UI
  const form = document.getElementById('authForm');
  if (form && host.contains(form)) host.insertBefore(box, form);
  else host.appendChild(box);
  return box;
}

function clearAuthNotice() {
  const box = document.getElementById('authErrorMsg');
  if (!box) return;
  box.innerText = '';
  box.className = 'kpr-auth-error hidden';
  box.style.display = 'none';
}

/**
 * Show a message inside the modal.
 * @param {string} message - Text to display
 * @param {string} [variant] - 'error' (default) | 'success' | 'info'
 */
function showAuthNotice(message, variant) {
  const kind = variant || 'error';
  const box = createErrorBox();

  if (box) {
    box.innerText = message;
    box.className = 'kpr-auth-error' + (kind === 'error' ? '' : ' is-' + kind);
    box.classList.remove('hidden');
    box.style.display = 'block';
    return;
  }

  // Fallback when the modal markup is unavailable (toast container, then alert)
  if (typeof showToast === 'function') {
    showToast(message, kind === 'error' ? 'error' : 'info');
  } else {
    alert(message);
  }
}

/** Current site domain — surfaced in the authorized-domain guidance message. */
function getPortalCurrentDomain() {
  try {
    return (window.location && window.location.hostname) ? window.location.hostname : '(this domain)';
  } catch (e) {
    return '(this domain)';
  }
}

/** Human label for the sign-in method being attempted. */
function getPortalProviderLabel(context) {
  return (context === 'google') ? 'Google Sign-In' : 'Email & Password sign-in';
}

/** The Firebase Console fix for a disabled sign-in provider. */
function getPortalProviderFix(context) {
  if (context === 'google') {
    return 'Please enable the Google provider in Firebase Console > Authentication > Sign-in method.';
  }
  return 'Please enable the Email/Password provider in Firebase Console > Authentication > Sign-in method.';
}

/**
 * Log an actionable setup hint for project-configuration failures. These are
 * Firebase Console problems (not customer mistakes), so the developer needs the
 * exact console path — the customer only needs the friendly UI message.
 * @param {Object} err - The Firebase Auth error
 * @param {string} context - 'google' | 'email' | 'signup' | 'reset'
 */
function logPortalConfigHint(err, context) {
  const code = (err && err.code) ? err.code : '';

  if (code === 'auth/unauthorized-domain' || code === 'auth/unauthorized-hosting-domain') {
    console.error('[Portal] Unauthorized domain. Add "' + getPortalCurrentDomain()
      + '" under Firebase Console > Authentication > Settings > Authorized domains.'
      + ' For local previews also add "localhost" and "127.0.0.1".');
    return;
  }

  if (code === 'auth/operation-not-allowed'
    || code === 'auth/configuration-not-found'
    || code === 'auth/admin-restricted-operation') {
    console.error('[Portal] Sign-in provider disabled. ' + getPortalProviderFix(context));
  }
}

/**
 * Map Firebase Auth error codes to customer-friendly copy.
 * @param {Object} err - The Firebase Auth error
 * @param {string} fallback - Prefix used when the code has no dedicated mapping
 * @param {string} [context] - 'google' | 'email' | 'signup' | 'reset' — drives
 *   the provider-specific console instructions for configuration errors
 */
function getFirebaseAuthErrorMessage(err, fallback, context) {
  const code = (err && err.code) ? err.code : '';
  const providerLabel = getPortalProviderLabel(context);

  switch (code) {
    /* ---- Firebase Console setup problems: actionable, project-level fixes ---- */
    case 'auth/unauthorized-domain':
    case 'auth/unauthorized-hosting-domain':
      return 'This domain is not authorized for sign-in. Please add "' + getPortalCurrentDomain()
        + '" under Firebase Authentication > Settings > Authorized Domains (add "localhost" too for local previews).';
    case 'auth/operation-not-allowed':
      return providerLabel + ' is not enabled. ' + getPortalProviderFix(context);
    // Raised instead of operation-not-allowed by newer SDK versions when the
    // provider (or the whole Authentication service) is disabled in the project.
    case 'auth/configuration-not-found':
    case 'auth/admin-restricted-operation':
      return providerLabel + ' is unavailable for this Firebase project. ' + getPortalProviderFix(context);

    /* ---- Customer-side errors ---- */
    case 'auth/invalid-email':
      return 'Please enter a valid email address (e.g. name@example.com) or a 10-digit mobile number.';
    case 'auth/missing-password':
      return 'Please enter your password.';
    case 'auth/user-disabled':
      return 'This account has been disabled. Please contact KPR Crackers support.';
    case 'auth/user-not-found':
      return 'No account found for this email or mobile number. Switch to "Create Account" to register.';
    case 'auth/wrong-password':
    case 'auth/invalid-credential':
    case 'auth/invalid-login-credentials':
      return 'Incorrect email / mobile number or password. Please try again.';
    case 'auth/email-already-in-use':
      return 'This email or mobile number is already registered. Please sign in instead.';
    case 'auth/weak-password':
      return 'Password is too weak — please use at least 6 characters.';
    case 'auth/too-many-requests':
      return 'Too many failed attempts. Please wait a minute and try again.';
    case 'auth/network-request-failed':
      return 'Network error. Please check your internet connection and try again.';
    case 'auth/popup-closed-by-user':
    case 'auth/cancelled-popup-request':
      return 'Google sign-in was cancelled.';
    case 'auth/account-exists-with-different-credential':
      return 'An account already exists for this email with a different sign-in method. Please use that method.';
    default:
      return (err && err.message) ? (fallback + ' ' + err.message) : fallback;
  }
}

/* ---------- Google sign-in ---------- */
function handleGoogleSignIn() {
  const auth = getKprAuth();
  if (!auth) {
    showAuthNotice('Authentication service unavailable. Please refresh the page and try again.');
    return;
  }

  clearAuthNotice();
  const provider = new firebase.auth.GoogleAuthProvider();

  auth.signInWithPopup(provider)
    .then((result) => {
      onClientPortalSignedIn(result.user, 'Google');
    })
    .catch((err) => {
      const code = (err && err.code) ? err.code : '';

      // Project-configuration failures (unauthorized domain / disabled provider)
      // are not customer mistakes — surface the exact Firebase Console fix.
      logPortalConfigHint(err, 'google');

      // Popups are blocked on several mobile browsers / strict privacy modes —
      // fall back to a full-page redirect and remember the parked checkout.
      if (code === 'auth/popup-blocked' || code === 'auth/operation-not-supported-in-this-environment') {
        console.warn('[Portal] Google popup unavailable (' + code + '). Falling back to redirect sign-in.');
        try { sessionStorage.setItem(KPR_PORTAL_PENDING_ACTION_KEY, 'checkout'); } catch (e) {}
        auth.signInWithRedirect(provider).catch((redirectErr) => {
          console.error('[Portal] Google redirect sign-in failed:', redirectErr);
          logPortalConfigHint(redirectErr, 'google');
          showAuthNotice(getFirebaseAuthErrorMessage(redirectErr, 'Google Sign-In Failed:', 'google'));
        });
        return;
      }

      // Silent when the customer simply closed the popup
      if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') return;

      console.error('[Portal] Google sign-in failed:', err);
      showAuthNotice(getFirebaseAuthErrorMessage(err, 'Google Sign-In Failed:', 'google'));
    });
}

/* ---------- Email / password sign-in + account creation ---------- */
function handleEmailAuth(event) {
  if (event && typeof event.preventDefault === 'function') event.preventDefault();

  const auth = getKprAuth();
  if (!auth) {
    showAuthNotice('Authentication service unavailable. Please refresh the page and try again.');
    return;
  }

  // "Email or 10-digit Phone Number" — mobile numbers are mapped internally to
  // <number>@kprcrackers.com so Firebase Email/Password auth stays compatible.
  const identifierInput = document.getElementById('authEmailOrPhone') || document.getElementById('authEmail');
  const passwordInput = document.getElementById('authPassword');
  const nameInput = document.getElementById('authName');
  const submitBtn = document.getElementById('authSubmitBtn');

  const resolved = resolveAuthIdentifier(identifierInput ? identifierInput.value : '');
  const email = resolved.email;
  const password = passwordInput ? passwordInput.value : '';
  const fullName = (nameInput ? nameInput.value : '').trim();
  const isSignup = (currentAuthTab === 'signup');

  const originalBtnHtml = submitBtn ? submitBtn.innerHTML : '';
  clearAuthNotice();

  if (!resolved.valid) {
    showAuthNotice(resolved.message || 'Please enter a valid email address or a 10-digit mobile number.');
    if (identifierInput && typeof identifierInput.focus === 'function') identifierInput.focus();
    return;
  }

  if (!password) {
    showAuthNotice('Please enter your password.');
    return;
  }

  if (isSignup && !fullName) {
    showAuthNotice('Please enter your full name to create your KPR Client account.');
    return;
  }

  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.innerHTML = isSignup ? 'Creating Account...' : 'Signing In...';
  }
  const restoreBtn = () => {
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.innerHTML = originalBtnHtml;
    }
  };

  // ---- Sign In ----
  if (!isSignup) {
    auth.signInWithEmailAndPassword(email, password)
      .then((userCredential) => {
        restoreBtn();
        onClientPortalSignedIn(userCredential.user, 'email');
      })
      .catch((err) => {
        restoreBtn();
        console.error('[Portal] Sign in failed:', err);
        logPortalConfigHint(err, 'email');
        showAuthNotice(getFirebaseAuthErrorMessage(err, 'Sign In Failed:', 'email'));
      });
    return;
  }

  // ---- Create Account ----
  auth.createUserWithEmailAndPassword(email, password)
    .then((userCredential) => {
      // Persist the customer's name on the Firebase profile BEFORE the parked
      // checkout runs, so enquiries/receipts always carry the real name.
      const profileUpdate = (fullName && userCredential.user && userCredential.user.updateProfile)
        ? userCredential.user.updateProfile({ displayName: fullName })
            .catch((profileErr) => console.warn('[Portal] Could not save display name:', profileErr))
        : Promise.resolve();
      return profileUpdate.then(() => userCredential.user);
    })
    .then((user) => {
      restoreBtn();
      onClientPortalSignedIn(user, 'email');
    })
    .catch((err) => {
      restoreBtn();
      console.error('[Portal] Account creation failed:', err);
      logPortalConfigHint(err, 'signup');
      showAuthNotice(getFirebaseAuthErrorMessage(err, 'Account Creation Failed:', 'signup'));
    });
}

/* ---------- Forgot password ---------- */
function handleForgotPassword(event) {
  if (event && typeof event.preventDefault === 'function') event.preventDefault();

  const auth = getKprAuth();
  if (!auth) {
    showAuthNotice('Authentication service unavailable. Please refresh the page and try again.');
    return;
  }

  const emailInput = document.getElementById('authEmailOrPhone') || document.getElementById('authEmail');
  let email = (emailInput ? emailInput.value : '').trim();

  // Validate whatever the customer typed. Mobile-number accounts map to the
  // synthetic <number>@kprcrackers.com address, which has no real mailbox — a
  // reset link sent there could never be received, so guide those customers to
  // WhatsApp support instead of silently firing an undeliverable email.
  if (email) {
    const resolved = resolveAuthIdentifier(email);
    if (resolved.isPhone) {
      showAuthNotice('Password reset works with email accounts only — mobile-number accounts cannot receive reset emails. Please WhatsApp us at +91 97894 32373 and we will help you reset your password.', 'info');
      return;
    }
    if (!resolved.valid) {
      showAuthNotice(resolved.message || 'Please enter a valid email address.');
      return;
    }
    email = resolved.email;
  }

  // Reuse the email the customer already typed; otherwise ask for it.
  if (!email) {
    const prompted = window.prompt('Enter your email address to reset password:');
    if (!prompted) return;
    email = prompted.trim();
    if (emailInput) emailInput.value = email;
  }

  auth.sendPasswordResetEmail(email)
    .then(() => {
      showAuthNotice('Password reset link sent to ' + email + '. Please check your inbox (and spam folder).', 'success');
    })
    .catch((err) => {
      console.error('[Portal] Password reset failed:', err);
      logPortalConfigHint(err, 'reset');
      showAuthNotice(getFirebaseAuthErrorMessage(err, 'Could not send the reset email:', 'email'));
    });
}

/* ---------- Mandatory sign-in wrapper for every checkout action ---------- */
/**
 * Runs orderCallback() immediately for a signed-in client. For anonymous
 * visitors the callback is parked in window.pendingOrderSubmit and the KPR
 * Client Portal modal is displayed — it is replayed automatically on success.
 * @param {Function} orderCallback - Function that performs the actual submission
 * @returns {boolean} true when the callback ran immediately
 */
function requireAuthForOrder(orderCallback) {
  if (typeof orderCallback !== 'function') return false;

  const user = getKprAuthUser();
  if (user) {
    orderCallback();
    return true;
  }

  window.pendingOrderSubmit = orderCallback;
  openAuthModal();
  switchAuthTab('signin');
  showAuthNotice('Please sign in or create your KPR Client account to continue with this order.', 'info');
  console.log('[Portal] Checkout blocked — sign-in required. Action parked in window.pendingOrderSubmit.');
  return false;
}

/* ---------- Post sign-in plumbing ---------- */
/**
 * Single funnel for every successful sign-in (Google popup, Google redirect,
 * email/password, new account): closes the portal, syncs the buyer details and
 * then replays the checkout the customer was blocked on.
 */
function onClientPortalSignedIn(user, method) {
  window.currentKprUser = user || null;

  closeAuthModal();
  console.log('[Portal] Signed in via ' + (method || 'unknown') + ':', user ? (user.email || user.uid) : '(no user)');

  if (typeof showToast === 'function') {
    showToast('Welcome' + (user && user.displayName ? ', ' + user.displayName : '') + '! You are signed in to the KPR Client Portal.', 'success');
  }

  hydrateEnquiryFormFromAuth(user);
  renderHeaderUserAccount(user);

  // Replay the parked checkout / enquiry submission exactly once.
  const pending = window.pendingOrderSubmit;
  window.pendingOrderSubmit = null;
  if (typeof pending === 'function') {
    console.log('[Portal] Resuming the parked checkout action...');
    pending();
  }

  // Save the item the visitor hearted while signed out (auto-save wishlist).
  const pendingWish = window.pendingWishlistId;
  window.pendingWishlistId = null;
  if (pendingWish) toggleWishlistItem(pendingWish, user);

  // Load the saved wishlist and paint every heart button on screen.
  loadWishlistForUser(user);
}

/**
 * Pre-fill the Quick Enquiry form from the signed-in Firebase profile:
 *   • Full Name       <- Firebase displayName
 *   • WhatsApp Number <- the mobile number behind phone-mapped accounts
 *                        (synthetic …@kprcrackers.com email)
 *   • Email Address   <- the real account email (skipped for phone-mapped
 *                        accounts, whose "email" is the synthetic address)
 * Fields the customer has already typed are never overwritten.
 */
function hydrateEnquiryFormFromAuth(user) {
  if (!user) return;

  const nameInput = document.getElementById('enquiry-name');
  if (nameInput && !nameInput.value.trim() && user.displayName) {
    nameInput.value = user.displayName;
  }

  const phone = authEmailToPhone(user.email || '');
  if (phone) {
    const phoneInput = document.getElementById('enquiry-phone');
    if (phoneInput && !phoneInput.value.trim()) phoneInput.value = phone;
    return; // Phone-mapped account: the "email" is synthetic, so nothing to pre-fill there.
  }

  const emailInput = document.getElementById('enquiry-email');
  if (emailInput && !emailInput.value.trim() && user.email) {
    emailInput.value = user.email;
  }
}

/* ---------- Header user account button + signed-in profile dropdown ---------- */
/**
 * Paint the header account button (#userAccountBtn) for the current auth state:
 *   • signed out -> generic white user glyph on the green/gold disc; clicking it
 *     opens the KPR Client Portal modal
 *   • signed in  -> the Firebase avatar photo fills the disc (Google accounts)
 *     and clicking it opens the profile dropdown. (The old green presence dot
 *     was removed — no status indicator overlays the disc.)
 * Also fills the dropdown header and force-closes the menu when signed out.
 */
function renderHeaderUserAccount(user) {
  const btn = document.getElementById('userAccountBtn');
  const icon = document.getElementById('userIconSvg');
  const avatar = document.getElementById('userAvatarImg');
  const nameEl = document.getElementById('dropdownUserName');
  const emailEl = document.getElementById('dropdownUserEmail');

  if (btn) {
    btn.classList.toggle('is-signed-in', !!user);
    const label = user ? 'My KPR Client Account' : 'KPR Client Portal — Sign in';
    btn.setAttribute('title', label);
    btn.setAttribute('aria-label', label);
  }

  const photoUrl = (user && user.photoURL) ? user.photoURL : '';
  if (avatar) {
    if (photoUrl) {
      avatar.src = photoUrl;
      avatar.alt = getKprUserLabel(user);
      avatar.classList.remove('hidden');
      avatar.setAttribute('aria-hidden', 'false');
      // Broken avatar URL -> fall back to the generic glyph
      avatar.onerror = function () {
        avatar.classList.add('hidden');
        if (icon) icon.classList.remove('hidden');
      };
    } else {
      avatar.classList.add('hidden');
      avatar.setAttribute('aria-hidden', 'true');
      // Drop any previous client's avatar URL from the DOM
      if (typeof avatar.removeAttribute === 'function') avatar.removeAttribute('src');
    }
  }
  if (icon) icon.classList.toggle('hidden', !!photoUrl);

  if (nameEl) nameEl.innerText = user ? getKprUserLabel(user) : 'KPR Client';
  if (emailEl) {
    emailEl.innerText = user
      ? (user.email || user.phoneNumber || 'Signed in')
      : 'Not signed in';
  }

  // The dropdown only ever applies to a signed-in client
  if (!user) closeUserDropdown();
}

function openUserDropdown() {
  const dropdown = document.getElementById('userProfileDropdown');
  const btn = document.getElementById('userAccountBtn');
  if (!dropdown) return;
  dropdown.classList.remove('hidden');
  if (btn) btn.setAttribute('aria-expanded', 'true');
}

function closeUserDropdown() {
  const dropdown = document.getElementById('userProfileDropdown');
  const btn = document.getElementById('userAccountBtn');
  if (btn) btn.setAttribute('aria-expanded', 'false');
  if (dropdown) dropdown.classList.add('hidden');
}

function toggleUserDropdown() {
  const dropdown = document.getElementById('userProfileDropdown');
  if (!dropdown) return;
  if (dropdown.classList.contains('hidden')) openUserDropdown();
  else closeUserDropdown();
}

/**
 * Header user icon click (every page -> #userAccountBtn):
 *   • signed out        -> KPR Client Portal modal (sign in / create account)
 *   • signed in, dashboard.html present -> go straight to dashboard.html
 *                          (single click from ANY page — no hash tricks, no
 *                          intermediate Home render, no double click).
 *   • signed in, already ON dashboard.html -> open the My Orders view
 *                          directly (no-op navigation, just reveal + load).
 *
 * @param {Event} [event] - forwarded by the inline onclick handler so any
 *                          ancestor router/hash listener can be neutralised
 *                          before we navigate.
 */
function handleHeaderUserClick(event) {
  // Inline markup calls handleHeaderUserClick() with NO argument, so fall
  // back to the implicit window.event — otherwise the defensive
  // stopPropagation below would never run. (The button is type="button",
  // so there is no default navigation to prevent; this only neutralises a
  // hypothetical outer click-router / hash listener.)
  if (!event && typeof window !== 'undefined' && window.event) {
    try { event = window.event; } catch (e) {}
  }
  // Neutralise any outer click router / hash listener that would otherwise
  // hijack this tap and render Home first.
  if (event && typeof event.stopPropagation === 'function') {
    try { event.stopPropagation(); } catch (e) {}
  }
  if (event && typeof event.stopImmediatePropagation === 'function') {
    try { event.stopImmediatePropagation(); } catch (e) {}
  }

  if (getKprAuthUser()) {
    openClientDashboard();
    return;
  }
  openAuthModal();
  showAuthNotice('Sign in or create your KPR Client account to track orders and download receipts.', 'info');
}

/**
 * SINGLE-CLICK direct navigation to the dedicated Client Dashboard page
 * (dashboard.html) from ANY page. Already there? Just reveal the view.
 */
function openClientDashboard() {
  if (isDashboardPage()) {
    const user = (typeof getKprAuthUser === 'function') ? getKprAuthUser() : null;
    if (user) {
      if (typeof showAccountDashboard === 'function') showAccountDashboard(user);
      if (typeof fetchUserOrders === 'function') fetchUserOrders();
      return;
    }
  }
  window.location.href = 'dashboard.html';
}

/** True when the current document IS the dedicated dashboard page. */
function isDashboardPage() {
  try {
    const path = (window.location.pathname || '').toLowerCase();
    const file = path.substring(path.lastIndexOf('/') + 1);
    if (file === 'dashboard.html') return true;
    const header = document.getElementById('site-header');
    if (header && header.getAttribute('data-dashboard-page') === '1') return true;
    return !!document.querySelector('#accountDashboardView:not([data-dashboard-legacy])');
  } catch (e) {
    return false;
  }
}

/** Dropdown "[signout] Sign Out" — ends the Firebase session and clears the
 *  visible cart so the next account on this device starts with an empty one. */
function handleSignOut() {
  closeUserDropdown();
  kprSignOut();
}

/* ---------- Portal overlay helpers (shared body scroll lock) ---------- */
/** True when an overlay element is missing or currently carries .hidden. */
function isPortalOverlayHidden(id) {
  const el = document.getElementById(id);
  return !el || el.classList.contains('hidden');
}

/** The portal sign-in overlay and the My Orders overlay share one scroll lock. */
function syncPortalScrollLock() {
  const anyOpen = !isPortalOverlayHidden('kprAuthModal') || !isPortalOverlayHidden('kprOrdersModal');
  document.body.classList.toggle('kpr-auth-open', anyOpen);
}

/* ---------- My Orders modal (header account dropdown -> [box] My Orders) ---------- */
function openMyOrdersModal() {
  const modal = document.getElementById('kprOrdersModal');
  if (!modal) {
    console.error('[Portal] #kprOrdersModal not found. Check the js/components.js injection.');
    return;
  }
  modal.classList.remove('hidden');
  modal.setAttribute('aria-hidden', 'false');
  syncPortalScrollLock();
}

function closeMyOrdersModal() {
  const modal = document.getElementById('kprOrdersModal');
  if (!modal) return;
  modal.classList.add('hidden');
  modal.setAttribute('aria-hidden', 'true');
  syncPortalScrollLock();
}

/** Backdrop click (never the card) closes My Orders. */
function handleOrdersModalBackdrop(event) {
  if (event && event.target && event.target.id === 'kprOrdersModal') closeMyOrdersModal();
}

/**
 * List every enquiry this client submitted while signed in. Enquiries store the
 * Firebase identity in `customer.userId` / `customer.email` (written by the
 * enquiry form), so a single equality filter is enough — no composite index.
 *
 * Header dropdown -> [box] My Orders opens the dedicated CLIENT ACCOUNT
 * DASHBOARD page (dashboard.html). From any other page this navigates
 * straight there; on dashboard.html itself it just reveals + loads the view.
 * (index.html keeps a legacy in-page view for old #account deep-links, which
 * are now forwarded to dashboard.html — see initClientPortalAuth below.)
 */
function openMyOrders() {
  closeUserDropdown();

  const user = getKprAuthUser();
  if (!user) {
    openAuthModal();
    showAuthNotice('Please sign in to view your order history.', 'info');
    return;
  }

  if (!isDashboardPage()) {
    try { sessionStorage.setItem('kpr_open_account_dashboard', '1'); } catch (e) {}
    window.location.href = 'dashboard.html';
    return;
  }

  showAccountDashboard(user);
  fetchUserOrders();
}

/* ---------- Client Account Dashboard (#accountDashboardView) ---------- */
/** True while the full-page account dashboard is the visible "page". */
function isAccountDashboardVisible() {
  const view = document.getElementById('accountDashboardView');
  return !!view && !view.classList.contains('hidden');
}

/**
 * Reveal the dashboard view and (on index.html) hide every other homepage
 * section (main gets the .account-view-active flag — see css/styles.css).
 * On the dedicated dashboard.html the view is the whole page, so this just
 * paints the profile + flips the navbar highlight: Home loses its pill, the
 * profile icon gains the white-ring "selected" state.
 */
function showAccountDashboard(user) {
  const view = document.getElementById('accountDashboardView');
  if (!view) return;

  renderAccountDashboardProfile(user || getKprAuthUser());
  view.classList.remove('hidden');

  const main = view.closest('main');
  if (main) main.classList.add('account-view-active');

  setDashboardNavState(true);

  // Arrival from another page was masked behind the preloader — now that the
  // dashboard has painted, release the mask so it fades straight onto it.
  if (typeof unmaskHomeForDashboard === 'function') unmaskHomeForDashboard();

  // NOTE: intentionally NO window.scrollTo() here — this function also runs
  // from the Firebase auth callback on every page load/refresh, and the
  // deferred smooth-scroll yanked users back to the top mid-scroll.
}

/** Hide the dashboard (legacy index.html in-page view) and restore the normal homepage sections. */
function hideAccountDashboard() {
  const view = document.getElementById('accountDashboardView');
  if (view) view.classList.add('hidden');

  const main = view ? view.closest('main') : document.querySelector('main');
  if (main) main.classList.remove('account-view-active');

  setDashboardNavState(false);
}

/**
 * Render the FULL guest profile layout on dashboard.html for signed-out
 * visitors (and immediately after signing out) — instead of hiding the view
 * and leaving a header/footer-only blank page. Stats stay at their static
 * 0 / 0 / "Not Set Yet" defaults and the order history shows the guest
 * empty state.
 */
function renderDashboardGuestState() {
  const view = document.getElementById('accountDashboardView');
  if (!view) return;

  view.classList.remove('hidden');
  const main = view.closest('main');
  if (main) main.classList.add('account-view-active');
  setDashboardNavState(true);

  renderAccountDashboardProfile(null);

  // Reset stats painted for the previous account back to guest defaults
  // (0 / 0 / "Not Set Yet").
  const setStat = (id, val) => { const el = document.getElementById(id); if (el) el.innerText = val; };
  setStat('statTotalOrders', '0');
  setStat('statActiveOrders', '0');
  setStat('statAddress', 'Not Set Yet');

  // Clear any order rows rendered for the previous account.
  const list = document.getElementById('userOrdersListContainer');
  if (list) list.innerHTML = '';
  const wishGrid = document.getElementById('wishlistItemsGrid');
  if (wishGrid) wishGrid.innerHTML = '';
}

/** Guest "Sign In" button — raises the KPR Client Portal with a notice. */
function guestSignInRequested() {
  openAuthModal();
  switchAuthTab('signin');
  showAuthNotice('Please sign in to view your order history, account details & track shipments.', 'info');
}

/**
 * Unified active-navbar toggler for the two header "views":
 *   dashboard open  -> Home pill cleared, profile icon ringed (gold + white ring)
 *   dashboard closed -> profile ring cleared, Home pill restored
 * (Desktop + mobile links share the same .nav-link markup / .active class,
 *  so one pass covers both. Scroll-spy re-highlights on the next scroll.)
 */
function setDashboardNavState(dashboardOpen) {
  const userBtn = document.getElementById('userAccountBtn');
  if (userBtn) userBtn.classList.toggle('is-dashboard-active', !!dashboardOpen);

  const homeLinks = document.querySelectorAll('.nav-link[href="index.html"], .nav-link[href="./index.html"], .nav-link[href="index.html#home"], .nav-link[href="#home"]');
  homeLinks.forEach(function (link) {
    if (dashboardOpen) {
      link.classList.remove('active');
    } else if (!document.querySelector('.nav-link.active')) {
      link.classList.add('active');
    }
  });

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('kpr-dashboard-view-change', { detail: { dashboardOpen: !!dashboardOpen } }));
  }
}

/**
 * Paint the welcome banner for BOTH account states.
 * Signed out is a FIRST-CLASS guest view (never a hidden/blank page):
 * guest avatar "G", "You are not signed in" + Guest Mode badge, sign-in
 * subtitle, a single Sign In button, 0/0/"Not Set Yet" stats and the
 * "No orders yet" empty state. All new ids are guarded so the legacy
 * in-page dashboard copy on index.html keeps working untouched.
 */
function renderAccountDashboardProfile(user) {
  const avatarEl = document.getElementById('dashAvatar');
  const titleEl = document.getElementById('dashWelcomeTitle');
  const nameEl = document.getElementById('dashUserName'); // legacy markup
  const emailEl = document.getElementById('dashUserEmail');
  const badgeEl = document.getElementById('dashVerifiedBadge');
  const actionsUser = document.getElementById('dashActionsUser');
  const actionsGuest = document.getElementById('dashActionsGuest');
  const refreshBtn = document.getElementById('dashRefreshOrdersBtn');
  const guestEmpty = document.getElementById('dashGuestEmptyState');

  if (!user) {
    if (avatarEl) avatarEl.innerText = 'G';
    if (titleEl) titleEl.innerText = 'You are not signed in';
    if (nameEl) nameEl.innerText = 'User';
    if (emailEl) emailEl.innerText = 'Please sign in to view your order history, account details & track shipments.';
    if (badgeEl) {
      badgeEl.innerText = 'Guest Mode';
      badgeEl.classList.add('dash-verified-badge-guest');
    }
    if (actionsUser) actionsUser.classList.add('hidden');
    if (actionsGuest) actionsGuest.classList.remove('hidden');
    if (refreshBtn) refreshBtn.classList.add('hidden');
    if (guestEmpty) guestEmpty.classList.remove('hidden');
    return;
  }

  // Mobile-number accounts map to <number>@kprcrackers.com — show the phone.
  const phone = authEmailToPhone(user.email || '');
  const email = phone ? (phone + ' (Mobile Account)') : (user.email || user.phoneNumber || 'Signed in');
  const name = getKprUserLabel(user) || 'User';

  if (avatarEl) {
    const initial = (user.displayName || name || 'U').trim().charAt(0).toUpperCase();
    avatarEl.innerText = initial || 'U';
  }
  if (titleEl) titleEl.innerText = 'Welcome, ' + name;
  if (nameEl) nameEl.innerText = name;
  if (emailEl) emailEl.innerText = email;
  if (badgeEl) {
    badgeEl.innerText = 'Verified Client';
    badgeEl.classList.remove('dash-verified-badge-guest');
  }
  if (actionsUser) actionsUser.classList.remove('hidden');
  if (actionsGuest) actionsGuest.classList.add('hidden');
  if (refreshBtn) refreshBtn.classList.remove('hidden');
  if (guestEmpty) {
    guestEmpty.classList.add('hidden');
    // Drop the guest placeholder from the list container too.
    const list = document.getElementById('userOrdersListContainer');
    if (list && list.querySelector('.dash-guest-empty')) list.innerHTML = '';
  }
}

/**
 * Load the signed-in client's orders from Firestore and render the dashboard
 * order cards + the three stats cards (total orders / active shipments /
 * saved address from the most recent order).
 */
function fetchUserOrders() {
  const list = document.getElementById('userOrdersListContainer');
  const user = getKprAuthUser();

  if (!list) return;
  if (!user) {
    openAuthModal();
    showAuthNotice('Please sign in to view your order history.', 'info');
    return;
  }

  renderDashOrdersMessage('Loading your orders…', '');

  if (!window.db) {
    renderDashOrdersMessage(
      'Order history unavailable',
      'We could not reach the order service right now. Please call or WhatsApp us and we will share your order status.',
      'Contact Us', 'contact.html'
    );
    return;
  }

  window.db.collection('enquiries')
    .where('customer.userId', '==', user.uid)
    .limit(50)
    .get()
    .then((snapshot) => {
      const orders = snapshot.docs.map((doc) => {
        const d = doc.data() || {};
        const breakdown = d.financialBreakdown || {};
        const customer = d.customer || {};
        const placedOn = (d.timestamp && typeof d.timestamp.toDate === 'function')
          ? d.timestamp.toDate().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
          : 'Recent';
        const phone = authEmailToPhone(user.email || '');
        return {
          docId: doc.id,
          id: doc.id,
          orderId: d.orderId || doc.id,
          status: d.status || 'new',
          statusLabel: friendlyOrderStatus(d.status || 'new'),
          date: placedOn,
          grandTotal: breakdown.grandTotal || 0,
          itemCount: (d.cartItems || []).reduce((sum, it) => sum + (it.quantity || 0), 0),
          items: d.cartItems || [],
          breakdown: breakdown,
          userName: customer.name || user.displayName || 'Customer',
          userPhone: customer.phone || phone || 'N/A',
          address: customer.address || '',
          pincode: customer.pincode || '',
          state: customer.state || '',
          timestamp: (d.timestamp && typeof d.timestamp.toDate === 'function') ? d.timestamp.toDate() : null
        };
      });

      // Newest first — sorted client-side so no composite index is required.
      orders.sort((a, b) => (b.timestamp ? b.timestamp.getTime() : 0) - (a.timestamp ? a.timestamp.getTime() : 0));
      renderUserOrdersList(orders);
      renderDashboardStats(orders, user);
    })
    .catch((err) => {
      console.error('[Portal] Could not load client orders:', err);
      renderDashOrdersMessage(
        'Could not load your orders',
        'Please try again in a moment, or contact us on WhatsApp and we will look up your order for you.',
        'Contact Us', 'contact.html'
      );
    });
}

/** Inline status / empty / loading message inside the dashboard list. */
function renderDashOrdersMessage(title, body, ctaLabel, ctaHref) {
  const list = document.getElementById('userOrdersListContainer');
  if (!list) return;
  const cta = (ctaLabel && ctaHref)
    ? '<br><a class="dash-orders-cta" href="' + ctaHref + '">' + escapeHtml(ctaLabel) + '</a>'
    : '';
  list.innerHTML = '<div class="dash-orders-message"><strong>' + escapeHtml(title) + '</strong>'
    + escapeHtml(body) + cta + '</div>';
}

/** Fill the three stats overview cards from the fetched orders. */
function renderDashboardStats(orders, user) {
  const totalEl = document.getElementById('statTotalOrders');
  const activeEl = document.getElementById('statActiveOrders');
  const addressEl = document.getElementById('statAddress');

  // "Active" = not yet resolved (delivered/closed) — new + contacted statuses.
  const active = orders.filter((o) => {
    const s = String(o.status || 'new').toLowerCase();
    return s !== 'resolved' && s !== 'delivered' && s !== 'cancelled';
  }).length;

  if (totalEl) totalEl.innerText = String(orders.length);
  if (activeEl) activeEl.innerText = String(active);

  if (addressEl) {
    const latestWithAddress = orders.find((o) => o.address);
    if (latestWithAddress) {
      const parts = [latestWithAddress.address];
      if (latestWithAddress.pincode) parts.push('PIN: ' + latestWithAddress.pincode);
      if (latestWithAddress.state) parts.push(latestWithAddress.state);
      addressEl.innerText = parts.join(', ');
      addressEl.title = parts.join(', ');
    } else {
      addressEl.innerText = 'Not Set Yet';
      addressEl.title = 'Your delivery address from the latest order appears here';
    }
  }
}

/** Render every order card (with the receipt / PDF action) into the dashboard. */
function renderUserOrdersList(orders) {
  const list = document.getElementById('userOrdersListContainer');
  if (!list) return;

  if (!orders || orders.length === 0) {
    renderDashOrdersMessage(
      'No orders yet',
      'Orders you place while signed in appear here so you can track their status and download receipts.',
      'Browse Crackers', 'products.html'
    );
    return;
  }

  if (!window.dashOrdersCache) window.dashOrdersCache = {};
  orders.forEach((o) => { window.dashOrdersCache[o.docId] = o; });

  list.innerHTML = orders.map(renderOrderCard).join('');
}

/** Map the raw Firestore enquiry status to a customer-friendly badge label. */
function friendlyOrderStatus(status) {
  const s = String(status || 'new').toLowerCase().replace(/[^a-z]/g, '') || 'new';
  if (s === 'contacted') return 'Processing';
  if (s === 'resolved') return 'Completed';
  if (s === 'delivered') return 'Delivered';
  if (s === 'cancelled') return 'Cancelled';
  return 'Pending';
}

/**
 * One FULL DETAILED dashboard order card (amber accent border, products
 * table and footer summary). The fetched order is cached in
 * window.dashOrdersCache so "Download Receipt" can print a complete
 * receipt without another Firestore read.
 */
function renderOrderCard(order) {
  const items = (order.items || []).map((it) => {
    const price = Number(it.unitPrice || it.price || 0);
    return {
      name: it.productName || it.name || it.title || 'Item',
      qty: Number(it.quantity || it.qty || 0),
      price: price,
      // FREE row: ₹0 unit price or an explicit spin-gift flag carried on the order
      isFreeItem: price === 0 || !!(it.isGift || it.isFreeGift || it.isSpinReward)
    };
  });

  const itemsTableRows = items.map((item) => `
    <tr class="order-item-row">
      <td class="order-cell-name"><span class="order-item-name">${escapeHtml(item.name)}</span>${item.isFreeItem ? ' <span class="order-free-badge">(FREE)</span>' : ''}</td>
      <td class="order-cell-qty"><span class="order-qty-num">${item.qty}</span><span class="order-qty-unit">Pcs</span></td>
      <td class="order-cell-price">₹${item.price.toLocaleString('en-IN')}</td>
      <td class="order-cell-subtotal">₹${(item.price * item.qty).toLocaleString('en-IN')}</td>
    </tr>
  `).join('');

  return `
    <div class="bg-white rounded-2xl border-2 border-amber-300/80 p-5 shadow-sm space-y-4 mb-5">
      <!-- HEADER ROW -->
      <div class="flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 pb-3">
        <div class="flex items-center gap-3">
          <span class="bg-gray-100 text-gray-800 font-extrabold text-xs px-2.5 py-1 rounded-md">#${escapeHtml(order.orderId || order.id)}</span>
          <span class="text-xs font-semibold text-gray-400">${escapeHtml(order.date || 'Recent')}</span>
        </div>
        <div class="flex items-center gap-2 order-card-actions">
          <span class="bg-amber-100 text-amber-800 font-bold text-xs px-3 py-1 rounded-full">${escapeHtml(order.statusLabel || friendlyOrderStatus(order.status))}</span>
          <button onclick="downloadReceipt('${order.id}')" class="order-pdf-btn bg-amber-400 hover:bg-amber-500 text-gray-900 font-extrabold text-xs px-4 py-2 rounded-xl transition-all shadow-sm flex items-center gap-1.5">
            <i class="fa-solid fa-file-pdf"></i> Download Receipt
          </button>
        </div>
      </div>

      <!-- DELIVER TO DETAILS -->
      <p class="text-xs font-bold text-gray-700">
        Deliver To: <span class="font-extrabold text-gray-900">${escapeHtml(order.userName || order.customerName || 'Customer')} (${escapeHtml(order.userPhone || order.mobile || 'N/A')})</span>
      </p>

      <!-- PRODUCTS TABLE (fixed percentage grid: name 40% / qty 14% / price 22% / subtotal 24%) -->
      <div class="overflow-x-auto rounded-xl border border-gray-100">
        <table class="order-items-table">
          <colgroup>
            <col style="width:40%"><col style="width:14%"><col style="width:22%"><col style="width:24%">
          </colgroup>
          <thead>
            <tr>
              <th class="th-name">ITEM NAME</th>
              <th class="th-qty">QTY</th>
              <th class="th-price">PRICE</th>
              <th class="th-sub">SUBTOTAL</th>
            </tr>
          </thead>
          <tbody>
            ${itemsTableRows || '<tr class="order-item-row"><td colspan="4" class="order-cell-name" style="text-align:center;font-weight:600;color:#6b7280">Item details not available for this order</td></tr>'}
          </tbody>
        </table>
      </div>

      <!-- FOOTER SUMMARY: clean rounded card, count ⇄ grand total spaced -->
      <div class="order-totals-card">
        <span class="order-totals-count">Product Items Count: <strong>${items.length}</strong></span>
        <span class="order-totals-grand">Grand Total: <strong>₹${Number(order.totalAmount || order.grandTotal || 0).toLocaleString('en-IN')}</strong></span>
      </div>
    </div>
  `;
}

/** Receipt button on the detailed order card -> print-ready receipt window. */
function downloadReceipt(docId) {
  downloadOrderReceipt(docId);
}

/* ==========================================================================
   WISHLIST — saved products per KPR Client (Firestore: wishlists/{uid})
   Stores an array of product ids in the `productIds` field. Anonymous visitors
   get the KPR Client Portal modal and the pending product id is saved
   automatically right after a successful sign-in.
   ========================================================================== */

window.pendingWishlistId = null;   // product parked while the visitor signs in
window.userWishlist = [];          // cached saved product ids (wishlists/{uid})

/** Escape a product id for safe single-quoted inline onclick handlers. */
function wishlistJsId(productId) {
  return String(productId).replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

// Function to generate Heart Button for Product Cards
function getWishlistBtnHTML(productId) {
  const isWishlisted = window.userWishlist && window.userWishlist.indexOf(String(productId)) !== -1;
  return `
    <button type="button" onclick="event.stopPropagation(); toggleWishlist('${wishlistJsId(productId)}')" data-wishlist-btn data-product-id="${productId}" class="card-wishlist-btn p-2 rounded-full transition-all${isWishlisted ? ' wishlist-active' : ''}" title="Save to Wishlist" aria-label="Save to Wishlist">
      <i class="${isWishlisted ? 'fa-solid fa-heart text-red-500' : 'fa-regular fa-heart text-gray-400 hover:text-red-500'} text-lg"></i>
    </button>
  `;
}

/**
 * Product label badges row (Green Cracker / Brand) rendered between title
 * and pack size. The container is ALWAYS present (even when empty) to
 * reserve vertical space so all cards in a grid row stretch to equal height.
 */
function getProductBadgeRowHTML(prod) {
  const badges = [];
  if (prod.greenCracker === true) {
    badges.push(`<span class="badge-green-cracker"><svg class="badge-leaf-icon" viewBox="0 0 20 20" fill="currentColor" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><path d="M17.3 3.2C17.1 2.5 16.4 2 15.6 2C11.2 2 7.6 4.4 5.4 8.2C3.8 11 3.2 14.2 3.7 16.8C3.8 17.5 4.4 18 5.1 18C5.3 18 5.4 18 5.6 17.9C6.9 17.4 8.3 17.2 9.7 17.2C13.1 17.2 16 15.4 17.5 12C18.3 10 18.3 7.5 17.9 5.2C17.8 4.4 17.6 3.7 17.3 3.2ZM6.4 15.6C7.2 12.4 9.2 9.4 12 7.4C10.2 10.2 8.6 13 6.4 15.6Z"/></svg><span>Green Cracker</span></span>`);
  }
  const brand = String(prod.brand || '').trim();
  if (brand) {
    badges.push(`<span class="badge-brand">${escapeHtml(brand)}</span>`);
  }
  return `<div class="product-card-badges">${badges.join('')}</div>`;
}

/* ==========================================================================
   12.x Product Quick View Modal (card click → detail popup)
   Injected once into <body> on first open so every page that loads app.js
   gets it without duplicating markup. Body scrolling is locked while open.
   ADD / stepper / wishlist buttons call event.stopPropagation() at their
   inline handlers, plus a closest() guard here, so they never trigger it.
   ========================================================================== */
window.quickViewProductId = null;
window.quickViewReviewsCache = {}; // prodId -> review array (Firestore or legacy local)

function ensureQuickViewModal() {
  let root = document.getElementById('product-quickview-modal');
  if (root) return root;

  root = document.createElement('div');
  root.id = 'product-quickview-modal';
  root.className = 'quickview-overlay';
  root.innerHTML = `
    <div class="quickview-card" role="dialog" aria-modal="true" aria-label="Product quick view">
      <div class="quickview-topbar">
        <button type="button" class="quickview-close-x" onclick="closeProductQuickView()" aria-label="Close quick view">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M6 18L18 6M6 6l12 12"/></svg>
        </button>
      </div>
      <div class="quickview-image-band">
        <div class="quickview-image-box" onclick="openImageLightbox()" title="Tap to zoom">
          <img id="quickview-img" src="" alt="Product image">
        </div>
        <span id="quickview-discount" class="quickview-offer-badge" style="display: none;"></span>
      </div>
      <div class="quickview-details">
        <span id="quickview-category" class="quickview-category"></span>
        <h2 id="quickview-title" class="quickview-title"></h2>
        <div id="quickview-title-badges" class="quickview-title-badges" style="display: none;"></div>
        <p id="quickview-desc" class="quickview-desc"></p>
        <div class="quickview-meta-row">
          <div class="quickview-price-group">
            <span id="quickview-price" class="quickview-price"></span>
            <span id="quickview-mrp" class="quickview-mrp"></span>
            <span id="quickview-unit" class="quickview-unit"></span>
          </div>
          <div id="quickview-rating-chip" class="quickview-rating-chip" title="Average customer rating">
            <span class="quickview-chip-star" aria-hidden="true">★</span>
            <span id="quickview-rating-avg" class="quickview-chip-avg"></span>
            <span id="quickview-rating-count" class="quickview-chip-count"></span>
          </div>
        </div>
        <div class="quickview-action-row" id="quickview-action-row"></div>
        <div class="quickview-rate-box">
          <div class="quickview-rate-head">
            <span class="quickview-rate-title">Rate this product:</span>
            <div id="quickview-stars" class="quickview-stars">
              ${[1, 2, 3, 4, 5].map(n => `<span class="quickview-star" data-star="${n}" onclick="setQuickViewRating(${n})" role="button" aria-label="Rate ${n} star${n > 1 ? 's' : ''}">★</span>`).join('')}
            </div>
          </div>
          <input type="text" id="quickview-reviewer-name" class="quickview-input" maxlength="40" placeholder="Your Name">
          <input type="text" id="quickview-reviewer-comment" class="quickview-input" maxlength="200" placeholder="Write a short review...">
          <div class="quickview-rate-actions">
            <button type="button" class="quickview-submit-btn" onclick="submitUserReview()">Post Review</button>
          </div>
        </div>
      </div>
    </div>
  `;
  document.body.appendChild(root);

  // Click on the dim backdrop (not the card itself) closes the modal
  root.addEventListener('click', (e) => {
    if (e.target === root) closeProductQuickView();
  });
  return root;
}

function quickViewStorageKey(prodId) {
  return 'jcs_reviews_' + String(prodId);
}

function getQuickViewReviews(prodId) {
  try {
    const raw = localStorage.getItem(quickViewStorageKey(prodId));
    const list = raw ? JSON.parse(raw) : [];
    return Array.isArray(list) ? list : [];
  } catch (err) {
    console.warn('[QuickView] Failed to read reviews for', prodId, err);
    return [];
  }
}

/** Render the rating summary chip (avg + count) — no form, no list. */
function applyQuickViewRatingChip(reviews) {
  const avgEl = document.getElementById('quickview-rating-avg');
  const countEl = document.getElementById('quickview-rating-count');
  if (!avgEl || !countEl) return;
  if (!reviews || reviews.length === 0) {
    avgEl.textContent = 'No ratings';
    countEl.textContent = '';
    return;
  }
  const sum = reviews.reduce((acc, r) => acc + (Number(r.rating) || 0), 0);
  const avg = (sum / reviews.length).toFixed(1);
  avgEl.textContent = `${avg}/5`;
  countEl.textContent = `(${reviews.length} Review${reviews.length > 1 ? 's' : ''})`;
}

/**
 * Load reviews for the chip: Firestore 'product_reviews' collection first
 * (submitted from this very form), legacy localStorage as fallback when
 * offline or on error.
 */
function loadQuickViewRatingSummary(prodId) {
  const key = String(prodId);
  if (window.quickViewReviewsCache[key]) {
    applyQuickViewRatingChip(window.quickViewReviewsCache[key]);
    return;
  }
  if (window.db) {
    window.db.collection('product_reviews')
      .where('productId', '==', key)
      .get()
      .then(snap => {
        const list = [];
        snap.forEach(doc => list.push(doc.data()));
        window.quickViewReviewsCache[key] = list;
        applyQuickViewRatingChip(list);
      })
      .catch(err => {
        console.warn('[QuickView] Review fetch failed for', key, err.code || err.message);
        const legacy = getQuickViewReviews(prodId);
        window.quickViewReviewsCache[key] = legacy;
        applyQuickViewRatingChip(legacy);
      });
  } else {
    const legacy = getQuickViewReviews(prodId);
    window.quickViewReviewsCache[key] = legacy;
    applyQuickViewRatingChip(legacy);
  }
}

/**
 * Dynamic action row — two states kept in sync with the estimate cart:
 *  A) qty 0  → green ADD TO ESTIMATE + grey Close
 *  B) qty >0 → quantity stepper (− count +) + RED delete (trash) button
 * Out-of-stock products get a disabled SOLD OUT + Close.
 */
function renderQuickViewActions() {
  const row = document.getElementById('quickview-action-row');
  if (!row || !window.quickViewProductId) return;
  const prod = getProducts().find(p => String(p.id) === String(window.quickViewProductId));
  if (!prod) return;
  const qty = getCartQty(prod.id);
  const cartSvg = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z"/></svg>';
  const trashSvg = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>';

  if (!prod.inStock) {
    row.innerHTML = `
      <button type="button" class="quickview-add-btn" disabled>${cartSvg}<span>SOLD OUT</span></button>
      <button type="button" class="quickview-secondary-btn" onclick="closeProductQuickView()">Close</button>
    `;
  } else if (qty > 0) {
    row.innerHTML = `
      <div class="quickview-qty-wrap">
        <button type="button" class="quickview-step-btn" onclick="quickViewStep(-1)" aria-label="Decrease quantity">−</button>
        <span class="quickview-step-count">${qty}</span>
        <button type="button" class="quickview-step-btn quickview-step-plus" onclick="quickViewStep(1)" aria-label="Increase quantity">+</button>
      </div>
      <button type="button" class="quickview-delete-btn" onclick="quickViewDeleteItem()">${trashSvg}<span>Delete</span></button>
    `;
  } else {
    row.innerHTML = `
      <button type="button" class="quickview-add-btn" onclick="quickViewAddToEstimate()">${cartSvg}<span>ADD TO ESTIMATE</span></button>
      <button type="button" class="quickview-secondary-btn" onclick="closeProductQuickView()">Close</button>
    `;
  }
}

function quickViewStep(delta) {
  if (!window.quickViewProductId) return;
  catalogStepQty(window.quickViewProductId, delta);
  renderQuickViewActions(); // reverts to State A automatically at qty 0
}

function quickViewDeleteItem() {
  if (!window.quickViewProductId) return;
  updateCartItemQuantity(window.quickViewProductId, 0);
  syncProductAction(window.quickViewProductId);
  renderQuickViewActions();
  showToast('Item removed from your estimate.', 'info');
}

function openProductQuickView(prodId) {
  const prod = getProducts().find(p => String(p.id) === String(prodId));
  if (!prod) return;

  const root = ensureQuickViewModal();
  window.quickViewProductId = prod.id;

  // Green cracker / brand badges — light chips in a row directly BELOW
  // the product title (topbar now only carries the close button)
  const badgesEl = document.getElementById('quickview-title-badges');
  let badgeHTML = '';
  if (prod.greenCracker === true) {
    badgeHTML += '<span class="quickview-badge quickview-badge-green"><svg class="badge-leaf-icon" viewBox="0 0 20 20" fill="currentColor" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><path d="M17.3 3.2C17.1 2.5 16.4 2 15.6 2C11.2 2 7.6 4.4 5.4 8.2C3.8 11 3.2 14.2 3.7 16.8C3.8 17.5 4.4 18 5.1 18C5.3 18 5.4 18 5.6 17.9C6.9 17.4 8.3 17.2 9.7 17.2C13.1 17.2 16 15.4 17.5 12C18.3 10 18.3 7.5 17.9 5.2C17.8 4.4 17.6 3.7 17.3 3.2ZM6.4 15.6C7.2 12.4 9.2 9.4 12 7.4C10.2 10.2 8.6 13 6.4 15.6Z"/></svg><span>Green Cracker</span></span>';
  }
  const brand = String(prod.brand || '').trim();
  if (brand) {
    badgeHTML += `<span class="quickview-badge quickview-badge-brand">${escapeHtml(brand)}</span>`;
  }
  badgesEl.innerHTML = badgeHTML;
  badgesEl.style.display = badgeHTML ? 'flex' : 'none';

  // Image — same object-fit behaviour as the listing cards (no distortion)
  const imgEl = document.getElementById('quickview-img');
  if (prod.image) {
    imgEl.src = prod.image;
    imgEl.alt = prod.name;
    imgEl.style.display = 'block';
  } else {
    imgEl.style.display = 'none';
  }

  // Offer badge (bottom-right of the image band), only with a valid discount
  const discountEl = document.getElementById('quickview-discount');
  const hasValidDiscount = prod.discount && String(prod.discount).trim() !== '' && prod.discount !== 'Special';
  if (hasValidDiscount) {
    discountEl.innerHTML = `<span aria-hidden="true">🔥</span> <span>${escapeHtml(String(prod.discount).trim())}</span>`;
    discountEl.style.display = 'inline-flex';
  } else {
    discountEl.style.display = 'none';
  }

  // Details
  let categoryName = '';
  try {
    const cat = getCategories().find(c => String(c.id).toUpperCase() === String(prod.categoryId).toUpperCase());
    categoryName = cat ? cat.name : '';
  } catch (err) {
    console.warn('[QuickView] Category lookup failed:', err);
  }
  document.getElementById('quickview-category').textContent = categoryName;
  document.getElementById('quickview-title').textContent = prod.name;
  const descEl = document.getElementById('quickview-desc');
  descEl.textContent = prod.description || '';
  descEl.style.display = prod.description ? '' : 'none';
  document.getElementById('quickview-price').textContent = `₹${Number(prod.price).toLocaleString('en-IN')}`;
  const mrpEl = document.getElementById('quickview-mrp');
  mrpEl.textContent = hasValidDiscount ? `₹${Number(prod.originalPrice).toLocaleString('en-IN')}` : '';
  mrpEl.style.display = hasValidDiscount ? '' : 'none';
  document.getElementById('quickview-unit').textContent = prod.qty || '';

  // Action row + rating summary reflect the current cart/review state
  renderQuickViewActions();
  applyQuickViewRatingChip([]); // neutral chip until the fetch lands
  loadQuickViewRatingSummary(prod.id);

  // Fresh submission form per product (stars cleared, inputs emptied)
  const nameInput = document.getElementById('quickview-reviewer-name');
  const commentInput = document.getElementById('quickview-reviewer-comment');
  if (nameInput) nameInput.value = '';
  if (commentInput) commentInput.value = '';
  setQuickViewRating(0);

  root.style.display = 'flex';
  document.body.style.overflow = 'hidden'; // lock background scrolling
}

function closeProductQuickView() {
  const root = document.getElementById('product-quickview-modal');
  if (root) root.style.display = 'none';
  document.body.style.overflow = ''; // restore background scrolling
  window.quickViewProductId = null;
}

function quickViewAddToEstimate() {
  if (!window.quickViewProductId) return;
  catalogAddQty(window.quickViewProductId);
  const prod = getProducts().find(p => String(p.id) === String(window.quickViewProductId));
  if (prod && prod.inStock) {
    showToast(`${prod.name} added to your estimate.`, 'success');
    renderQuickViewActions(); // morphs into qty stepper + red Delete
  }
}

/** Interactive 1–5 star selector inside the Quick View review form. */
window.quickViewUserRating = 0;

function setQuickViewRating(n) {
  window.quickViewUserRating = n;
  document.querySelectorAll('#quickview-stars .quickview-star').forEach(star => {
    star.classList.toggle('star-active', Number(star.getAttribute('data-star')) <= n);
  });
}

/**
 * Submit the customer review into the 'product_reviews' Firestore
collection — the Admin Portal -> Product Reviews table streams the exact
same collection in realtime. Falls back to an in-memory/instant chip update
with an offline error toast when Firestore is unreachable.
 */
function submitUserReview() {
  if (!window.quickViewProductId) return;
  const nameEl = document.getElementById('quickview-reviewer-name');
  const commentEl = document.getElementById('quickview-reviewer-comment');
  const customerName = nameEl ? nameEl.value.trim() : '';
  const reviewComment = commentEl ? commentEl.value.trim() : '';

  if (window.quickViewUserRating < 1) { showToast('Please select a star rating.', 'error'); return; }
  if (!customerName) { showToast('Please enter your name.', 'error'); return; }
  if (!reviewComment) { showToast('Please write a short review.', 'error'); return; }

  const prod = getProducts().find(p => String(p.id) === String(window.quickViewProductId));
  if (!prod) return;

  const serverTs = (window.firebase && firebase.firestore && firebase.firestore.FieldValue)
    ? firebase.firestore.FieldValue.serverTimestamp()
    : Date.now();

  if (!window.db) {
    console.error('[QuickView] window.db is NULL — cannot submit review to Firestore.');
    showToast('Not connected to the server. Review not submitted.', 'error');
    return;
  }

  window.db.collection('product_reviews').add({
    productId: String(prod.id),
    productName: prod.name,
    customerName,
    rating: window.quickViewUserRating,
    reviewComment,
    createdAt: serverTs
  })
    .then(() => {
      console.log('[QuickView] Review submitted for', prod.id);
      // Update the chip instantly (no need to wait for a re-fetch)
      const key = String(prod.id);
      const list = window.quickViewReviewsCache[key] || [];
      window.quickViewReviewsCache[key] = [{ rating: window.quickViewUserRating }].concat(list);
      applyQuickViewRatingChip(window.quickViewReviewsCache[key]);
      if (nameEl) nameEl.value = '';
      if (commentEl) commentEl.value = '';
      setQuickViewRating(0);
      showToast('Review submitted. Thank you!', 'success');
    })
    .catch(err => {
      const code = err.code || 'unknown';
      console.error('[QuickView] Review submit FAILED. Code:', code, 'Message:', err.message, err);
      showToast('Could not submit review [' + code + ']', 'error');
    });
}

/* --------------------------------------------------------------------------
   Full-screen Image Lightbox (click/tap on the Quick View thumbnail)
   Manual zoom ONLY — no hover zoom. Wheel, two-pointer pinch, double-tap
   and double-click all drive a translate+scale transform on the image.
   Drag to pan while zoomed; ✕ or tapping outside resets/closes.
   -------------------------------------------------------------------------- */
window.lightboxScale = 1;
window.lightboxTx = 0;
window.lightboxTy = 0;
window.lightboxMoved = false;

function ensureImageLightbox() {
  let lb = document.getElementById('image-lightbox-overlay');
  if (lb) return lb;

  lb = document.createElement('div');
  lb.id = 'image-lightbox-overlay';
  lb.className = 'image-lightbox-overlay';
  lb.innerHTML = `
    <div class="image-lightbox-controls">
      <button type="button" class="image-lightbox-close" onclick="resetAndCloseLightbox()" aria-label="Close image view">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M6 18L18 6M6 6l12 12"/></svg>
      </button>
    </div>
    <div class="image-lightbox-container" id="lightbox-container">
      <img id="lightbox-img" src="" alt="Zoomed product image" draggable="false">
    </div>
    <p class="image-lightbox-hint">Double tap / Pinch to zoom &bull; Tap outside to reset</p>
  `;
  document.body.appendChild(lb);
  wireImageLightboxInteractions(lb);
  return lb;
}

function clampLightboxScale(s) {
  return Math.min(4, Math.max(1, s));
}

function applyLightboxTransform() {
  const img = document.getElementById('lightbox-img');
  if (!img) return;
  if (window.lightboxScale <= 1) {
    window.lightboxScale = 1;
    window.lightboxTx = 0;
    window.lightboxTy = 0;
  }
  img.style.transform = `translate(${window.lightboxTx}px, ${window.lightboxTy}px) scale(${window.lightboxScale})`;
}

function resetLightboxTransform() {
  window.lightboxScale = 1;
  window.lightboxTx = 0;
  window.lightboxTy = 0;
  window.lightboxMoved = false;
  const img = document.getElementById('lightbox-img');
  if (img) img.style.transform = '';
}

function openImageLightbox() {
  const thumb = document.getElementById('quickview-img');
  if (!thumb || !thumb.getAttribute('src') || thumb.style.display === 'none') return;
  const lb = ensureImageLightbox();
  document.getElementById('lightbox-img').src = thumb.src;
  resetLightboxTransform();
  lb.style.display = 'flex';
  // body scroll stays locked (Quick View beneath also locks it)
}

function closeImageLightbox() {
  const lb = document.getElementById('image-lightbox-overlay');
  if (lb) lb.style.display = 'none';
  resetLightboxTransform();
  // Restore page scrolling only when the Quick View beneath is closed too
  const qv = document.getElementById('product-quickview-modal');
  if (!qv || qv.style.display === 'none') {
    document.body.style.overflow = '';
  }
}

function resetAndCloseLightbox() {
  closeImageLightbox();
}

function toggleLightboxZoom() {
  if (window.lightboxScale > 1) {
    resetLightboxTransform(); // back to fit
  } else {
    window.lightboxScale = 2.5;
    applyLightboxTransform();
  }
}

function handleLightboxClick(e) {
  if (e.target.id === 'lightbox-img') return; // clicks on the photo itself don't close
  if (window.lightboxMoved) { window.lightboxMoved = false; return; } // end of a drag
  if (window.lightboxScale > 1) {
    resetLightboxTransform(); // zoomed: tap outside returns to original fit
  } else {
    closeImageLightbox();     // already fitted: tap outside closes
  }
}

function wireImageLightboxInteractions(lb) {
  const container = lb.querySelector('#lightbox-container');
  const img = lb.querySelector('#lightbox-img');
  const pointers = new Map();
  let pinchStartDist = 0;
  let pinchStartScale = 1;
  let lastDrag = null;
  let lastTapTime = 0;
  let suppressClick = false;

  container.addEventListener('pointerdown', (e) => {
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (container.setPointerCapture) container.setPointerCapture(e.pointerId);
    if (pointers.size === 2) {
      const [p1, p2] = [...pointers.values()];
      pinchStartDist = Math.hypot(p2.x - p1.x, p2.y - p1.y);
      pinchStartScale = window.lightboxScale;
    } else if (pointers.size === 1) {
      lastDrag = { x: e.clientX, y: e.clientY };
    }
    img.classList.add('dragging');
  });

  container.addEventListener('pointermove', (e) => {
    if (!pointers.has(e.pointerId)) return;
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.size === 2 && pinchStartDist > 0) {
      // Pinch-to-zoom (two pointers, any input type)
      const [p1, p2] = [...pointers.values()];
      const dist = Math.hypot(p2.x - p1.x, p2.y - p1.y);
      window.lightboxScale = clampLightboxScale(pinchStartScale * (dist / pinchStartDist));
      suppressClick = true;
      applyLightboxTransform();
    } else if (pointers.size === 1 && window.lightboxScale > 1 && lastDrag) {
      // Drag-to-pan while zoomed
      const dx = e.clientX - lastDrag.x;
      const dy = e.clientY - lastDrag.y;
      if (Math.abs(dx) + Math.abs(dy) > 3) {
        window.lightboxMoved = true;
        suppressClick = true;
      }
      window.lightboxTx += dx;
      window.lightboxTy += dy;
      lastDrag = { x: e.clientX, y: e.clientY };
      applyLightboxTransform();
    }
  });

  const endPointer = (e) => {
    pointers.delete(e.pointerId);
    if (pointers.size < 2) pinchStartDist = 0;
    if (pointers.size === 0) {
      lastDrag = null;
      img.classList.remove('dragging');
    }
  };
  container.addEventListener('pointerup', endPointer);
  container.addEventListener('pointercancel', endPointer);

  // Mouse-wheel zoom (desktop)
  container.addEventListener('wheel', (e) => {
    e.preventDefault();
    window.lightboxScale = clampLightboxScale(window.lightboxScale * (e.deltaY < 0 ? 1.15 : 0.87));
    applyLightboxTransform();
  }, { passive: false });

  // Double-click zoom toggle (desktop)
  container.addEventListener('dblclick', (e) => {
    e.preventDefault();
    toggleLightboxZoom();
  });

  // Double-tap zoom toggle (touch)
  container.addEventListener('touchend', (e) => {
    const now = Date.now();
    if (now - lastTapTime < 300 && e.touches.length === 0) {
      e.preventDefault();
      toggleLightboxZoom();
      lastTapTime = 0;
      suppressClick = true;
    } else {
      lastTapTime = now;
    }
  }, { passive: false });

  // Single tap outside the image: reset zoom, or close when already fitted
  container.addEventListener('click', (e) => {
    if (suppressClick) { suppressClick = false; window.lightboxMoved = false; return; }
    handleLightboxClick(e);
  });
}

// Card click (outside wishlist / action controls) opens the quick view.
document.addEventListener('click', (e) => {
  if (e.target.closest('#product-quickview-modal') || e.target.closest('#image-lightbox-overlay')) return; // clicks inside the modal / lightbox itself
  const card = e.target.closest('.product-card');
  if (!card) return;
  if (e.target.closest('.card-wishlist-btn, .action-container-right')) return;
  const actionEl = card.querySelector('[data-action-for]');
  const prodId = actionEl ? actionEl.getAttribute('data-action-for') : null;
  if (prodId) openProductQuickView(prodId);
});

// ESC closes the top-most layer: lightbox first, then the quick view.
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    const lb = document.getElementById('image-lightbox-overlay');
    if (lb && lb.style.display === 'flex') { closeImageLightbox(); return; }
    const root = document.getElementById('product-quickview-modal');
    if (root && root.style.display !== 'none') closeProductQuickView();
  }
});

/** Public wishlist toggle (used by the inline onclick handlers). */
function toggleWishlist(productId) {
  handleWishlistClick(productId);
}

/** Heart click — anonymous visitors must sign in first (then we auto-save). */
function handleWishlistClick(productId) {
  const user = getKprAuthUser();
  if (!user) {
    window.pendingWishlistId = String(productId);
    openAuthModal();
    switchAuthTab('signin');
    showAuthNotice('Please sign in to save this item to your KPR Wishlist.', 'info');
    return;
  }
  toggleWishlistItem(String(productId), user);
}

/** Add/remove a product id in wishlists/{uid} via arrayUnion / arrayRemove. */
function toggleWishlistItem(productId, user) {
  const authUser = user || getKprAuthUser();
  if (!window.db || !authUser) {
    if (typeof showToast === 'function') showToast('Wishlist is unavailable right now. Please try again.', 'error');
    return;
  }

  const saved = (window.userWishlist || []).indexOf(String(productId)) !== -1;
  const fieldOp = saved
    ? firebase.firestore.FieldValue.arrayRemove(String(productId))
    : firebase.firestore.FieldValue.arrayUnion(String(productId));

  window.db.collection('wishlists').doc(authUser.uid)
    // `items` is the canonical field; `productIds` is kept as a legacy mirror.
    .set({
      items: fieldOp,
      productIds: fieldOp,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    }, { merge: true })
    .then(() => {
      const ids = window.userWishlist || [];
      const idx = ids.indexOf(String(productId));
      if (!saved && idx === -1) ids.push(String(productId));
      if (saved && idx !== -1) ids.splice(idx, 1);
      window.userWishlist = ids;

      updateWishlistUI();
      if (typeof showToast === 'function') {
        showToast(saved ? 'Removed from your wishlist.' : 'Saved to your wishlist!', 'success');
      }
    })
    .catch((err) => {
      // Non-fatal: a locked-down wishlist must never break the shopping flow.
      console.warn('Wishlist permission note: Ensure Firestore rules allow read/write for wishlists collection.', err);
      if (typeof showToast === 'function') showToast('Could not update your wishlist. Please try again.', 'error');
    });
}

/**
 * Fetch the signed-in client's wishlist (Firestore: wishlists/{uid}) WITHOUT
 * breaking the app when the read is blocked by Firestore rules or connectivity:
 * the failure is logged as a non-fatal warning and the wishlist simply renders
 * empty. Docs written with either the `items` field or the legacy `productIds`
 * mirror are accepted.
 * @param {string} uid - Firebase Auth uid of the signed-in client
 * @param {Function} [callback] - Optional callback fired after a successful load
 */
function fetchUserWishlist(uid, callback) {
  if (!uid) return;

  if (!window.db) {
    console.warn('[Wishlist] Firestore unavailable — skipping wishlist fetch.');
    window.userWishlist = [];
    updateWishlistUI();
    return;
  }

  window.db.collection('wishlists').doc(uid).get()
    .then((doc) => {
      const data = doc.exists ? (doc.data() || {}) : {};
      const saved = Array.isArray(data.items)
        ? data.items
        : (Array.isArray(data.productIds) ? data.productIds : []);
      window.userWishlist = saved.map(String);
      updateWishlistUI();
      if (typeof callback === 'function') callback();
    })
    .catch((err) => {
      console.warn('Wishlist permission note: Ensure Firestore rules allow read/write for wishlists collection.', err);
      window.userWishlist = [];
      updateWishlistUI();
    });
}

/**
 * Central repaint after any wishlist data change: refreshes every heart button
 * on screen and the dashboard wishlist grid when it is visible.
 */
function updateWishlistUI() {
  syncWishlistHearts();
  const wishSection = document.getElementById('wishlistSection');
  if (isAccountDashboardVisible() && wishSection && !wishSection.classList.contains('hidden')) {
    renderWishlistSection();
  }
}

/** Load the wishlist for the current auth session (kept for existing callers). */
function loadWishlistForUser(user) {
  if (!user) {
    window.userWishlist = [];
    updateWishlistUI();
    return;
  }
  fetchUserWishlist(user.uid);
}

/** Sync every visible heart button with the cached wishlist ids. */
function syncWishlistHearts() {
  document.querySelectorAll('[data-wishlist-btn]').forEach((btn) => {
    const saved = (window.userWishlist || []).indexOf(String(btn.getAttribute('data-product-id'))) !== -1;
    btn.classList.toggle('wishlist-active', saved);
    // The FA SVG/JS kit replaces <i> elements with <svg> on production, so
    // re-inject the correct <i> markup when it is no longer present (the kit's
    // MutationObserver re-renders it automatically).
    let icon = btn.querySelector('i');
    if (!icon) {
      btn.innerHTML = saved
        ? '<i class="fa-solid fa-heart text-red-500 text-lg"></i>'
        : '<i class="fa-regular fa-heart text-gray-400 text-lg"></i>';
      icon = btn.querySelector('i');
    }
    if (icon) icon.className = saved ? 'fa-solid fa-heart text-red-500 text-lg' : 'fa-regular fa-heart text-gray-400 text-lg';
  });
}

/* ---------- Dashboard "My Wishlist" tab ---------- */

/** Switch the account dashboard between the Orders and Wishlist tabs. */
function showDashboardTab(tab) {
  const ordersTab = document.getElementById('dashTabOrders');
  const wishTab = document.getElementById('dashTabWishlist');
  const ordersSection = document.getElementById('ordersHistorySection');
  const wishSection = document.getElementById('wishlistSection');
  const showWish = (tab === 'wishlist');

  if (ordersTab) ordersTab.classList.toggle('active', !showWish);
  if (wishTab) wishTab.classList.toggle('active', showWish);
  if (ordersSection) ordersSection.classList.toggle('hidden', showWish);
  if (wishSection) wishSection.classList.toggle('hidden', !showWish);

  if (showWish) renderWishlistSection();

  // Bring the freshly-selected section into view instead of snapping to the
  // top of the page — tab switching stays a local, in-place action.
  const activeSection = showWish ? wishSection : ordersSection;
  if (activeSection) {
    try {
      activeSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } catch (e) {
      // Older browsers without options-object support
      try { activeSection.scrollIntoView(true); } catch (e2) {}
    }
  }
}

/** Render the saved wishlist items (with Add to Cart / Remove actions). */
function renderWishlistSection() {
  const grid = document.getElementById('wishlistItemsGrid');
  if (!grid) return;

  const user = getKprAuthUser();
  if (!user) {
    grid.innerHTML = '<div class="dash-orders-message"><strong>Please sign in to view your wishlist.</strong></div>';
    return;
  }

  const ids = window.userWishlist || [];
  if (!ids.length) {
    grid.innerHTML = '<div class="dash-orders-message"><strong>Your wishlist is empty</strong>Tap the heart icon on any product card to save it here for later.</div>';
    return;
  }

  const catalog = (typeof getProducts === 'function') ? getProducts() : [];
  const cards = [];
  ids.forEach((id) => {
    const prod = catalog.find((p) => String(p.id) === String(id));
    if (!prod) return; // product was removed from the catalog

    const catLetter = String(prod.categoryId).toUpperCase();
    const bgIndex = (catLetter.charCodeAt(0) - 64) % 9 + 1;
    let imgContent = `<div class="card-placeholder-bg p-bg-${bgIndex}"><i class="fa-solid fa-fire"></i></div>`;
    if (prod.image) {
      imgContent = `<img src="${prod.image}" alt="${prod.name}" class="wishlist-item-img">`;
    }

    // Same discount rules as the catalog grid: only the % badge shows —
    // brand / green-cracker chips and the description are deliberately
    // omitted from wishlist cards.
    const hasValidDiscount = prod.discount && String(prod.discount).trim() !== '' && prod.discount !== 'Special';
    const qty = getCartQty(prod.id);

    cards.push(`
      <div class="wishlist-item-card${!prod.inStock ? ' out-of-stock' : ''}" onclick="openProductQuickView('${wishlistJsId(prod.id)}')" title="View product details">
        <!-- Filled red heart (catalog style) = unlike. Its inline handler
             already stopPropagation()s, so it never opens the modal; the
             toggle re-renders this grid via updateWishlistUI(). -->
        ${getWishlistBtnHTML(prod.id)}
        <div class="card-img-container">
          ${imgContent}
        </div>
        <div class="wishlist-item-body">
          <div class="wishlist-item-info">
            <h3 class="wishlist-item-name" title="${escapeHtml(prod.name)}">${prod.name}</h3>
            <!-- Catalog-identical badge row (Green Cracker / brand chips) -->
            ${getProductBadgeRowHTML(prod)}
            <span class="wishlist-item-qty">${prod.qty || ''}</span>
          </div>
          <!-- Price ⇄ ADD/stepper share one row on mobile, stack on desktop.
               The offer chip lives inline next to the strike-through price —
               the image tile stays clean (no overlay). -->
          <div class="wishlist-item-foot">
            <p class="wishlist-item-price">₹${prod.price}${hasValidDiscount && prod.originalPrice ? ` <s class="wishlist-original-price">₹${prod.originalPrice}</s>` : ''}${hasValidDiscount ? ` <span class="wishlist-offer-badge">${prod.discount}</span>` : ''}</p>
            <div class="wishlist-item-actions">
              <!-- Catalog-identical ADD ⇄ stepper toggle (globally synced by
                   syncProductAction on every cart change). The wrapper swallows
                   clicks so pressing anywhere in the action zone — including
                   gaps and the qty count — never bubbles into the card's modal
                   handler; the inner ADD/step buttons stopPropagation too. -->
              <div class="action-container-right wishlist-action" data-action-for="${prod.id}" onclick="event.stopPropagation()">${buildProductActionInner(prod.id, qty, prod.inStock)}</div>
            </div>
          </div>
        </div>
      </div>
    `);
  });

  grid.innerHTML = cards.length
    ? cards.join('')
    : '<div class="dash-orders-message"><strong>Your wishlist is empty</strong>Saved items are no longer available in the catalog.</div>';
}

/** "Add to Cart" from the wishlist — reuses the shared cart quantity logic. */
function wishlistAddToCart(prodId) {
  const prod = (typeof getProducts === 'function' ? getProducts() : []).find((p) => String(p.id) === String(prodId));
  if (!prod || !prod.inStock) {
    if (typeof showToast === 'function') showToast('This item is currently out of stock.', 'error');
    return;
  }
  updateCartItemQuantity(prodId, getCartQty(prodId) + 1);
  if (typeof showToast === 'function') showToast('Added to your cart from the wishlist.', 'success');
}

/**
 * [receipt] Download Receipt — opens a print-ready receipt window (items, financial
 * breakdown, order details) generated from the cached dashboard order.
 * "Save as PDF" in the browser print dialog produces the downloadable file.
 * @param {string} docId - Firestore doc id of the order (from the order card).
 */
function downloadOrderReceipt(docId) {
  const order = window.dashOrdersCache ? window.dashOrdersCache[docId] : null;
  if (!order) {
    if (typeof showToast === 'function') showToast('Receipt data not found. Please refresh your orders and try again.', 'error');
    return;
  }

  const user = getKprAuthUser();
  const placedOn = order.timestamp
    ? order.timestamp.toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
    : 'Date unavailable';
  const total = Number(order.grandTotal || 0);
  const breakdown = order.breakdown || {};
  const items = Array.isArray(order.items) ? order.items : [];

  // Spin-wheel free-gift detection on saved order lines: explicit flags,
  // a ₹0 unit price, or the GIFT- id prefix (older snapshots). Also strips
  // any legacy " (FREE GIFT 🎁)" name suffix so the (FREE) tag stays uniform.
  const isFreeReceiptLine = (it) => Number(it.unitPrice || 0) === 0
    || !!(it.isGift || it.isFreeGift || it.isSpinReward || it.isFree)
    || String(it.id || '').indexOf('GIFT-') === 0;
  const cleanReceiptName = (nm) => String(nm || 'Item').replace(/\s*\((FREE GIFT|FREE)[^)]*\)\s*$/i, '').trim() || 'Item';

  const itemRows = items.length
    ? items.map((it) => {
        const qty = Number(it.quantity || 0);
        const unit = Number(it.unitPrice || 0);
        const lineTotal = Number(it.totalPrice || (qty * unit));
        const rawName = it.productName || it.name || 'Item';
        const dispName = isFreeReceiptLine(it) ? cleanReceiptName(rawName) + ' (FREE)' : rawName;
        return '<tr><td>' + escapeHtml(dispName) + '</td>'
          + '<td style="text-align:center;">' + qty + '</td>'
          + '<td style="text-align:right;">₹' + escapeHtml(unit.toLocaleString('en-IN')) + '</td>'
          + '<td style="text-align:right;">₹' + escapeHtml(lineTotal.toLocaleString('en-IN')) + '</td></tr>';
      }).join('')
    : '<tr><td colspan="4" style="text-align:center;">Item details not available for this order</td></tr>';

  const moneyRow = (label, value) => (value === undefined || value === null)
    ? ''
    : '<tr><td colspan="3" style="text-align:right;">' + escapeHtml(label) + '</td>'
      + '<td style="text-align:right;">₹' + escapeHtml(Number(value || 0).toLocaleString('en-IN')) + '</td></tr>';

  // "Spin Wheel Reward" row: shows the FREE product's name instead of a ₹0
  // amount. Falls back to the legacy money row only for older orders that
  // recorded a discount figure but no gift line.
  const giftLine = items.find(isFreeReceiptLine);
  const spinRewardName = giftLine
    ? cleanReceiptName(giftLine.productName || giftLine.name || 'Free Gift')
    : (breakdown.spinWheelRewardName || order.spinWheelRewardName || null);
  const spinRow = spinRewardName
    ? '<tr><td colspan="3" style="text-align:right;">Spin Wheel Reward</td>'
      + '<td style="text-align:right;">' + escapeHtml(spinRewardName) + '</td></tr>'
    : moneyRow('Spin Wheel Reward', breakdown.spinWheelDiscount);

  const breakdownRows = moneyRow('Total (original)', breakdown.totalOriginal)
    + moneyRow('Discounted Total', breakdown.totalDiscounted)
    + moneyRow('Coupon Discount', breakdown.couponDiscount)
    + spinRow
    + moneyRow('Non-Discounted Items', breakdown.nonDiscountedTotal);

  const win = window.open('', '_blank', 'width=820,height=940');
  if (!win) {
    if (typeof showToast === 'function') showToast('Please allow pop-ups for this site to download receipts.', 'error');
    return;
  }

  win.document.write(
    '<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Receipt ' + escapeHtml(order.orderId) + ' — KPR Crackers</title>'
    + '<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.2/css/all.min.css">'
    + '<style>body{font-family:Arial,Helvetica,sans-serif;color:#111827;margin:32px;}'
    + 'h1{font-size:20px;margin:0 0 2px;}h2{font-size:14px;margin:18px 0 8px;}'
    + '.muted{color:#6b7280;font-size:12px;margin:0 0 10px;}'
    + 'table{width:100%;border-collapse:collapse;font-size:12px;}'
    + 'th,td{border:1px solid #e5e7eb;padding:7px 9px;}th{background:#f3f4f6;text-align:left;}'
    + '.grand td{font-weight:bold;background:#f0fdf4;}'
    + '@media print{.no-print{display:none;}}</style></head><body>'
    + '<h1>KPR Crackers — Order Receipt</h1>'
    + '<p class="muted">Premium Sivakasi Firecrackers · Sivakasi, Tamil Nadu · +91 97894 32373</p>'
    + '<p class="muted"><strong>Order ID:</strong> ' + escapeHtml(order.orderId)
    + ' &nbsp;·&nbsp; <strong>Placed:</strong> ' + escapeHtml(placedOn)
    + ' &nbsp;·&nbsp; <strong>Status:</strong> ' + escapeHtml(String(order.status || 'new')) + '</p>'
    + '<p class="muted"><strong>Client:</strong> ' + escapeHtml((user && (user.displayName || user.email)) || 'KPR Client') + '</p>'
    + '<h2>Items</h2>'
    + '<table><thead><tr><th>Product</th><th style="text-align:center;">Qty</th>'
    + '<th style="text-align:right;">Unit Price</th><th style="text-align:right;">Total</th></tr></thead>'
    + '<tbody>' + itemRows + '</tbody></table>'
    + '<h2>Payment Summary</h2>'
    + '<table><tbody>' + breakdownRows
    + '<tr class="grand"><td colspan="3" style="text-align:right;">GRAND TOTAL</td>'
    + '<td style="text-align:right;">₹' + escapeHtml(total.toLocaleString('en-IN')) + '</td></tr>'
    + '</tbody></table>'
    + '<p class="muted" style="margin-top:18px;">This is a computer-generated receipt for your enquiry order with KPR Crackers.</p>'
    + '<button class="no-print" onclick="window.print()" style="padding:10px 18px;border:none;border-radius:8px;background:#0f172a;color:#fff;font-weight:bold;cursor:pointer;margin-top:12px;"><i class="fa-solid fa-print"></i> Print / Save as PDF</button>'
    + '</body></html>'
  );
  win.document.close();
  win.focus();
  setTimeout(() => { try { win.print(); } catch (e) {} }, 400);
}

/** Dashboard "[cart] Place New Order" — close the view and go to the catalog. */
function showProductsPage() {
  hideAccountDashboard();
  window.location.href = 'products.html';
}

/** Sign the client out of the KPR Client Portal — the visible cart is cleared
 *  so the next visitor on this device starts fresh (applyCartOwnership). */
function kprSignOut() {
  const auth = getKprAuth();
  if (!auth) return;

  auth.signOut()
    .then(() => {
      window.currentKprUser = null;
      window.pendingOrderSubmit = null;
      window.pendingWishlistId = null;
      window.userWishlist = [];
      window.dashOrdersCache = {};
      closeUserDropdown();
      if (isDashboardPage()) {
        // Stay on the Profile page: swap to the full guest layout instead of
        // hiding the view (hiding it left only header + footer on screen).
        renderDashboardGuestState();
      } else {
        hideAccountDashboard();
      }
      renderHeaderUserAccount(null);
      syncWishlistHearts();
      applyCartOwnership(null); // deterministic immediate clear
      if (typeof showToast === 'function') showToast('You have signed out of the KPR Client Portal.', 'info');
    })
    .catch((err) => console.error('[Portal] Sign out failed:', err));
}

/* ---------- Portal bootstrap ---------- */
/**
 * During a parked-dashboard arrival (profile-icon click on another page ->
 * index.html#account), the plain homepage would otherwise paint first and
 * then visibly "jump" to the dashboard once Firebase restores the session
 * (the reported redirect flicker/glitch). Masking the page behind the
 * full-screen preloader — which photo-covers everything until it fades —
 * keeps the transition a clean loader -> dashboard, with Home never shown.
 * No-op on every normal visit (no pending marker).
 */
function maskHomeUntilDashboard() {
  let pending = false;
  try {
    pending = !!sessionStorage.getItem('kpr_pending_dashboard_open')
      || !!sessionStorage.getItem('kpr_open_account_dashboard')
      || window.location.hash === '#account';
  } catch (e) { pending = (window.location.hash === '#account'); }
  if (!pending) return;
  if (!document.getElementById('accountDashboardView')) return;

  try { document.body.classList.add('preloader-active'); } catch (e) {}

  const preloader = document.getElementById('preloader');
  if (preloader) {
    // Hold the loader on screen (well past its normal minimum) while the
    // dashboard is still pending; it is released by unmaskHomeForDashboard().
    preloader.classList.remove('preloader-hidden');
    preloader.setAttribute('data-dashboard-mask', '1');
  }
}

/**
 * Release the mask applied by maskHomeUntilDashboard() once the dashboard
 * has actually painted (called from showAccountDashboard) or when the flow
 * ends at the sign-in modal instead (called from attemptPendingDashboardOpen).
 */
function unmaskHomeForDashboard() {
  let preloader = null;
  try { preloader = document.getElementById('preloader'); } catch (e) { preloader = null; }
  if (preloader && preloader.getAttribute('data-dashboard-mask') === '1') {
    preloader.removeAttribute('data-dashboard-mask');
    preloader.classList.add('preloader-hidden');
    setTimeout(function () {
      try { if (preloader.parentNode) preloader.parentNode.removeChild(preloader); } catch (e) {}
    }, 700);
  }
  try { document.body.classList.remove('preloader-active'); } catch (e) {}
}

/**
 * Complete a parked "open the Client Dashboard" request, if one exists.
 * The pending marker ('kpr_pending_dashboard_open') is parked by the
 * wantsDashboard branch below and retried here because arrival on
 * index.html#account routinely happens BEFORE Firebase restores the
 * session — reading auth.currentUser synchronously at bootstrap would see
 * null, wrongly conclude "signed out", and strand the user on Home
 * (the reported double-click bug).
 *
 * @param {Object|null} [knownUser] - user from onAuthStateChanged when
 *   invoked from the auth callback; undefined when invoked from bootstrap.
 */
function attemptPendingDashboardOpen(knownUser) {
  let pending = false;
  try {
    pending = !!sessionStorage.getItem('kpr_pending_dashboard_open')
      || !!sessionStorage.getItem('kpr_open_account_dashboard')
      || !!sessionStorage.getItem('kpr_dash_user_waiting')
      || window.location.href === '#account';
  } catch (e) {
    pending = window.location.hash === '#account';
  }
  if (!pending) return;

  const auth = (typeof getKprAuth === 'function') ? getKprAuth() : null;
  const user = (typeof knownUser !== 'undefined')
    ? knownUser
    : (typeof getKprAuthUser === 'function' ? getKprAuthUser() : (auth ? auth.currentUser : null));

  // Auth SDK still initialising and no callback user yet -> retry shortly;
  // the onAuthStateChanged invocation of this same function will land the
  // open with the real user. Bounded retries guard the (rare) path where
  // the callback never fires.
  if (!user && typeof knownUser === 'undefined') {
    if (!window._kprPendingDashRetries) window._kprPendingDashRetries = 0;
    if (window._kprPendingDashRetries < 40) { // ~10s @ 250ms
      window._kprPendingDashRetries += 1;
      setTimeout(function () { attemptPendingDashboardOpen(); }, 250);
    } else {
      try { sessionStorage.removeItem('kpr_pending_dashboard_open'); } catch (e) {}
      try { sessionStorage.removeItem('kpr_dash_user_waiting'); } catch (e) {}
      if (typeof unmaskHomeForDashboard === 'function') unmaskHomeForDashboard();
      if (typeof openAuthModal === 'function') openAuthModal();
      if (typeof showAuthNotice === 'function') showAuthNotice('Please sign in to view your order history.', 'info');
    }
    return;
  }

  try { sessionStorage.removeItem('kpr_pending_dashboard_open'); } catch (e) {}
  try { sessionStorage.removeItem('kpr_dash_user_waiting'); } catch (e) {}
  window._kprPendingDashRetries = 0;

  if (user) {
    if (typeof showAccountDashboard === 'function') showAccountDashboard(user);
    if (typeof fetchUserOrders === 'function') fetchUserOrders();
  } else {
    if (typeof unmaskHomeForDashboard === 'function') unmaskHomeForDashboard();
    if (typeof openAuthModal === 'function') openAuthModal();
    if (typeof showAuthNotice === 'function') showAuthNotice('Please sign in to view your order history.', 'info');
  }
}

/** Wire the portal into the page: auth state, Escape-to-close, redirect resume. */
function initClientPortalAuth() {
  const auth = getKprAuth();
  if (!auth) return;

  // A plain visit to the Home page (index.html) must NEVER resurrect the Client
  // Dashboard. Any dashboard-pending markers still in sessionStorage are stale
  // leftovers — e.g. 'kpr_dash_user_waiting' parked on dashboard.html but left
  // behind when the user clicked "Home" before its 8s cleanup fired — which
  // would otherwise make app.js re-open the dashboard the instant Home mounts
  // (the reported "Home redirects back to Dashboard" bug). Consume them here so
  // authenticated users can browse Home freely. The dashboard is only ever
  // opened by an explicit action: clicking the profile / "My Orders" (which
  // navigates straight to dashboard.html) or an old #account deep-link, handled
  // by the forward branch below (which we intentionally leave untouched here).
  if (!isDashboardPage() && window.location.hash !== '#account') {
    try {
      sessionStorage.removeItem('kpr_dash_user_waiting');
      sessionStorage.removeItem('kpr_pending_dashboard_open');
      sessionStorage.removeItem('kpr_open_account_dashboard');
    } catch (e) {}
  }

  // Keep the header account button + pre-filled name in sync with the session.
  auth.onAuthStateChanged((user) => {
    window.currentKprUser = user || null;
    hydrateEnquiryFormFromAuth(user);
    renderHeaderUserAccount(user);
    loadWishlistForUser(user);
    // Cart isolation: reconcile the visible cart with THIS account once the
    // real session state is known (never before Firebase settles).
    applyCartOwnership(user);
    // REACTIVE profile dashboard rendering: the auth callback itself is the
    // single source of truth for this page's banner state — never rely on
    // the parked sessionStorage flags (a guest visit consumes/clears them
    // BEFORE the visitor signs in, which left the banner stuck on Guest
    // Mode even though sign-in had succeeded).
    if (user && isDashboardPage()) {
      // Flip the guest banner to the signed-in view the moment ANY sign-in
      // succeeds here (portal modal, Google redirect, cross-page restore).
      try { sessionStorage.removeItem('kpr_dash_user_waiting'); } catch (e) {}
      if (window._kprDashRenderedUid !== user.uid) {
        window._kprDashRenderedUid = user.uid;
        showAccountDashboard(user);
        fetchUserOrders();
      }
    } else if (!user && isDashboardPage()) {
      // Signed out (or definitive guest): paint the full guest layout, never
      // a blank body; also cancel the 8s fallback sign-in-modal timer so the
      // guest layout stands on its own.
      window._kprDashRenderedUid = null;
      try { sessionStorage.removeItem('kpr_dash_user_waiting'); } catch (e) {}
      if (window._kprDashTimeout) { clearTimeout(window._kprDashTimeout); window._kprDashTimeout = null; }
      renderDashboardGuestState();
    }
    // Finish any parked dashboard open from a cross-page profile-icon click.
    // On dashboard.html the view is also opened directly below, so this is
    // just the session-restore safety net.
    attemptPendingDashboardOpen(user);
  });

  // Dedicated dashboard page: open the view immediately (no hash tricks, no
  // masking needed — dashboard.html contains ONLY the dashboard). Signed-out
  // visitors get the sign-in modal instead. The view markup here is always
  // visible (no .hidden class), so paint it even before auth resolves.
  if (isDashboardPage()) {
    try { sessionStorage.removeItem('kpr_open_account_dashboard'); } catch (e) {}
    try { sessionStorage.removeItem('kpr_pending_dashboard_open'); } catch (e) {}
    if (typeof history !== 'undefined' && history.replaceState)
      history.replaceState(null, '', window.location.pathname + window.location.search);

    // Try to render immediately if the auth callback already resolved.
    // (On a fresh page load, the callback hasn't fired yet, so we park a
    // waiting flag instead of painting the dummy "Welcome, User" shell.)
    const nowUser = window.currentKprUser || auth.currentUser;
    if (nowUser) {
      window._kprDashRenderedUid = nowUser.uid; // the listener skips its own re-paint
      showAccountDashboard(nowUser);
      fetchUserOrders();
    } else {
      // Paint the GUEST layout immediately while Firebase restores the session
      // (prevents the fake "Welcome, User" shell and any blank-page flash).
      renderDashboardGuestState();
      // Park a waiting flag so onAuthStateChanged can finish the open with the
      // real user once it restores the session from IndexedDB / LocalStorage.
      try { sessionStorage.setItem('kpr_dash_user_waiting', JSON.stringify({waiting: true, ts: Date.now()})); } catch (e) {}
      // Safety net: if the callback never lands within 8 s, fall back to the
      // sign-in modal so the visitor isn't stuck on a blank/dummy dashboard.
      if (!window._kprDashTimeout) {
        window._kprDashTimeout = setTimeout(function () {
          let stillWaiting = false;
          try { stillWaiting = !!sessionStorage.getItem('kpr_dash_user_waiting'); } catch (e) { stillWaiting = false; }
          if (!stillWaiting) { window._kprDashTimeout = null; return; }
          // Auth may have resolved while we were waiting — if so, bail out.
          if (window.currentKprUser || auth.currentUser) {
            try { sessionStorage.removeItem('kpr_dash_user_waiting'); } catch (e) {}
            window._kprDashTimeout = null;
            return;
          }
          try { sessionStorage.removeItem('kpr_dash_user_waiting'); } catch (e) {}
          window._kprDashTimeout = null;
          if (typeof unmaskHomeForDashboard === 'function') unmaskHomeForDashboard();
          if (typeof openAuthModal === 'function') openAuthModal();
          if (typeof showAuthNotice === 'function') showAuthNotice('Please sign in to view your order history.', 'info');
        }, 8000);
      }
    }
    // Fall through to the Escape / outside-click bindings below.
  }

  // Legacy deep-link support: old index.html#account links (and any parked
  // cross-page flag predating the dashboard.html split) forward to the
  // dedicated page instead of rendering Home first.

  // Legacy deep-link support: old index.html#account links (and any parked
  // cross-page flag predating the dashboard.html split) forward to the
  // dedicated page instead of rendering Home first.
  //  • index.html#account            -> forward to dashboard.html
  //  • kpr_open_account_dashboard    -> parked by openMyOrders()/openClientDashboard()
  //                                     (kept for backward compatibility)
  // NOTE: the flag is consumed here, but arrival can happen BEFORE Firebase
  // restores the session (auth.currentUser is briefly null on a fresh page
  // load). In that case we re-park the flag and let the onAuthStateChanged
  // callback above finish the open.
  const wantsDashboard = (window.location.hash === '#account')
    || (() => { try { return !!sessionStorage.getItem('kpr_open_account_dashboard'); } catch (e) { return false; } })();
  if (wantsDashboard && !isDashboardPage()) {
    try { sessionStorage.removeItem('kpr_open_account_dashboard'); } catch (e) {}
    if (typeof history !== 'undefined' && history.replaceState) history.replaceState(null, '', window.location.pathname + window.location.search);
    // Preserve the intent across the forward so a signed-in arrival still
    // opens instantly even if the session is mid-restore.
    try { sessionStorage.setItem('kpr_open_account_dashboard', '1'); } catch (e) {}
    window.location.href = 'dashboard.html';
    return;
  }

  // Escape closes whichever portal overlay is open (keyboard accessibility)
  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape') return;
    closeUserDropdown();
    if (!isPortalOverlayHidden('kprAuthModal')) closeAuthModal();
    if (!isPortalOverlayHidden('kprOrdersModal')) closeMyOrdersModal();
  });

  // Any click outside the account button closes the profile dropdown.
  // (Clicks inside #headerUserAccount are ignored so the button itself can
  //  toggle the menu without immediately re-opening it.)
  document.addEventListener('click', (event) => {
    const wrap = document.getElementById('headerUserAccount');
    if (!wrap) return;
    if (event && event.target && wrap.contains(event.target)) return;
    closeUserDropdown();
  });

  // Running inside a legacy parked-dashboard arrival? The forward above
  // already redirected to dashboard.html, so there is nothing left to mask
  // here. (Kept as a no-op hook for backward compatibility.)
  if (typeof maskHomeUntilDashboard === 'function') {
    try { maskHomeUntilDashboard(); } catch (e) {}
  }

  // Complete a redirect-based Google sign-in (popup-blocked fallback). The
  // parked callback cannot survive the page reload, so the checkout entry
  // point is simply re-run once the user is confirmed.
  try {
    if (sessionStorage.getItem(KPR_PORTAL_PENDING_ACTION_KEY)) {
      auth.getRedirectResult()
        .then((result) => {
          try { sessionStorage.removeItem(KPR_PORTAL_PENDING_ACTION_KEY); } catch (e) {}
          if (result && result.user) {
            onClientPortalSignedIn(result.user, 'google-redirect');
            if (cart.length > 0) {
              console.log('[Portal] Resuming checkout after redirect sign-in...');
              checkoutCart();
            }
          }
        })
        .catch((err) => {
          try { sessionStorage.removeItem(KPR_PORTAL_PENDING_ACTION_KEY); } catch (e) {}
          console.warn('[Portal] getRedirectResult failed:', err);

          // Surface project-configuration failures (e.g. unauthorized domain)
          // so the customer is not silently dropped back with no explanation.
          const code = (err && err.code) ? err.code : '';
          if (code === 'auth/unauthorized-domain' || code === 'auth/unauthorized-hosting-domain'
            || code === 'auth/operation-not-allowed' || code === 'auth/configuration-not-found'
            || code === 'auth/admin-restricted-operation') {
            logPortalConfigHint(err, 'google');
            openAuthModal();
            switchAuthTab('signin');
            showAuthNotice(getFirebaseAuthErrorMessage(err, 'Google Sign-In Failed:', 'google'));
          }
        });
    }
  } catch (e) {
    // sessionStorage unavailable (private mode) — popup sign-in still works.
  }
}

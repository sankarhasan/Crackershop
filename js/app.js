// KPR Crackers - Storefront Logic (app.js)

// Global State variables
let cart = [];
let activeCategory = 'all';
let currentSlide = 0;
let carouselInterval = null;
const MINIMUM_ORDER_VALUE = 2000;

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
  renderMobileSlider();
  renderTestimonialsSlider();
  initContactMap();
  // initPromoCountdown(); // DISABLED: Now handled by Firebase-driven startOfferCountdown()
  initEnquiryForm();
  initWhatsAppWidget();
  initScrollAnimations();
  initNavbarScroll();
  loadCartFromStorage();
  initPreloader();
  initNoticeModal();
  setupNoticeTrigger();

  // Hydrate products from Firestore (async) then re-render catalog
  loadProductsFromFirestore().then(products => {
    renderProductsCatalog();
    renderMobileSlider();
  });

  // Hydrate banners from Firestore (async) then re-render carousel
  loadBannersFromFirestore().then(() => {
    initCarousel();
  });

  // Hydrate offer banner from Firestore (async) then render offer section
  loadOfferFromFirestore().then(offer => {
    renderOfferBanner(offer);
  });

  // Hydrate categories from Firestore (async) then re-render category grid, filters, and products
  console.log('[Categories] Starting Firestore hydration...');
  loadCategoriesFromFirestore()
    .then(categories => {
      console.log('[Categories] ✓ Firestore hydration complete. Categories loaded:', categories ? categories.length : 'undefined');
      console.log('[Categories] Re-rendering UI with Firestore data...');
      renderCategoriesGrid();
      renderFilterButtons();
      renderProductsCatalog(); // Re-render products to reflect any new category filters
      console.log('[Categories] ✓ UI re-render complete.');
    })
    .catch(err => {
      console.error('[Categories] ✗ Firestore hydration FAILED:', err);
      console.error('[Categories] Error details:', err.code, err.message);
      console.log('[Categories] Falling back to localStorage/defaults...');
      // Ensure UI still renders with localStorage cache or default categories
      try {
        renderCategoriesGrid();
        renderFilterButtons();
        renderProductsCatalog();
        console.log('[Categories] ✓ Fallback render complete.');
      } catch (renderErr) {
        console.error('[Categories] ✗ Fallback render also failed:', renderErr);
      }
    });
  
  // Close menu on nav link clicks
  const navLinks = document.querySelectorAll('.nav-link');
  const navMenu = document.getElementById('mobile-nav'); // Mobile drawer only
  const menuToggle = document.getElementById('menu-toggle');
  
  // Sync the hamburger/X icon to the current menu open state
  const syncHamburgerIcon = () => {
    const bars = menuToggle.querySelectorAll('.bar');
    if (bars.length < 3) return;
    if (menuToggle.classList.contains('active')) {
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
      navMenu.classList.remove('active');
      menuToggle.classList.remove('active');
      syncHamburgerIcon();
    });
  });
  
  // Hamburger toggle click: open/close the drawer and morph the icon
  menuToggle.addEventListener('click', () => {
    // Check the CURRENT state BEFORE toggling (so we sync the icon correctly)
    const willBeOpen = !menuToggle.classList.contains('active');
    
    navMenu.classList.toggle('active');
    menuToggle.classList.toggle('active');
    
    // Now set the icon to match the NEW state
    const bars = menuToggle.querySelectorAll('.bar');
    if (bars.length < 3) return;
    if (willBeOpen) {
      // Menu is now OPEN → show X icon
      bars[0].style.transform = 'rotate(-45deg) translate(-5px, 6px)';
      bars[1].style.opacity = '0';
      bars[2].style.transform = 'rotate(45deg) translate(-5px, -6px)';
    } else {
      // Menu is now CLOSED → show hamburger icon
      bars[0].style.transform = 'none';
      bars[1].style.opacity = '1';
      bars[2].style.transform = 'none';
    }
    
    initMobileMenuFooter();
  });

  // Inject JCS-style footer with fireworks into the mobile menu drawer
  function initMobileMenuFooter() {
    if (document.querySelector('.mobile-menu-footer')) return;
    const footer = document.createElement('div');
    footer.className = 'mobile-menu-footer';
    footer.innerHTML = `
      <div class="menu-fireworks">
        <span class="fw-particle"></span>
        <span class="fw-particle"></span>
        <span class="fw-particle"></span>
        <span class="fw-particle"></span>
        <span class="fw-particle"></span>
        <span class="fw-particle"></span>
        <span class="fw-particle"></span>
        <span class="fw-particle"></span>
      </div>
      <div class="menu-brand-title">\uD83C\uDF86 KPR Crackers</div>
      <div class="menu-brand-tagline">Your Joy is our Pride</div>
    `;
    navMenu.appendChild(footer);
  }
});

/* ==========================================================================
   1. Carousel Slider Banner (diwali greeting background auto-rotates)
   ========================================================================== */
function initCarousel() {
  const heroCarousel = document.getElementById('hero-carousel');
  if (!heroCarousel) return;

  // Avoid errors when there are no banners yet
  let currentSlideSafe = 0;


  // Ensure hero slides container exists
  let slidesContainer = document.getElementById('hero-slides');
  if (!slidesContainer) {
    slidesContainer = document.createElement('div');
    slidesContainer.id = 'hero-slides';
    heroCarousel.insertBefore(slidesContainer, heroCarousel.firstChild);
  }

  // Load banners from localStorage (admin updates this key)
  const banners = (function getBannersFromStorage() {
    const key = 'bannersData';
    const raw = localStorage.getItem(key);

    // First run defaults: keep the previous behavior (UI not empty), but still allow variable length.
    if (!raw) {
      const defaults = [
        { tagline: 'FESTIVAL OF LIGHTS', headingTitle: 'KPR Crackers', description: 'Explore premium Sivakasi firecrackers with safe delivery and unbeatable offers!', imageBase64: '' },
        { tagline: 'SUPER VALUE OFFER', headingTitle: 'Up To 40% OFF on Combo Packs', description: 'Grab curated combos packed with safety, brightness, and joy.', imageBase64: '' },
        { tagline: 'TRUST & SAFETY', headingTitle: '100% Quality & Safe Delivery', description: 'Sourced from top manufacturers in Sivakasi. Tested for safety and packaged securely.', imageBase64: '' }
      ];
      localStorage.setItem(key, JSON.stringify(defaults));
      return defaults;
    }

    try {
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) throw new Error('not array');

      const normalized = parsed.map(item => ({
        tagline: (item?.tagline ?? '').toString(),
        headingTitle: (item?.headingTitle ?? '').toString(),
        description: (item?.description ?? '').toString(),
        imageBase64: (item?.imageBase64 ?? '').toString()
      }));

      localStorage.setItem(key, JSON.stringify(normalized));
      return normalized;
    } catch (e) {
      localStorage.removeItem(key);
      return getBannersFromStorage();
    }
  })();


  const indicatorsWrap = heroCarousel.querySelector('.carousel-indicators');
  const prevBtn = document.getElementById('carousel-prev');
  const nextBtn = document.getElementById('carousel-next');

  // Render slides (dynamic length)
  slidesContainer.innerHTML = '';

  banners.forEach((b, i) => {
    const slide = document.createElement('div');
    slide.className = `carousel-slide ${i === 0 ? 'active' : ''}`;
    slide.setAttribute('data-slide', String(i));

    // Keep existing design layers
    const bgHtml = b.imageBase64
      ? `<div class="slide-bg" style="background-image:url('${b.imageBase64}'); background-size:cover; background-position:center;"></div>`
      : `<div class="slide-bg placeholder-gradient-${(i % 9) + 1}"></div>`;

    const overlay = `<div class="slide-overlay"></div>`;

    // Alternate banner content alignment: odd-indexed (1st, 3rd, 5th…) → right, even-indexed → left
    const alignClass = (i % 2 === 0) ? 'slide-align-right' : 'slide-align-left';

    const content = `
      <div class="container slide-content ${alignClass}">
        <h4 class="slide-subtitle text-glow">${escapeHtml(b.tagline || '')}</h4>
        <h1 class="slide-title">${escapeHtml(b.headingTitle || '')}</h1>
        <p class="slide-desc">${escapeHtml(b.description || '')}</p>
        <div class="slide-buttons">
          <a href="#products" class="btn btn-primary btn-lg">Shop Products Now</a>
          <a href="#quick-enquiry" class="btn btn-outline btn-lg">Quick Enquiry</a>
        </div>
      </div>
    `;

    slide.innerHTML = `${bgHtml}${overlay}${content}`;
    slidesContainer.appendChild(slide);
  });

  // If no banners exist, stop early
  if (banners.length === 0) return;


  // Render indicators (dynamic)
  if (indicatorsWrap) {
    indicatorsWrap.innerHTML = '';
    for (let i = 0; i < banners.length; i++) {
      const ind = document.createElement('span');
      ind.className = `indicator ${i === 0 ? 'active' : ''}`;
      ind.setAttribute('data-slide', String(i));
      indicatorsWrap.appendChild(ind);
    }
  }


  const slides = heroCarousel.querySelectorAll('.carousel-slide');
  const indicators = heroCarousel.querySelectorAll('.carousel-indicators .indicator');

  const showSlide = (index) => {
    if (!slides || slides.length === 0) return;

    slides.forEach(s => s.classList.remove('active'));
    indicators.forEach(i => i.classList.remove('active'));

    currentSlide = (index + slides.length) % slides.length;
    slides[currentSlide].classList.add('active');
    if (indicators[currentSlide]) indicators[currentSlide].classList.add('active');
  };


  const nextSlide = () => showSlide(currentSlide + 1);

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
function renderCategoriesGrid() {
  console.log('[renderCategoriesGrid] Function called.');
  
  const grid = document.getElementById('categories-grid');
  console.log('[renderCategoriesGrid] Grid element:', grid ? 'FOUND' : 'NOT FOUND');
  
  if (!grid) {
    console.error('[renderCategoriesGrid] ✗ Grid element not found! Aborting.');
    return;
  }
  
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
      card.style.transitionDelay = `${index * 50}ms`;
      card.setAttribute('onclick', `filterByCategory('${cat.slug}')`);
      
      // Create random or distinct gradient placeholders (fallback only)
      const emojiMap = {
        'ground-chakkars': '🌀',
        'flower-pots': '🌋',
        'fancy-fountains': '⛲',
        'pencils': '✏️',
        'sparklers': '✨',
        'atom-bombs': '💣',
        'rockets': '🚀',
        'bijili-crackers': '⚡',
        'combo-packs': '🎁'
      };
      const emoji = emojiMap[cat.slug] || '🎆';
      const bgClass = `cat-g-${(cat.id % 9) + 1}`;

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
          <span class="category-link">View Collection ➔</span>
        </div>
      `;
      grid.appendChild(card);
      console.log(`[renderCategoriesGrid] ✓ Category ${index} rendered: ${cat.name}`);
    } catch (cardErr) {
      console.error(`[renderCategoriesGrid] ✗ Error rendering category ${index}:`, cardErr, cat);
    }
  });
  
  console.log('[renderCategoriesGrid] ✓ Render complete. Grid children count:', grid.children.length);
}

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
  
  renderProductsCatalog();

  // Mobile: navigate slider to matching category slide
  if (window.innerWidth <= 768) {
    navigateMobileSliderTo(slug);
  }
  
  // Scroll to products
  document.getElementById('products').scrollIntoView({ behavior: 'smooth' });
}

/* ==========================================================================
   3. Product Catalog Grid with Search / Filters & Add-To-Cart
   ========================================================================== */
function renderFilterButtons() {
  const filterBar = document.getElementById('filter-bar');
  if (!filterBar) return;

  const categories = getCategories();

  // Explicitly set data-category="all" so the filter logic can reliably detect it.
  filterBar.innerHTML = '';

  const allBtn = document.createElement('button');
  allBtn.className = 'filter-btn active';
  allBtn.setAttribute('data-category', 'all');
  allBtn.innerText = 'All Items';
  allBtn.addEventListener('click', () => {
    document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
    allBtn.classList.add('active');
    activeCategory = 'all';
    updateMobileCategoryBanner();
    renderProductsCatalog();
  });

  filterBar.appendChild(allBtn);

  categories.forEach(cat => {
    const btn = document.createElement('button');
    btn.className = 'filter-btn';
    btn.setAttribute('data-category', cat.slug);
    btn.innerText = cat.name;

    btn.addEventListener('click', () => {
      document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      activeCategory = cat.slug;
      updateMobileCategoryBanner();
      renderProductsCatalog();
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

  // Filter products
  let filtered = products;

  if (!isAll) {
    const cat = categories.find(c => c.slug === normalizedCategory);
    if (cat) {
      filtered = products.filter(p => Number(p.categoryId) === Number(cat.id));
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
        🔍 No firecrackers match your search description. Try another keyword!
      </div>
    `;
    return;
  }

  filtered.forEach((prod, index) => {
    const card = document.createElement('div');
    card.className = `product-card ${!prod.inStock ? 'out-of-stock' : ''}`;
    
    // Category mapping for colorful placeholder background
    const bgIndex = (prod.categoryId % 9) + 1;
    const emojiMap = { 1: '🌀', 2: '🌋', 3: '⛲', 4: '✏️', 5: '✨', 6: '💣', 7: '🚀', 8: '⚡', 9: '🎁' };
    const emoji = emojiMap[prod.categoryId] || '🎆';
    
    // Check quantity in cart
    const cartItem = cart.find(item => item.id === prod.id);
    const cartQty = cartItem ? cartItem.quantity : 0;
    
    let cardImgContent = `<div class="card-placeholder-bg p-bg-${bgIndex}">${emoji}</div>`;
    if (prod.image) {
      cardImgContent = `<img src="${prod.image}" alt="${prod.name}" class="product-card-img" style="width: 100%; height: 100%; object-fit: cover; transition: var(--transition);">`;
    }

    card.innerHTML = `
      <div class="card-img-container">
        ${cardImgContent}
        <span class="card-discount-badge">${prod.discount || 'Special'}</span>
        ${!prod.inStock ? '<span class="card-stock-badge">Sold Out</span>' : ''}
      </div>
      <div class="product-card-body">

        <h3 class="product-card-title">${prod.name}</h3>
        <span class="product-card-qty">${prod.qty}</span>
        <p class="product-card-desc">${prod.description}</p>
        <div class="product-card-price-row">
          <span class="current-price">₹${prod.price}</span>
          <span class="original-price">₹${prod.originalPrice}</span>
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
    let catProducts = products.filter(p => Number(p.categoryId) === Number(cat.id));
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
}

/* Helper: create a single product card DOM node for the mobile slider */
function createMobileProductCard(prod, cartQty) {
  const card = document.createElement('div');
  card.className = `product-card ${!prod.inStock ? 'out-of-stock' : ''}`;

  const bgIndex = (prod.categoryId % 9) + 1;
  const emojiMap = { 1: '🌀', 2: '🌋', 3: '⛲', 4: '✏️', 5: '✨', 6: '💣', 7: '🚀', 8: '⚡', 9: '🎁' };
  const emoji = emojiMap[prod.categoryId] || '🎆';

  let cardImgContent = `<div class="card-placeholder-bg p-bg-${bgIndex}">${emoji}</div>`;
  if (prod.image) {
    cardImgContent = `<img src="${prod.image}" alt="${prod.name}" class="product-card-img" style="width: 100%; height: 100%; object-fit: cover; transition: var(--transition);">`;
  }

  card.innerHTML = `
    <div class="card-img-container">
      ${cardImgContent}
      <span class="card-discount-badge">${prod.discount || 'Special'}</span>
      ${!prod.inStock ? '<span class="card-stock-badge">Sold Out</span>' : ''}
    </div>
    <div class="product-card-body">
      <h3 class="product-card-title">${prod.name}</h3>
      <span class="product-card-qty">${prod.qty}</span>
      <p class="product-card-desc">${prod.description}</p>
      <div class="product-card-price-row">
        <span class="current-price">₹${prod.price}</span>
        <span class="original-price">₹${prod.originalPrice}</span>
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
  if (!inStock) {
    return `<button class="jcs-add-btn" disabled>N/A</button>`;
  }
  if (qty > 0) {
    return `
      <div class="jcs-stepper-wrap">
        <button class="jcs-step-btn" onclick="catalogStepQty(${prodId}, -1)" aria-label="Decrease quantity">−</button>
        <span class="jcs-step-count">${qty}</span>
        <button class="jcs-step-btn" onclick="catalogStepQty(${prodId}, 1)" aria-label="Increase quantity">+</button>
      </div>
    `;
  }
  return `<button class="jcs-add-btn" onclick="catalogAddQty(${prodId})">ADD</button>`;
}

// Full pinned container (used by both the desktop grid and the mobile slider).
function buildActionContainer(prod, qty) {
  return `<div class="action-container-right" data-action-for="${prod.id}">${buildProductActionInner(prod.id, qty, prod.inStock)}</div>`;
}

// Re-render EVERY on-screen action control for this product (global sync).
function syncProductAction(prodId) {
  const prod = getProducts().find(p => p.id === prodId);
  const inStock = prod ? prod.inStock : true;
  const qty = getCartQty(prodId);
  document.querySelectorAll(`.action-container-right[data-action-for="${prodId}"]`).forEach(container => {
    container.innerHTML = buildProductActionInner(prodId, qty, inStock);
  });
}

// ADD button clicked → puts the first unit in the cart and toggles to stepper.
function catalogAddQty(prodId) {
  const prod = getProducts().find(p => p.id === prodId);
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
  if (!section) {
    console.warn('[Offer] #promo-banner-section not found in DOM.');
    return;
  }

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
    btnEl.href = offer.buttonLink || '#products';
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
      starsHtml += i <= test.rating ? '★' : '☆';
    }
    
    card.innerHTML = `
      <div class="testimonial-header">
        <div class="avatar-circle">${initials}</div>
        <div class="avatar-info">
          <h4>${test.name}</h4>
          <span>📍 ${test.location}</span>
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
    updateCartUI();
  }
}

function saveCartToStorage() {
  localStorage.setItem('kpr_cart', JSON.stringify(cart));
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
  
  // Clear drawer list
  if (!container) return;
  container.innerHTML = '';
  
  if (cart.length === 0) {
    container.innerHTML = `
      <div class="empty-cart-message">
        <span class="empty-cart-icon">🛒</span>
        <p>Your cart is empty!</p>
        <p class="sub-text">Add at least ₹2,000 worth of firecrackers to place an enquiry.</p>
        <button class="btn btn-primary" onclick="toggleCartDrawer()">Continue Shopping</button>
      </div>
    `;
    
    if (minOrderAlert) minOrderAlert.classList.remove('active');
    if (checkoutBtn) checkoutBtn.disabled = true;
    return;
  }
  
  // Render cart items
  cart.forEach(item => {
    const itemRow = document.createElement('div');
    itemRow.className = 'cart-item';
    
    const bgIndex = (item.categoryId % 9) + 1;
    const emojiMap = { 1: '🌀', 2: '🌋', 3: '⛲', 4: '✏️', 5: '✨', 6: '💣', 7: '🚀', 8: '⚡', 9: '🎁' };
    const emoji = emojiMap[item.categoryId] || '🎆';
    
    let cartImgContent = `<div class="cart-item-img-placeholder p-bg-${bgIndex}">${emoji}</div>`;
    if (item.image) {
      cartImgContent = `<img src="${item.image}" alt="${item.name}" style="width: 60px; height: 60px; object-fit: cover; border-radius: var(--radius-sm); flex-shrink: 0; border: 1px solid var(--border-color);">`;
    }

    itemRow.innerHTML = `
      ${cartImgContent}
      <div class="cart-item-details">
        <h4 class="cart-item-name">${item.name}</h4>
        <span class="cart-item-price">₹${item.price} x ${item.quantity}</span>
      </div>
      <div class="cart-item-actions">
        <button class="cart-item-delete" onclick="removeCartItem(${item.id})">Delete</button>
        <div class="qty-counter">
          <button class="qty-btn minus" onclick="adjustDrawerQty(${item.id}, -1)">-</button>
          <span class="qty-number">${item.quantity}</span>
          <button class="qty-btn plus" onclick="adjustDrawerQty(${item.id}, 1)">+</button>
        </div>
      </div>
    `;
    container.appendChild(itemRow);
  });
  
  // Minimum Order checks
  if (subtotal < MINIMUM_ORDER_VALUE) {
    if (minOrderAlert) {
      minOrderAlert.classList.add('active');
      minOrderRem.innerText = `₹${(MINIMUM_ORDER_VALUE - subtotal).toLocaleString()}`;
    }
    if (checkoutBtn) checkoutBtn.disabled = true;
  } else {
    if (minOrderAlert) minOrderAlert.classList.remove('active');
    if (checkoutBtn) checkoutBtn.disabled = false;
  }
}

function adjustDrawerQty(prodId, change) {
  const item = cart.find(i => i.id === prodId);
  if (!item) return;
  
  const newQty = item.quantity + change;
  updateCartItemQuantity(prodId, newQty);
  
  // Sync every on-screen catalog control for this product
  syncProductAction(prodId);
}

function checkoutCart() {
  toggleCartDrawer();
  
  // Pre-fill enquiry form message with cart items
  const messageInput = document.getElementById('enquiry-message');
  if (messageInput) {
    let summary = 'Interested in placing order for:\n';
    cart.forEach(item => {
      summary += `- ${item.name} (Qty: ${item.quantity}) - ₹${item.price * item.quantity}\n`;
    });
    summary += `Total Est: ₹${calculateSubtotal()}`;
    messageInput.value = summary;
  }
  
  // Auto scroll to enquiry form
  document.getElementById('quick-enquiry').scrollIntoView({ behavior: 'smooth' });
  showToast('Items imported into enquiry form. Please fill in details below! 📝', 'info');
}

/* ==========================================================================
   7. Enquiry Form submission
   ========================================================================== */
function openSuccessModal() {
  const overlay = document.getElementById('success-modal-overlay');
  if (!overlay) return;

  overlay.classList.add('open');
  overlay.setAttribute('aria-hidden', 'false');

  // Optional: prevent background scroll while modal is open
  document.body.classList.add('success-modal-active');

  const okBtn = document.getElementById('success-modal-ok');
  if (okBtn) okBtn.focus();

  // Wire close handlers once (idempotent)
  if (!overlay.dataset.handlersBound) {
    overlay.dataset.handlersBound = 'true';

    // OK button
    if (okBtn) {
      okBtn.addEventListener('click', (evt) => {
        evt.preventDefault();
        closeSuccessModal();
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
  // canvas-confetti is expected to be loaded via CDN in index.html
  try {
    if (typeof window.confetti !== 'function') return;

    window.confetti({
      particleCount: 150,
      spread: 80,
      origin: { y: 0.6 },
      colors: ['#FFC107', '#004d40', '#d32f2f', '#ffffff']
    });
  } catch (e) {
    // Fail silently if confetti script is blocked/unavailable
  }
}

function initEnquiryForm() {
  const form = document.getElementById('enquiry-form');
  if (!form) {
    console.warn('[Enquiry] #enquiry-form not found in DOM.');
    return;
  }
  
  console.log('[Enquiry] Form found. Attaching submit handler...');
  
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    console.log('[Enquiry] Form submitted.');
    
    const name = document.getElementById('enquiry-name')?.value.trim();
    const phone = document.getElementById('enquiry-phone')?.value.trim();
    const deliveryAddress = document.getElementById('enquiry-delivery-address')?.value.trim();
    const category = document.getElementById('enquiry-category')?.value;
    const message = document.getElementById('enquiry-message')?.value.trim();
    
    console.log('[Enquiry] Data:', { name, phone, deliveryAddress, category, message });
    
    const submitBtn = form.querySelector('button[type="submit"]');
    const originalBtnText = submitBtn ? submitBtn.innerText : '';
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.innerText = 'Submitting...';
    }
    
    if (!window.db) {
      console.error('[Enquiry] ✗ window.db is NULL. Firestore not initialized.');
      alert('❌ Sorry, the enquiry service is temporarily unavailable. Please reach us on WhatsApp.');
      showToast('Enquiry service unavailable. Please try again later.', 'error');
      if (submitBtn) { submitBtn.disabled = false; submitBtn.innerText = originalBtnText; }
      return;
    }
    
    console.log('[Enquiry] window.db is available. Writing to Firestore...');
    
    // Save the enquiry into the Firestore "enquiries" collection.
    window.db.collection('enquiries').add({
      name,
      phone,
      deliveryAddress,
      category,
      message,
      status: 'new',
      timestamp: firebase.firestore.FieldValue.serverTimestamp()
    })
      .then((docRef) => {
        console.log('[Enquiry] ✓ Successfully written to Firestore. Doc ID:', docRef.id);
        
        // Clear cart if enquiry was submitted from cart
        if (cart.length > 0) {
          cart = [];
          saveCartToStorage();
          updateCartUI();
          // Reset catalog labels
          document.querySelectorAll('.qty-number').forEach(lbl => lbl.innerText = '0');
        }
        
        form.reset();
        openSuccessModal();

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
        console.error('[Enquiry] ✗ Firestore write FAILED:', err);
        console.error('[Enquiry] Error code:', err.code, 'Message:', err.message);
        alert('❌ Sorry, something went wrong while submitting your enquiry. Please try again or contact us on WhatsApp.');
        showToast('Could not submit enquiry. Please try again.', 'error');
      })
      .finally(() => {
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.innerText = originalBtnText;
        }
      });
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
    
    // Save as local enquiry too
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
    showToast('Redirecting to WhatsApp chat... 🚀', 'success');
    
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
  } else {
    // Fallback
    animElements.forEach(el => el.classList.add('visible'));
  }
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
    <button class="toast-close" onclick="this.parentElement.remove()">✕</button>
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

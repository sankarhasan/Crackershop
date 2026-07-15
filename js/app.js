// KPR Crackers - Storefront Logic (app.js)

// Global State variables
let cart = [];
let activeCategory = 'all';
let currentSlide = 0;
let carouselInterval = null;
const MINIMUM_ORDER_VALUE = 2000;

document.addEventListener('DOMContentLoaded', () => {
  // Initialize app elements
  initCarousel();
  renderCategoriesGrid();
  renderFilterButtons();
  renderProductsCatalog();
  renderTestimonialsSlider();
  initContactMap();
  initPromoCountdown();
  initEnquiryForm();
  initWhatsAppWidget();
  initScrollAnimations();
  initNavbarScroll();
  loadCartFromStorage();
  
  // Close menu on nav link clicks
  const navLinks = document.querySelectorAll('.nav-link');
  const navMenu = document.getElementById('main-nav');
  const menuToggle = document.getElementById('menu-toggle');
  
  navLinks.forEach(link => {
    link.addEventListener('click', (e) => {
      // Set active nav link
      navLinks.forEach(l => l.classList.remove('active'));
      link.classList.add('active');
      
      // Close mobile menu
      if (navMenu.classList.contains('active')) {
        navMenu.classList.remove('active');
        menuToggle.classList.remove('active');
      }
    });
  });
  
  // Hamburger toggle click
  menuToggle.addEventListener('click', () => {
    navMenu.classList.toggle('active');
    menuToggle.classList.toggle('active');
  });
  
  // Mobile hamburger spans change to cross
  menuToggle.addEventListener('click', () => {
    const bars = menuToggle.querySelectorAll('.bar');
    if (menuToggle.classList.contains('active')) {
      bars[0].style.transform = 'rotate(-45deg) translate(-5px, 6px)';
      bars[1].style.opacity = '0';
      bars[2].style.transform = 'rotate(45deg) translate(-5px, -6px)';
    } else {
      bars[0].style.transform = 'none';
      bars[1].style.opacity = '1';
      bars[2].style.transform = 'none';
    }
  });
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

    const content = `
      <div class="container slide-content">
        <h4 class="slide-subtitle text-glow">${escapeHtml(b.tagline || '')}</h4>
        <h1 class="slide-title">${escapeHtml(b.headingTitle || '')}</h1>
        <p class="slide-desc">${escapeHtml(b.description || '')}</p>
        <div class="slide-buttons">
          <a href="#products" class="btn btn-primary btn-lg">Shop Products Now</a>
          <a href="#enquiry" class="btn btn-outline btn-lg">Quick Enquiry</a>
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
  const grid = document.getElementById('categories-grid');
  if (!grid) return;
  
  const categories = getCategories();
  grid.innerHTML = '';
  
  categories.forEach((cat, index) => {
    const card = document.createElement('div');
    card.className = `category-card fade-in-up`;
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

    const categoryImageUrl = (cat.categoryImageUrl ?? cat.image ?? '').toString().trim();

    card.innerHTML = `
      <div class="cat-bg ${bgClass}">${categoryImageUrl ? '' : emoji}</div>
      ${categoryImageUrl
        ? `<img src="${categoryImageUrl}" alt="${cat.name}" class="category-card-img" loading="lazy">`
        : ''}
      <div class="category-overlay"></div>
      <div class="category-info">
        <h3 class="category-name">${cat.name}</h3>
        <span class="category-link">View Collection ➔</span>
      </div>
    `;
    grid.appendChild(card);
  });
}

function filterByCategory(slug) {
  activeCategory = slug;
  
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
      renderProductsCatalog();
    });

    filterBar.appendChild(btn);
  });

  // Search input handler
  const searchInput = document.getElementById('product-search');
  if (searchInput) {
    searchInput.addEventListener('input', () => {
      renderProductsCatalog();
    });
  }
}

function renderProductsCatalog() {
  const grid = document.getElementById('products-grid');
  if (!grid) return;

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
        <div class="product-card-actions">
          ${prod.inStock ? `
            <div class="qty-counter">
              <button class="qty-btn minus" onclick="adjustCatalogQty(${prod.id}, -1)">-</button>
              <span class="qty-number" id="catalog-qty-${prod.id}">${cartQty}</span>
              <button class="qty-btn plus" onclick="adjustCatalogQty(${prod.id}, 1)">+</button>
            </div>
            <button class="btn-add-cart" onclick="addProductToCart(${prod.id})">Add to Cart</button>
          ` : `
            <button class="btn-add-cart" disabled>Unavailable</button>
          `}
        </div>
      </div>
    `;
    grid.appendChild(card);
  });
}

function adjustCatalogQty(prodId, change) {
  const qtyLabel = document.getElementById(`catalog-qty-${prodId}`);
  if (!qtyLabel) return;
  
  let currentVal = parseInt(qtyLabel.innerText) || 0;
  let newVal = currentVal + change;
  if (newVal < 0) newVal = 0;
  
  qtyLabel.innerText = newVal;
  
  // Synchronously update cart structure
  updateCartItemQuantity(prodId, newVal);
}

/* ==========================================================================
   4. Promo Countdown Timer Setup
   ========================================================================== */
function initPromoCountdown() {
  const targetDate = new Date();
  targetDate.setDate(targetDate.getDate() + 10); // Target countdown 10 days out
  
  const timer = setInterval(() => {
    const now = new Date().getTime();
    const difference = targetDate.getTime() - now;
    
    if (difference <= 0) {
      clearInterval(timer);
      const countdownBox = document.getElementById('promo-timer');
      if (countdownBox) countdownBox.innerHTML = "<h4>DIWALI BIG SALE IS ACTIVE!</h4>";
      return;
    }
    
    const days = Math.floor(difference / (1000 * 60 * 60 * 24));
    const hours = Math.floor((difference % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((difference % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((difference % (1000 * 60)) / 1000);
    
    const dElem = document.getElementById('days');
    const hElem = document.getElementById('hours');
    const mElem = document.getElementById('minutes');
    const sElem = document.getElementById('seconds');
    
    if (dElem) dElem.innerText = String(days).padStart(2, '0');
    if (hElem) hElem.innerText = String(hours).padStart(2, '0');
    if (mElem) mElem.innerText = String(minutes).padStart(2, '0');
    if (sElem) sElem.innerText = String(seconds).padStart(2, '0');
  }, 1000);
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
    const savedCart = sessionStorage.getItem('kpr_cart');
  if (savedCart) {
    cart = JSON.parse(savedCart);
    updateCartUI();
  }
}

function saveCartToStorage() {
  sessionStorage.setItem('kpr_cart', JSON.stringify(cart));
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
  showToast(`Added ${prod.name} to cart! 🎆`, 'success');
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
  
  // Sync Catalog label
  const qtyLabel = document.getElementById(`catalog-qty-${productId}`);
  if (qtyLabel) qtyLabel.innerText = 0;
  
  showToast('Item removed from cart.', 'info');
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
  
  // Sync Catalog UI labels too
  const qtyLabel = document.getElementById(`catalog-qty-${prodId}`);
  if (qtyLabel) qtyLabel.innerText = newQty;
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
  document.getElementById('enquiry').scrollIntoView({ behavior: 'smooth' });
  showToast('Items imported into enquiry form. Please fill in details below! 📝', 'info');
}

/* ==========================================================================
   7. Enquiry Form submission
   ========================================================================== */
function initEnquiryForm() {
  const form = document.getElementById('enquiry-form');
  if (!form) return;
  
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    
    const name = document.getElementById('enquiry-name').value;
    const phone = document.getElementById('enquiry-phone').value;
    const deliveryAddress = document.getElementById('enquiry-delivery-address').value;

    const category = document.getElementById('enquiry-category').value;
    const message = document.getElementById('enquiry-message').value;
    
    const enquiries = getEnquiries();
    const newId = generateId(enquiries);
    
    const newEnquiry = {
      id: newId,
      name,
      phone,
      deliveryAddress,
      category,
      message,
      date: new Date().toISOString(),
      status: 'new'
    };
    
    enquiries.push(newEnquiry);
    saveEnquiries(enquiries);
    
    // Clear cart if enquiry was submitted from cart
    if (cart.length > 0) {
      cart = [];
      saveCartToStorage();
      updateCartUI();
      // Reset catalog labels
      document.querySelectorAll('.qty-number').forEach(lbl => lbl.innerText = '0');
    }
    
    form.reset();
    showToast('Enquiry submitted successfully! We will call you soon. 📞', 'success');
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
function initNavbarScroll() {
  const header = document.querySelector('.main-header');
  window.addEventListener('scroll', () => {
    if (window.scrollY > 50) {
      header.classList.add('scrolled');
    } else {
      header.classList.remove('scrolled');
    }
    highlightNavLink();
  });
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

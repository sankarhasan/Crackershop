// JCS Crackers - Common Data & localStorage API

const DEFAULT_CATEGORIES = [
  { id: 1, name: 'Ground Chakkars', slug: 'ground-chakkars', image: 'ground-chakkars', categoryImageUrl: 'ground-chakkars' },
  { id: 2, name: 'Flower Pots', slug: 'flower-pots', image: 'flower-pots', categoryImageUrl: 'flower-pots' },
  { id: 3, name: 'Fancy Fountains', slug: 'fancy-fountains', image: 'fancy-fountains', categoryImageUrl: 'fancy-fountains' },
  { id: 4, name: 'Pencils', slug: 'pencils', image: 'pencils', categoryImageUrl: 'pencils' },
  { id: 5, name: 'Sparklers', slug: 'sparklers', image: 'sparklers', categoryImageUrl: 'sparklers' },
  { id: 6, name: 'Atom Bombs', slug: 'atom-bombs', image: 'atom-bombs', categoryImageUrl: 'atom-bombs' },
  { id: 7, name: 'Rockets', slug: 'rockets', image: 'rockets', categoryImageUrl: 'rockets' },
  { id: 8, name: 'Bijili Crackers', slug: 'bijili-crackers', image: 'bijili-crackers', categoryImageUrl: 'bijili-crackers' },
  { id: 9, name: 'Combo Packs', slug: 'combo-packs', image: 'combo-packs', categoryImageUrl: 'combo-packs' }
];

const DEFAULT_PRODUCTS = [
  // Ground Chakkars
  { id: 101, name: 'Chakkar Ash (Big)', categoryId: 1, price: 180, originalPrice: 300, discount: '40% OFF', qty: '1 Box / 10 Pcs', description: 'Traditional spinning wheel wheel-firework that spins on the ground with silver sparks.', inStock: true },
  { id: 102, name: 'Chakkar Special (Medium)', categoryId: 1, price: 120, originalPrice: 200, discount: '40% OFF', qty: '1 Box / 10 Pcs', description: 'Classic ground chakkar spinning with red and green sparks.', inStock: true },
  { id: 103, name: 'Deluxe Ground Chakkar', categoryId: 1, price: 290, originalPrice: 450, discount: '35% OFF', qty: '1 Box / 5 Pcs', description: 'Extra large ground wheel with bright golden sparks and longer duration.', inStock: true },

  // Flower Pots
  { id: 201, name: 'Flower Pots Ash (Big)', categoryId: 2, price: 210, originalPrice: 350, discount: '40% OFF', qty: '1 Box / 10 Pcs', description: 'Classic cone fountain emitting bright silver and golden fountain of sparks.', inStock: true },
  { id: 202, name: 'Flower Pots Special', categoryId: 2, price: 150, originalPrice: 250, discount: '40% OFF', qty: '1 Box / 10 Pcs', description: 'Medium sized flower pots producing bright multicolored sparkles.', inStock: true },
  { id: 203, name: 'Flower Pots Deluxe', categoryId: 2, price: 340, originalPrice: 500, discount: '32% OFF', qty: '1 Box / 5 Pcs', description: 'Giant cone firework emitting showers of golden stars up to 10 feet high.', inStock: true },

  // Fancy Fountains
  { id: 301, name: 'Fancy Fountain (7 Color)', categoryId: 3, price: 390, originalPrice: 650, discount: '40% OFF', qty: '1 Box / 2 Pcs', description: 'Fountain that sequentially changes colors into seven vibrant shades.', inStock: true },
  { id: 302, name: 'Crackling King Fountain', categoryId: 3, price: 450, originalPrice: 750, discount: '40% OFF', qty: '1 Box / 1 Pc', description: 'Spectacular fountain with heavy crackling sound and silver glitters.', inStock: true },

  // Pencils
  { id: 401, name: 'Color Pencils (Extra Long)', categoryId: 4, price: 110, originalPrice: 180, discount: '38% OFF', qty: '1 Box / 10 Pcs', description: 'Pencil sticks that emit multi-colored fire sparkles from the tip.', inStock: true },
  { id: 402, name: 'Deluxe Sparkle Pencil', categoryId: 4, price: 140, originalPrice: 220, discount: '36% OFF', qty: '1 Box / 5 Pcs', description: 'Thick hand-held sticks emitting heavy gold crackling sparks.', inStock: true },

  // Sparklers
  { id: 501, name: '10 cm Electric Sparklers', categoryId: 5, price: 40, originalPrice: 80, discount: '50% OFF', qty: '1 Box / 10 Pcs', description: 'Classic hand-held steel wire sparklers that emit brilliant silver sparks.', inStock: true },
  { id: 502, name: '15 cm Multi-Color Sparklers', categoryId: 5, price: 90, originalPrice: 150, discount: '40% OFF', qty: '1 Box / 10 Pcs', description: 'Sparklers that burn in multiple colors including Red, Green, and Gold.', inStock: true },
  { id: 503, name: '30 cm Mega Gold Sparklers', categoryId: 5, price: 190, originalPrice: 300, discount: '36% OFF', qty: '1 Box / 5 Pcs', description: 'Extra-long giant sparklers with rich gold spark emissions and long burning time.', inStock: true },

  // Atom Bombs
  { id: 601, name: 'Hydro Bomb (Green)', categoryId: 6, price: 130, originalPrice: 220, discount: '40% OFF', qty: '1 Box / 10 Pcs', description: 'Traditional jute-wrapped thread bomb with high decibel explosion sound.', inStock: true },
  { id: 602, name: 'King of King Bomb', categoryId: 6, price: 250, originalPrice: 400, discount: '37% OFF', qty: '1 Box / 5 Pcs', description: 'Heavy charge giant bomb with a earth-shaking loud thunder sound.', inStock: true },

  // Rockets
  { id: 701, name: 'Baby Rocket', categoryId: 7, price: 150, originalPrice: 250, discount: '40% OFF', qty: '1 Box / 10 Pcs', description: 'Cute small rockets that zoom into the air with a soft whistle and pop.', inStock: true },
  { id: 702, name: 'Lunik Sky shot Rocket', categoryId: 7, price: 290, originalPrice: 480, discount: '39% OFF', qty: '1 Box / 3 Pcs', description: 'Shoots high up and bursts into a beautiful umbrella of colorful stars.', inStock: true },

  // Bijili Crackers
  { id: 801, name: 'Red Bijili (50 Wala)', categoryId: 8, price: 80, originalPrice: 140, discount: '42% OFF', qty: '1 Packet / 50 Pcs', description: 'Small red thread crackers offering rapid crackling sounds.', inStock: true },
  { id: 802, name: 'Stripped Bijili (100 Wala)', categoryId: 8, price: 140, originalPrice: 240, discount: '41% OFF', qty: '1 Packet / 100 Pcs', description: 'Long chain of small sound crackers that burst sequentially.', inStock: true },

  // Combo Packs
  { id: 901, name: 'KPR Diwali Family Combo (Budget)', categoryId: 9, price: 2499, originalPrice: 4200, discount: '40% OFF', qty: '1 Box / 25 Varieties', description: 'Curated box containing Chakkars, Sparklers, Flower pots, Pencils, and small Bombs for children.', inStock: true },
  { id: 902, name: 'KPR Grand Festive Combo (Mega)', categoryId: 9, price: 4999, originalPrice: 8500, discount: '41% OFF', qty: '1 Box / 50 Varieties', description: 'Mega box of joy including heavy aerial sky shots, fancy fountains, deluxe sparklers, and sound bombs.', inStock: true }
];

const DEFAULT_TESTIMONIALS = [
  { id: 1, name: 'Rajesh Kumar', location: 'Chennai', rating: 5, comment: 'Purchased the KPR Grand Festive Combo. Excellent packaging and fast delivery to Chennai. All the flower pots and sky shots were outstanding and fresh!' },
  { id: 2, name: 'Priya Sharma', location: 'Mumbai', rating: 5, comment: 'Very easy to order. KPR support resolved all my queries on WhatsApp quickly. Crackers were of high quality with minimal smoke and bright colors!' },
  { id: 3, name: 'Anand Patel', location: 'Ahmedabad', rating: 4, comment: 'Best wholesale prices compared to local retailers. Saved almost 40% on my bulk order for the apartment complex. Highly recommended!' },
  { id: 4, name: 'Meena Devi', location: 'Delhi', rating: 5, comment: 'High safety standards! Kids really enjoyed the long electric sparklers and color pencils. Standard moisture-proof wooden box packing was neat.' },
  { id: 5, name: 'Suresh Babu', location: 'Bangalore', rating: 5, comment: 'Awesome service from KPR Crackers. The Ground Chakkars spun for a long time and the Fancy Fountains change colors beautifully. Will buy again next year!' }
];

const DEFAULT_ENQUIRIES = [
  { id: 1, name: 'Ramesh Adani', phone: '9845012345', deliveryAddress: 'Chennai - 600001', category: 'combos', message: 'Looking for 10 quantities of the Diwali Family Combo pack for gifting employees. Please share discounted quotation.', date: '2026-07-10T11:20:00Z', status: 'new' },
  { id: 2, name: 'Karthik Raja', phone: '9789012345', deliveryAddress: 'Coimbatore - 641001', category: 'fancy-fountains', message: 'Do you deliver to Coimbatore? Interested in buying fancy fountains and sky shots worth ₹5,000.', date: '2026-07-12T15:30:00Z', status: 'contacted' }
];

// Data Initialization Helper
function initData() {
  if (!localStorage.getItem('jcs_categories')) {
    localStorage.setItem('jcs_categories', JSON.stringify(DEFAULT_CATEGORIES));
  }
  if (!localStorage.getItem('jcs_products')) {
    localStorage.setItem('jcs_products', JSON.stringify(DEFAULT_PRODUCTS));
  }
  if (!localStorage.getItem('jcs_testimonials')) {
    localStorage.setItem('jcs_testimonials', JSON.stringify(DEFAULT_TESTIMONIALS));
  }
  if (!localStorage.getItem('jcs_enquiries')) {
    localStorage.setItem('jcs_enquiries', JSON.stringify(DEFAULT_ENQUIRIES));
  }
}

// Getters and Setters
function getCategories() {
  initData();
  return JSON.parse(localStorage.getItem('jcs_categories'));
}

function saveCategories(categories) {
  localStorage.setItem('jcs_categories', JSON.stringify(categories));
}

function getProducts() {
  initData();
  return JSON.parse(localStorage.getItem('jcs_products'));
}

function saveProducts(products) {
  localStorage.setItem('jcs_products', JSON.stringify(products));
}

function getTestimonials() {
  initData();
  return JSON.parse(localStorage.getItem('jcs_testimonials'));
}

function getEnquiries() {
  initData();
  return JSON.parse(localStorage.getItem('jcs_enquiries'));
}

function saveEnquiries(enquiries) {
  localStorage.setItem('jcs_enquiries', JSON.stringify(enquiries));
}

// Helper to generate next unique ID
function generateId(items) {
  if (!items || items.length === 0) return 1;
  const ids = items.map(item => Number(item.id)).filter(id => !isNaN(id));
  return ids.length > 0 ? Math.max(...ids) + 1 : 1;
}

// Execute initial seeding
initData();

/* ==========================================================================
   Firestore Product Sync Layer
   - loadProductsFromFirestore(): fetches products collection, caches to localStorage
   - saveProductToFirestore(product): upserts a single product doc
   - deleteProductFromFirestore(id): removes a product doc by numeric id
   - seedFirestoreProducts(): one-time bulk seed from DEFAULT_PRODUCTS
   All functions are async and return Promises. They gracefully fall back to
   localStorage if Firestore is unavailable (window.db is null).
   ========================================================================== */

/**
 * Fetch all products from Firestore, ordered by id.
 * Caches the result to localStorage for offline/fast access.
 * Returns array of product objects.
 */
function loadProductsFromFirestore() {
  if (!window.db) return Promise.resolve(getProducts());

  return window.db.collection('products')
    .orderBy('id', 'asc')
    .get()
    .then(snapshot => {
      if (snapshot.empty) {
        // No products in Firestore yet — seed from defaults
        return seedFirestoreProducts().then(() => getProducts());
      }
      const firestoreProducts = [];
      snapshot.forEach(doc => {
        firestoreProducts.push(doc.data());
      });
      // Cache to localStorage for fast subsequent reads
      localStorage.setItem('jcs_products', JSON.stringify(firestoreProducts));
      return firestoreProducts;
    })
    .catch(err => {
      console.warn('[Firestore] Failed to load products, using localStorage cache:', err);
      return getProducts();
    });
}

/**
 * Save (upsert) a single product to Firestore.
 * Uses the numeric product `id` as the Firestore document ID for consistency.
 */
function saveProductToFirestore(product) {
  if (!window.db) return Promise.resolve();

  return window.db.collection('products')
    .doc(String(product.id))
    .set(product)
    .then(() => {
      // Also update localStorage cache
      const cached = getProducts();
      const idx = cached.findIndex(p => Number(p.id) === Number(product.id));
      if (idx !== -1) {
        cached[idx] = product;
      } else {
        cached.push(product);
      }
      localStorage.setItem('jcs_products', JSON.stringify(cached));
    })
    .catch(err => {
      console.error('[Firestore] Failed to save product:', err);
      throw err; // Re-throw so caller can show user-facing error
    });
}

/**
 * Delete a product from Firestore by its numeric id.
 */
function deleteProductFromFirestore(productId) {
  if (!window.db) return Promise.resolve();

  return window.db.collection('products')
    .doc(String(productId))
    .delete()
    .then(() => {
      // Update localStorage cache
      const cached = getProducts().filter(p => Number(p.id) !== Number(productId));
      localStorage.setItem('jcs_products', JSON.stringify(cached));
    })
    .catch(err => {
      console.error('[Firestore] Failed to delete product:', err);
      throw err; // Re-throw so caller can show user-facing error
    });
}

/**
 * One-time bulk seed: pushes DEFAULT_PRODUCTS into Firestore.
 * Only runs if the products collection is empty.
 */
function seedFirestoreProducts() {
  if (!window.db) return Promise.resolve();

  const batch = window.db.batch();
  DEFAULT_PRODUCTS.forEach(prod => {
    const ref = window.db.collection('products').doc(String(prod.id));
    batch.set(ref, prod);
  });

  return batch.commit().then(() => {
    localStorage.setItem('jcs_products', JSON.stringify(DEFAULT_PRODUCTS));
    console.log('[Firestore] Seeded', DEFAULT_PRODUCTS.length, 'products.');
  });
}

/**
 * Bulk save all products to Firestore (replaces entire collection snapshot).
 * Used by admin after batch edits.
 */
function saveAllProductsToFirestore(products) {
  if (!window.db) return Promise.resolve();

  const batch = window.db.batch();
  products.forEach(prod => {
    const ref = window.db.collection('products').doc(String(prod.id));
    batch.set(ref, prod);
  });

  return batch.commit().then(() => {
    localStorage.setItem('jcs_products', JSON.stringify(products));
  })
  .catch(err => {
    console.error('[Firestore] Failed to bulk save products:', err);
  });
}

/* ==========================================================================
   Firestore Banner Sync Layer
   - loadBannersFromFirestore(): fetches banners collection, caches to localStorage
   - saveBannersToFirestore(banners): bulk-saves the full banners array
   Banners are stored as individual docs keyed by their array index ("0", "1", etc.)
   with an `order` field for sorting. The entire collection is replaced on each save.
   ========================================================================== */

const DEFAULT_BANNERS = [
  { order: 0, tagline: 'FESTIVAL OF LIGHTS', headingTitle: 'KPR Crackers', description: 'Explore premium Sivakasi firecrackers with safe delivery and unbeatable offers!', imageBase64: '' },
  { order: 1, tagline: 'SUPER VALUE OFFER', headingTitle: 'Up To 40% OFF on Combo Packs', description: 'Grab curated combos packed with safety, brightness, and joy.', imageBase64: '' },
  { order: 2, tagline: 'TRUST & SAFETY', headingTitle: '100% Quality & Safe Delivery', description: 'Sourced from top manufacturers in Sivakasi. Tested for safety and packaged securely.', imageBase64: '' }
];

/**
 * Fetch all banners from Firestore, ordered by `order` field.
 * Caches to localStorage under 'bannersData' for instant subsequent reads.
 * If the collection is empty, seeds from DEFAULT_BANNERS.
 */
function loadBannersFromFirestore() {
  if (!window.db) return Promise.resolve(getBannersDataLocal());

  return window.db.collection('banners')
    .orderBy('order', 'asc')
    .get()
    .then(snapshot => {
      if (snapshot.empty) {
        return seedFirestoreBanners().then(() => getBannersDataLocal());
      }
      const banners = [];
      snapshot.forEach(doc => {
        banners.push(doc.data());
      });
      // Normalize and cache
      const normalized = normalizeBanners(banners);
      localStorage.setItem('bannersData', JSON.stringify(normalized));
      return normalized;
    })
    .catch(err => {
      console.warn('[Firestore] Failed to load banners, using localStorage cache:', err);
      return getBannersDataLocal();
    });
}

/**
 * Bulk-save the full banners array to Firestore.
 * Deletes any docs beyond the current array length, then upserts each banner.
 */
function saveBannersToFirestore(banners) {
  if (!window.db) return Promise.resolve();

  // First, fetch existing doc IDs to know which ones to delete
  return window.db.collection('banners').get().then(existingSnapshot => {
    const existingIds = [];
    existingSnapshot.forEach(doc => existingIds.push(doc.id));

    const batch = window.db.batch();

    // Delete docs that are beyond the new array length
    existingIds.forEach(id => {
      const idx = parseInt(id, 10);
      if (isNaN(idx) || idx >= banners.length) {
        batch.delete(window.db.collection('banners').doc(id));
      }
    });

    // Upsert each banner with its index as doc ID
    banners.forEach((banner, i) => {
      const ref = window.db.collection('banners').doc(String(i));
      batch.set(ref, {
        order: i,
        tagline: (banner.tagline || '').toString(),
        headingTitle: (banner.headingTitle || '').toString(),
        description: (banner.description || '').toString(),
        imageBase64: (banner.imageBase64 || '').toString()
      });
    });

    return batch.commit();
  }).then(() => {
    localStorage.setItem('bannersData', JSON.stringify(banners));
  }).catch(err => {
    console.error('[Firestore] Failed to save banners:', err);
    throw err; // Re-throw so caller can show user-facing error
  });
}

/**
 * One-time seed: pushes DEFAULT_BANNERS into Firestore.
 */
function seedFirestoreBanners() {
  if (!window.db) return Promise.resolve();

  const batch = window.db.batch();
  DEFAULT_BANNERS.forEach((banner, i) => {
    const ref = window.db.collection('banners').doc(String(i));
    batch.set(ref, banner);
  });

  return batch.commit().then(() => {
    localStorage.setItem('bannersData', JSON.stringify(DEFAULT_BANNERS));
    console.log('[Firestore] Seeded', DEFAULT_BANNERS.length, 'banners.');
  });
}

/**
 * Read banners from localStorage (sync fallback).
 */
function getBannersDataLocal() {
  const raw = localStorage.getItem('bannersData');
  if (!raw) {
    localStorage.setItem('bannersData', JSON.stringify(DEFAULT_BANNERS));
    return DEFAULT_BANNERS;
  }
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) throw new Error('not array');
    return normalizeBanners(parsed);
  } catch (e) {
    localStorage.removeItem('bannersData');
    return DEFAULT_BANNERS;
  }
}

function normalizeBanners(arr) {
  return arr.map(item => ({
    tagline: (item?.tagline ?? '').toString(),
    headingTitle: (item?.headingTitle ?? '').toString(),
    description: (item?.description ?? '').toString(),
    imageBase64: (item?.imageBase64 ?? '').toString()
  }));
}

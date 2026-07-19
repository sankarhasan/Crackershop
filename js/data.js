// JCS Crackers - Common Data & localStorage API

const DEFAULT_CATEGORIES = [
  { id: 1, name: 'Ground Chakkars', slug: 'ground-chakkars', image: '', categoryImageUrl: '' },
  { id: 2, name: 'Flower Pots', slug: 'flower-pots', image: '', categoryImageUrl: '' },
  { id: 3, name: 'Fancy Fountains', slug: 'fancy-fountains', image: '', categoryImageUrl: '' },
  { id: 4, name: 'Pencils', slug: 'pencils', image: '', categoryImageUrl: '' },
  { id: 5, name: 'Sparklers', slug: 'sparklers', image: '', categoryImageUrl: '' },
  { id: 6, name: 'Atom Bombs', slug: 'atom-bombs', image: '', categoryImageUrl: '' },
  { id: 7, name: 'Rockets', slug: 'rockets', image: '', categoryImageUrl: '' },
  { id: 8, name: 'Bijili Crackers', slug: 'bijili-crackers', image: '', categoryImageUrl: '' },
  { id: 9, name: 'Combo Packs', slug: 'combo-packs', image: '', categoryImageUrl: '' }
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
  const stored = localStorage.getItem('jcs_categories');
  if (!stored) {
    console.warn('[getCategories] localStorage is empty. Returning DEFAULT_CATEGORIES.');
    return DEFAULT_CATEGORIES;
  }
  try {
    const parsed = JSON.parse(stored);
    if (!Array.isArray(parsed)) {
      console.error('[getCategories] Parsed data is not an array. Returning DEFAULT_CATEGORIES.');
      return DEFAULT_CATEGORIES;
    }
    return parsed;
  } catch (e) {
    console.error('[getCategories] JSON.parse failed. Returning DEFAULT_CATEGORIES.', e);
    return DEFAULT_CATEGORIES;
  }
}

function saveCategories(categories) {
  localStorage.setItem('jcs_categories', JSON.stringify(categories));
}

function getProducts() {
  initData();
  const stored = localStorage.getItem('jcs_products');
  if (!stored) {
    console.warn('[getProducts] localStorage is empty. Returning DEFAULT_PRODUCTS.');
    return DEFAULT_PRODUCTS;
  }
  try {
    const parsed = JSON.parse(stored);
    if (!Array.isArray(parsed)) {
      console.error('[getProducts] Parsed data is not an array. Returning DEFAULT_PRODUCTS.');
      return DEFAULT_PRODUCTS;
    }
    return parsed;
  } catch (e) {
    console.error('[getProducts] JSON.parse failed. Returning DEFAULT_PRODUCTS.', e);
    return DEFAULT_PRODUCTS;
  }
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
 * Fetch all products from Firestore (LIVE SERVER), ordered by id.
 * Always overwrites localStorage with Firestore data — Firestore is the single source of truth.
 * Only seeds Firestore if the collection is genuinely empty on the server.
 *
 * Uses { source: 'server' } to force a live network fetch, bypassing any local Firestore cache.
 */
function loadProductsFromFirestore() {
  if (!window.db) return Promise.resolve(getProducts());

  return window.db.collection('products')
    .orderBy('id', 'asc')
    .get({ source: 'server' })
    .then(snapshot => {
      if (snapshot.empty) {
        // Firestore is genuinely empty on the server — seed from defaults
        console.log('[Firestore] Products collection empty on server. Seeding DEFAULT_PRODUCTS.');
        return seedFirestoreProducts(DEFAULT_PRODUCTS).then(() => DEFAULT_PRODUCTS);
      }

      const firestoreProducts = [];
      snapshot.forEach(doc => {
        firestoreProducts.push(doc.data());
      });

      // ALWAYS overwrite localStorage with live Firestore data (single source of truth)
      localStorage.setItem('jcs_products', JSON.stringify(firestoreProducts));
      console.log('[Firestore] Loaded', firestoreProducts.length, 'products from server.');
      return firestoreProducts;
    })
    .catch(err => {
      console.warn('[Firestore] Server fetch failed, using localStorage cache:', err.code || err.message, err);
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
 * One-time bulk seed: pushes products into Firestore.
 * @param {Array} [sourceProducts] - Products to seed. Defaults to localStorage, then DEFAULT_PRODUCTS.
 */
function seedFirestoreProducts(sourceProducts) {
  if (!window.db) return Promise.resolve();

  // Prefer provided source, then localStorage, then hardcoded defaults
  const productsToSeed = (sourceProducts && sourceProducts.length > 0)
    ? sourceProducts
    : (getProducts().length > 0 ? getProducts() : DEFAULT_PRODUCTS);

  const batch = window.db.batch();
  productsToSeed.forEach(prod => {
    const ref = window.db.collection('products').doc(String(prod.id));
    batch.set(ref, prod);
  });

  return batch.commit().then(() => {
    localStorage.setItem('jcs_products', JSON.stringify(productsToSeed));
    console.log('[Firestore] Seeded', productsToSeed.length, 'products.');
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
 * Fetch all banners from Firestore (LIVE SERVER), ordered by `order` field.
 * Always overwrites localStorage with Firestore data — Firestore is the single source of truth.
 * Uses { source: 'server' } to force a live network fetch.
 */
function loadBannersFromFirestore() {
  if (!window.db) return Promise.resolve(getBannersDataLocal());

  return window.db.collection('banners')
    .orderBy('order', 'asc')
    .get({ source: 'server' })
    .then(snapshot => {
      if (snapshot.empty) {
        // Firestore is genuinely empty on the server — seed from defaults
        console.log('[Firestore] Banners collection empty on server. Seeding DEFAULT_BANNERS.');
        return seedFirestoreBanners(DEFAULT_BANNERS).then(() => DEFAULT_BANNERS);
      }

      const banners = [];
      snapshot.forEach(doc => {
        banners.push(doc.data());
      });
      const normalized = normalizeBanners(banners);

      // ALWAYS overwrite localStorage with live Firestore data (single source of truth)
      localStorage.setItem('bannersData', JSON.stringify(normalized));
      console.log('[Firestore] Loaded', normalized.length, 'banners from server.');
      return normalized;
    })
    .catch(err => {
      console.warn('[Firestore] Banner server fetch failed, using localStorage cache:', err.code || err.message, err);
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
 * One-time seed: pushes banners into Firestore.
 * @param {Array} [sourceBanners] - Banners to seed. Defaults to localStorage, then DEFAULT_BANNERS.
 */
function seedFirestoreBanners(sourceBanners) {
  if (!window.db) return Promise.resolve();

  const bannersToSeed = (sourceBanners && sourceBanners.length > 0)
    ? sourceBanners
    : (getBannersDataLocal().length > 0 ? getBannersDataLocal() : DEFAULT_BANNERS);

  const batch = window.db.batch();
  bannersToSeed.forEach((banner, i) => {
    const ref = window.db.collection('banners').doc(String(i));
    batch.set(ref, {
      order: i,
      tagline: (banner.tagline || '').toString(),
      headingTitle: (banner.headingTitle || '').toString(),
      description: (banner.description || '').toString(),
      imageBase64: (banner.imageBase64 || '').toString()
    });
  });

  return batch.commit().then(() => {
    localStorage.setItem('bannersData', JSON.stringify(bannersToSeed));
    console.log('[Firestore] Seeded', bannersToSeed.length, 'banners.');
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

/* ==========================================================================
   Firestore Categories Sync Layer
   - loadCategoriesFromFirestore(): fetches categories collection, caches to localStorage
   - saveCategoryToFirestore(category): upserts a single category doc
   - deleteCategoryFromFirestore(categoryId): removes a category doc by numeric id
   - seedFirestoreCategories(): one-time bulk seed from localStorage or DEFAULT_CATEGORIES
   All functions are async and return Promises. They gracefully fall back to
   localStorage if Firestore is unavailable (window.db is null).
   ========================================================================== */

/**
 * Fetch all categories from Firestore, ordered by id.
 * Caches to localStorage under 'jcs_categories' for instant subsequent reads.
 * If the collection is empty, seeds FROM localStorage (which may have admin edits).
 */
function loadCategoriesFromFirestore() {
  console.log('[data.js] loadCategoriesFromFirestore() called. window.db:', window.db ? 'CONNECTED' : 'NULL');
  
  if (!window.db) {
    console.warn('[data.js] window.db is NULL. Returning localStorage categories.');
    return Promise.resolve(getCategories());
  }

  // Add timeout to prevent hanging indefinitely
  const timeoutPromise = new Promise((_, reject) => {
    setTimeout(() => reject(new Error('Firestore categories fetch timeout (10s)')), 10000);
  });

  const fetchPromise = window.db.collection('categories')
    .orderBy('id', 'asc')
    .get({ source: 'server' })
    .then(snapshot => {
      console.log('[data.js] Firestore categories snapshot received. Empty?', snapshot.empty);
      
      if (snapshot.empty) {
        // Firestore is genuinely empty on the server — seed from defaults
        console.log('[data.js] Categories collection empty on server. Seeding DEFAULT_CATEGORIES.');
        return seedFirestoreCategories(DEFAULT_CATEGORIES).then(() => {
          console.log('[data.js] ✓ Seeding complete. Returning DEFAULT_CATEGORIES.');
          return DEFAULT_CATEGORIES;
        });
      }

      const firestoreCategories = [];
      snapshot.forEach(doc => {
        firestoreCategories.push(doc.data());
      });

      console.log('[data.js] ✓ Loaded', firestoreCategories.length, 'categories from Firestore server.');
      
      // ALWAYS overwrite localStorage with live Firestore data (single source of truth)
      localStorage.setItem('jcs_categories', JSON.stringify(firestoreCategories));
      return firestoreCategories;
    })
    .catch(err => {
      console.error('[data.js] ✗ Firestore category fetch FAILED:', err);
      console.error('[data.js] Error code:', err.code, 'Message:', err.message);
      console.log('[data.js] Falling back to localStorage cache.');
      return getCategories();
    });

  // Race the fetch against the timeout
  return Promise.race([fetchPromise, timeoutPromise]).catch(timeoutErr => {
    console.error('[data.js] ✗ Timeout or error in loadCategoriesFromFirestore:', timeoutErr);
    return getCategories();
  });
}

/**
 * Save (upsert) a single category to Firestore.
 * Uses the numeric category `id` as the Firestore document ID.
 */
function saveCategoryToFirestore(category) {
  console.log('[data.js] saveCategoryToFirestore called with:', category);
  console.log('[data.js] window.db status:', window.db ? 'CONNECTED' : 'NULL');
  
  if (!window.db) {
    console.warn('[data.js] window.db is NULL, returning resolved promise.');
    return Promise.resolve();
  }

  console.log('[data.js] Attempting Firestore set() for doc ID:', String(category.id));
  return window.db.collection('categories')
    .doc(String(category.id))
    .set(category)
    .then(() => {
      console.log('[data.js] ✓ Firestore set() succeeded for category:', category.id);
      // Update localStorage cache
      const cached = getCategories();
      const idx = cached.findIndex(c => Number(c.id) === Number(category.id));
      if (idx !== -1) {
        cached[idx] = category;
      } else {
        cached.push(category);
      }
      localStorage.setItem('jcs_categories', JSON.stringify(cached));
    })
    .catch(err => {
      console.error('[data.js] ✗ Firestore set() FAILED for category:', err);
      console.error('[data.js] Error code:', err.code, 'Message:', err.message);
      throw err; // Re-throw so caller can show user-facing error
    });
}

/**
 * Delete a category from Firestore by its numeric id.
 */
function deleteCategoryFromFirestore(categoryId) {
  if (!window.db) return Promise.resolve();

  return window.db.collection('categories')
    .doc(String(categoryId))
    .delete()
    .then(() => {
      // Update localStorage cache
      const cached = getCategories().filter(c => Number(c.id) !== Number(categoryId));
      localStorage.setItem('jcs_categories', JSON.stringify(cached));
    })
    .catch(err => {
      console.error('[Firestore] Failed to delete category:', err);
      throw err; // Re-throw so caller can show user-facing error
    });
}

/**
 * One-time bulk seed: pushes categories into Firestore.
 * @param {Array} [sourceCategories] - Categories to seed. Defaults to localStorage, then DEFAULT_CATEGORIES.
 */
function seedFirestoreCategories(sourceCategories) {
  if (!window.db) return Promise.resolve();

  const categoriesToSeed = (sourceCategories && sourceCategories.length > 0)
    ? sourceCategories
    : (getCategories().length > 0 ? getCategories() : DEFAULT_CATEGORIES);

  const batch = window.db.batch();
  categoriesToSeed.forEach(cat => {
    const ref = window.db.collection('categories').doc(String(cat.id));
    batch.set(ref, cat);
  });

  return batch.commit().then(() => {
    localStorage.setItem('jcs_categories', JSON.stringify(categoriesToSeed));
    console.log('[Firestore] Seeded', categoriesToSeed.length, 'categories.');
  });
}

/**
 * Bulk save all categories to Firestore (replaces entire collection snapshot).
 */
function saveAllCategoriesToFirestore(categories) {
  if (!window.db) return Promise.resolve();

  const batch = window.db.batch();
  categories.forEach(cat => {
    const ref = window.db.collection('categories').doc(String(cat.id));
    batch.set(ref, cat);
  });

  return batch.commit().then(() => {
    localStorage.setItem('jcs_categories', JSON.stringify(categories));
  })
  .catch(err => {
    console.error('[Firestore] Failed to bulk save categories:', err);
    throw err; // Re-throw so caller can show user-facing error
  });
}

/* ==========================================================================
   OFFER BANNER — Firestore Sync Layer
   Single document (ID: 'diwali_sale') in the 'offers' collection.
   Stores the configurable Diwali/festival sale banner with countdown timer.
   ========================================================================== */

const DEFAULT_OFFER = {
  id: 'diwali_sale',
  tag: '🎉 FESTIVAL EXTRAVAGANZA',
  title: 'DIWALI BIG SALE',
  subTitle: 'Get Flat 10% Extra Discount on orders above ₹10,000',
  description: 'Stock up early for your community celebrations. Free delivery across major cities. Offer valid till Diwali eve!',
  buttonText: 'Claim Big Discount Now',
  buttonLink: '#',
  targetDate: '2026-11-08T23:59:59',
  active: true
};

/**
 * Get offer from localStorage, falling back to DEFAULT_OFFER.
 */
function getOffer() {
  const stored = localStorage.getItem('jcs_offer');
  if (!stored) {
    console.warn('[getOffer] localStorage empty. Returning DEFAULT_OFFER.');
    return DEFAULT_OFFER;
  }
  try {
    const parsed = JSON.parse(stored);
    if (!parsed || typeof parsed !== 'object') {
      console.error('[getOffer] Parsed data invalid. Returning DEFAULT_OFFER.');
      return DEFAULT_OFFER;
    }
    return parsed;
  } catch (e) {
    console.error('[getOffer] JSON.parse failed. Returning DEFAULT_OFFER.', e);
    return DEFAULT_OFFER;
  }
}

/**
 * Fetch offer document from Firestore server.
 * Falls back to localStorage -> DEFAULT_OFFER on failure.
 */
function loadOfferFromFirestore() {
  console.log('[data.js] loadOfferFromFirestore() called. window.db:', window.db ? 'CONNECTED' : 'NULL');

  if (!window.db) {
    console.warn('[data.js] window.db is NULL. Returning localStorage offer.');
    return Promise.resolve(getOffer());
  }

  const timeoutPromise = new Promise((_, reject) => {
    setTimeout(() => reject(new Error('Firestore offer fetch timeout (10s)')), 10000);
  });

  const fetchPromise = window.db.collection('offers')
    .doc('diwali_sale')
    .get({ source: 'server' })
    .then(doc => {
      console.log('[data.js] Firestore offer doc received. Exists?', doc.exists);

      if (!doc.exists) {
        console.log('[data.js] Offer doc does not exist. Seeding DEFAULT_OFFER.');
        return window.db.collection('offers').doc('diwali_sale').set(DEFAULT_OFFER).then(() => {
          console.log('[data.js] ✓ DEFAULT_OFFER seeded to Firestore.');
          localStorage.setItem('jcs_offer', JSON.stringify(DEFAULT_OFFER));
          return DEFAULT_OFFER;
        });
      }

      const offerData = doc.data();
      console.log('[data.js] ✓ Loaded offer from Firestore server:', offerData.title);
      localStorage.setItem('jcs_offer', JSON.stringify(offerData));
      return offerData;
    })
    .catch(err => {
      console.error('[data.js] ✗ Firestore offer fetch FAILED:', err);
      return getOffer();
    });

  return Promise.race([fetchPromise, timeoutPromise]).catch(timeoutErr => {
    console.error('[data.js] ✗ Timeout in loadOfferFromFirestore:', timeoutErr);
    return getOffer();
  });
}

/**
 * Save offer document to Firestore.
 */
function saveOfferToFirestore(offer) {
  console.log('[data.js] saveOfferToFirestore called with:', offer);

  if (!window.db) {
    console.warn('[data.js] window.db is NULL. Saving to localStorage only.');
    localStorage.setItem('jcs_offer', JSON.stringify(offer));
    return Promise.resolve();
  }

  return window.db.collection('offers')
    .doc('diwali_sale')
    .set(offer)
    .then(() => {
      console.log('[data.js] ✓ Offer saved to Firestore successfully.');
      localStorage.setItem('jcs_offer', JSON.stringify(offer));
    })
    .catch(err => {
      console.error('[data.js] ✗ Firestore offer save FAILED:', err);
      console.error('[data.js] Error code:', err.code, 'Message:', err.message);
      throw err;
    });
}

/* ==========================================================================
   COUPON CODES - Firestore Sync Layer
   - loadCouponsFromFirestore(): fetches coupons collection, caches to localStorage
   - saveCouponToFirestore(coupon): upserts a single coupon doc
   - deleteCouponFromFirestore(code): removes a coupon doc by code
   - seedFirestoreCoupons(): one-time bulk seed from defaults
   All functions are async and return Promises.
   ========================================================================== */

const DEFAULT_COUPONS = [
  { code: 'FESTIVE20', discountPercent: 20, validUntil: '2026-12-31T23:59:59', active: true }
];

/**
 * Get coupons from localStorage, falling back to DEFAULT_COUPONS.
 */
function getCoupons() {
  const stored = localStorage.getItem('jcs_coupons');
  if (!stored) {
    console.warn('[getCoupons] localStorage empty. Returning DEFAULT_COUPONS.');
    return DEFAULT_COUPONS;
  }
  try {
    const parsed = JSON.parse(stored);
    if (!Array.isArray(parsed)) {
      console.error('[getCoupons] Parsed data is not an array. Returning DEFAULT_COUPONS.');
      return DEFAULT_COUPONS;
    }
    return parsed;
  } catch (e) {
    console.error('[getCoupons] JSON.parse failed. Returning DEFAULT_COUPONS.', e);
    return DEFAULT_COUPONS;
  }
}

/**
 * Fetch all coupons from Firestore (LIVE SERVER), ordered by code.
 * Caches to localStorage under 'jcs_coupons' for instant subsequent reads.
 * Seeds Firestore if the collection is empty.
 */
function loadCouponsFromFirestore() {
  console.log('[data.js] loadCouponsFromFirestore() called. window.db:', window.db ? 'CONNECTED' : 'NULL');

  if (!window.db) {
    console.warn('[data.js] window.db is NULL. Returning localStorage coupons.');
    return Promise.resolve(getCoupons());
  }

  const timeoutPromise = new Promise((_, reject) => {
    setTimeout(() => reject(new Error('Firestore coupons fetch timeout (10s)')), 10000);
  });

  const fetchPromise = window.db.collection('coupons')
    .orderBy('code', 'asc')
    .get({ source: 'server' })
    .then(snapshot => {
      console.log('[data.js] Firestore coupons snapshot received. Empty?', snapshot.empty);

      if (snapshot.empty) {
        console.log('[data.js] Coupons collection empty on server. Seeding DEFAULT_COUPONS.');
        return seedFirestoreCoupons(DEFAULT_COUPONS).then(() => DEFAULT_COUPONS);
      }

      const coupons = [];
      snapshot.forEach(doc => {
        coupons.push(doc.data());
      });

      console.log('[data.js] ✓ Loaded', coupons.length, 'coupons from Firestore server.');
      localStorage.setItem('jcs_coupons', JSON.stringify(coupons));
      return coupons;
    })
    .catch(err => {
      console.error('[data.js] ✗ Firestore coupons fetch FAILED:', err);
      return getCoupons();
    });

  return Promise.race([fetchPromise, timeoutPromise]).catch(timeoutErr => {
    console.error('[data.js] ✗ Timeout in loadCouponsFromFirestore:', timeoutErr);
    return getCoupons();
  });
}

/**
 * Save (upsert) a single coupon to Firestore.
 * Uses the coupon code as the Firestore document ID.
 */
function saveCouponToFirestore(coupon) {
  console.log('[data.js] saveCouponToFirestore called with:', coupon);

  if (!window.db) {
    console.warn('[data.js] window.db is NULL, returning resolved promise.');
    return Promise.resolve();
  }

  const code = String(coupon.code || '').toUpperCase();
  return window.db.collection('coupons')
    .doc(code)
    .set({
      code: code,
      discountPercent: coupon.discountPercent || 0,
      validUntil: coupon.validUntil || '',
      active: coupon.active !== false
    })
    .then(() => {
      console.log('[data.js] ✓ Coupon saved to Firestore successfully:', code);
      // Update localStorage cache
      const cached = getCoupons();
      const idx = cached.findIndex(c => c.code === code);
      if (idx !== -1) {
        cached[idx] = coupon;
      } else {
        cached.push(coupon);
      }
      localStorage.setItem('jcs_coupons', JSON.stringify(cached));
    })
    .catch(err => {
      console.error('[data.js] ✗ Firestore coupon save FAILED:', err);
      throw err;
    });
}

/**
 * Delete a coupon from Firestore by its code.
 */
function deleteCouponFromFirestore(code) {
  if (!window.db) return Promise.resolve();

  const upperCode = String(code).toUpperCase();
  return window.db.collection('coupons')
    .doc(upperCode)
    .delete()
    .then(() => {
      console.log('[data.js] ✓ Coupon deleted from Firestore:', upperCode);
      // Update localStorage cache
      const cached = getCoupons().filter(c => c.code !== upperCode);
      localStorage.setItem('jcs_coupons', JSON.stringify(cached));
    })
    .catch(err => {
      console.error('[data.js] ✗ Firestore coupon delete FAILED:', err);
      throw err;
    });
}

/**
 * One-time bulk seed: pushes coupons into Firestore.
 */
function seedFirestoreCoupons(sourceCoupons) {
  if (!window.db) return Promise.resolve();

  const couponsToSeed = (sourceCoupons && sourceCoupons.length > 0)
    ? sourceCoupons
    : DEFAULT_COUPONS;

  const batch = window.db.batch();
  couponsToSeed.forEach(coupon => {
    const code = String(coupon.code || '').toUpperCase();
    const ref = window.db.collection('coupons').doc(code);
    batch.set(ref, {
      code: code,
      discountPercent: coupon.discountPercent || 0,
      validUntil: coupon.validUntil || '',
      active: coupon.active !== false
    });
  });

  return batch.commit().then(() => {
    localStorage.setItem('jcs_coupons', JSON.stringify(couponsToSeed));
    console.log('[Firestore] Seeded', couponsToSeed.length, 'coupons.');
  });
}

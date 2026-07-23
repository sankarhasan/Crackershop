// JCS Crackers - Common Data & localStorage API

const DEFAULT_CATEGORIES = [
  { id: "A", name: 'Ground Chakkars', slug: 'ground-chakkars', image: '', categoryImageUrl: '' },
  { id: "B", name: 'Flower Pots', slug: 'flower-pots', image: '', categoryImageUrl: '' },
  { id: "C", name: 'Fancy Fountains', slug: 'fancy-fountains', image: '', categoryImageUrl: '' },
  { id: "D", name: 'Pencils', slug: 'pencils', image: '', categoryImageUrl: '' },
  { id: "E", name: 'Sparklers', slug: 'sparklers', image: '', categoryImageUrl: '' },
  { id: "F", name: 'Atom Bombs', slug: 'atom-bombs', categoryImageUrl: '' },
  { id: "G", name: 'Rockets', slug: 'rockets', image: '', categoryImageUrl: '' },
  { id: "H", name: 'Bijili Crackers', slug: 'bijili-crackers', image: '', categoryImageUrl: '' },
  { id: "I", name: 'Combo Packs', slug: 'combo-packs', image: '', categoryImageUrl: '' }
];

const DEFAULT_PRODUCTS = [
  // Ground Chakkars (Category A)
  { id: "A1", name: 'Chakkar Ash (Big)', categoryId: "A", price: 180, originalPrice: 300, discount: '40% OFF', qty: '1 Box / 10 Pcs', description: 'Traditional spinning wheel wheel-firework that spins on the ground with silver sparks.', inStock: true },
  { id: "A2", name: 'Chakkar Special (Medium)', categoryId: "A", price: 120, originalPrice: 200, discount: '40% OFF', qty: '1 Box / 10 Pcs', description: 'Classic ground chakkar spinning with red and green sparks.', inStock: true },
  { id: "A3", name: 'Deluxe Ground Chakkar', categoryId: "A", price: 290, originalPrice: 450, discount: '35% OFF', qty: '1 Box / 5 Pcs', description: 'Extra large ground wheel with bright golden sparks and longer duration.', inStock: true },

  // Flower Pots (Category B)
  { id: "B1", name: 'Flower Pots Ash (Big)', categoryId: "B", price: 210, originalPrice: 350, discount: '40% OFF', qty: '1 Box / 10 Pcs', description: 'Classic cone fountain emitting bright silver and golden fountain of sparks.', inStock: true },
  { id: "B2", name: 'Flower Pots Special', categoryId: "B", price: 150, originalPrice: 250, discount: '40% OFF', qty: '1 Box / 10 Pcs', description: 'Medium sized flower pots producing bright multicolored sparkles.', inStock: true },
  { id: "B3", name: 'Flower Pots Deluxe', categoryId: "B", price: 340, originalPrice: 500, discount: '32% OFF', qty: '1 Box / 5 Pcs', description: 'Giant cone firework emitting showers of golden stars up to 10 feet high.', inStock: true },

  // Fancy Fountains (Category C)
  { id: "C1", name: 'Fancy Fountain (7 Color)', categoryId: "C", price: 390, originalPrice: 650, discount: '40% OFF', qty: '1 Box / 2 Pcs', description: 'Fountain that sequentially changes colors into seven vibrant shades.', inStock: true },
  { id: "C2", name: 'Crackling King Fountain', categoryId: "C", price: 450, originalPrice: 750, discount: '40% OFF', qty: '1 Box / 1 Pc', description: 'Spectacular fountain with heavy crackling sound and silver glitters.', inStock: true },

  // Pencils (Category D)
  { id: "D1", name: 'Color Pencils (Extra Long)', categoryId: "D", price: 110, originalPrice: 180, discount: '38% OFF', qty: '1 Box / 10 Pcs', description: 'Pencil sticks that emit multi-colored fire sparkles from the tip.', inStock: true },
  { id: "D2", name: 'Deluxe Sparkle Pencil', categoryId: "D", price: 140, originalPrice: 220, discount: '36% OFF', qty: '1 Box / 5 Pcs', description: 'Thick hand-held sticks emitting heavy gold crackling sparks.', inStock: true },

  // Sparklers (Category E)
  { id: "E1", name: '10 cm Electric Sparklers', categoryId: "E", price: 40, originalPrice: 80, discount: '50% OFF', qty: '1 Box / 10 Pcs', description: 'Classic hand-held steel wire sparklers that emit brilliant silver sparks.', inStock: true },
  { id: "E2", name: '15 cm Multi-Color Sparklers', categoryId: "E", price: 90, originalPrice: 150, discount: '40% OFF', qty: '1 Box / 10 Pcs', description: 'Sparklers that burn in multiple colors including Red, Green, and Gold.', inStock: true },
  { id: "E3", name: '30 cm Mega Gold Sparklers', categoryId: "E", price: 190, originalPrice: 300, discount: '36% OFF', qty: '1 Box / 5 Pcs', description: 'Extra-long giant sparklers with rich gold spark emissions and long burning time.', inStock: true },

  // Atom Bombs (Category F)
  { id: "F1", name: 'Hydro Bomb (Green)', categoryId: "F", price: 130, originalPrice: 220, discount: '40% OFF', qty: '1 Box / 10 Pcs', description: 'Traditional jute-wrapped thread bomb with high decibel explosion sound.', inStock: true },
  { id: "F2", name: 'King of King Bomb', categoryId: "F", price: 250, originalPrice: 400, discount: '37% OFF', qty: '1 Box / 5 Pcs', description: 'Heavy charge giant bomb with a earth-shaking loud thunder sound.', inStock: true },

  // Rockets (Category G)
  { id: "G1", name: 'Baby Rocket', categoryId: "G", price: 150, originalPrice: 250, discount: '40% OFF', qty: '1 Box / 10 Pcs', description: 'Cute small rockets that zoom into the air with a soft whistle and pop.', inStock: true },
  { id: "G2", name: 'Lunik Sky shot Rocket', categoryId: "G", price: 290, originalPrice: 480, discount: '39% OFF', qty: '1 Box / 3 Pcs', description: 'Shoots high up and bursts into a beautiful umbrella of colorful stars.', inStock: true },

  // Bijili Crackers (Category H)
  { id: "H1", name: 'Red Bijili (50 Wala)', categoryId: "H", price: 80, originalPrice: 140, discount: '42% OFF', qty: '1 Packet / 50 Pcs', description: 'Small red thread crackers offering rapid crackling sounds.', inStock: true },
  { id: "H2", name: 'Stripped Bijili (100 Wala)', categoryId: "H", price: 140, originalPrice: 240, discount: '41% OFF', qty: '1 Packet / 100 Pcs', description: 'Long chain of small sound crackers that burst sequentially.', inStock: true },

  // Combo Packs (Category I)
  { id: "I1", name: 'KPR Diwali Family Combo (Budget)', categoryId: "I", price: 2499, originalPrice: 4200, discount: '40% OFF', qty: '1 Box / 25 Varieties', description: 'Curated box containing Chakkars, Sparklers, Flower pots, Pencils, and small Bombs for children.', inStock: true },
  { id: "I2", name: 'KPR Grand Festive Combo (Mega)', categoryId: "I", price: 4999, originalPrice: 8500, discount: '41% OFF', qty: '1 Box / 50 Varieties', description: 'Mega box of joy including heavy aerial sky shots, fancy fountains, deluxe sparklers, and sound bombs.', inStock: true }
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

/**
 * Persist a customer enquiry directly to the Firestore "enquiries" collection.
 * Uses the shared compat-SDK handle (window.db) initialized in
 * firebase-config.js. A server-side timestamp is ALWAYS attached because the
 * admin panel orders enquiries by the `timestamp` field — documents without it
 * would be excluded from the ordered query and appear "missing".
 *
 * @param {Object} enquiryData - Structured enquiry payload (customer, cartItems,
 *                               financialBreakdown, message, etc.).
 * @returns {Promise<string>} Resolves with the new Firestore document ID.
 */
function saveEnquiryToFirestore(enquiryData) {
  if (!window.db || typeof firebase === 'undefined') {
    console.error('[Firestore] Cannot save enquiry: Firestore (window.db) is not initialized.');
    return Promise.reject(new Error('Firestore is not initialized.'));
  }

  const payload = {
    ...enquiryData,
    status: enquiryData.status || 'new',
    timestamp: firebase.firestore.FieldValue.serverTimestamp()
  };

  return window.db.collection('enquiries').add(payload)
    .then((docRef) => {
      console.log('[Firestore] Enquiry saved with ID:', docRef.id);
      return docRef.id;
    })
    .catch((error) => {
      console.error('[Firestore] Error adding enquiry:', error);
      throw error;
    });
}

// Expose the helper globally so it is reachable from app.js (classic scripts).
if (typeof window !== 'undefined') {
  window.saveEnquiryToFirestore = saveEnquiryToFirestore;
}

// Helper to generate next unique ID
function generateId(items) {
  if (!items || items.length === 0) return 1;
  const ids = items.map(item => Number(item.id)).filter(id => !isNaN(id));
  return ids.length > 0 ? Math.max(...ids) + 1 : 1;
}

/**
 * Get the alphabetical code for a category based on its display order index.
 * Categories are 0-indexed, so we add 1 to get the position.
 * @param {number} categoryIndex - The index of the category (0-based)
 * @returns {string} - The alphabetical code (A, B, C, etc.)
 */
function getCategoryCode(categoryIndex) {
  if (typeof categoryIndex !== 'number' || categoryIndex < 0) return '?';
  const code = String.fromCharCode(65 + categoryIndex); // 65 = 'A'
  return code;
}

/**
 * Get the category letter from a category ID (supports both string "A" and numeric 1 formats).
 * @param {string|number} categoryId - The category ID
 * @returns {string} - The category letter (A, B, C, etc.) or '?'
 */
function getCategoryLetterFromId(categoryId) {
  if (!categoryId) return '?';
  const catIdStr = String(categoryId).trim().toUpperCase();
  // If already a letter, return it
  if (/^[A-Z]$/.test(catIdStr)) return catIdStr;
  // If numeric, convert to letter
  const num = parseInt(catIdStr, 10);
  if (!isNaN(num) && num >= 1 && num <= 26) {
    return String.fromCharCode(64 + num); // 1 -> A, 2 -> B, etc.
  }
  return '?';
}

/**
 * Get the category index from a category ID (supports both string "A" and numeric 1 formats).
 * @param {string|number} categoryId - The category ID
 * @returns {number} - The category index (0-based) or -1 if not found
 */
function getCategoryIndex(categoryId) {
  if (!categoryId) return -1;
  const catIdStr = String(categoryId).trim().toUpperCase();
  // If already a letter, convert to index
  if (/^[A-Z]$/.test(catIdStr)) {
    return catIdStr.charCodeAt(0) - 65; // A -> 0, B -> 1, etc.
  }
  // If numeric, return zero-based index
  const num = parseInt(catIdStr, 10);
  if (!isNaN(num) && num >= 1 && num <= 26) {
    return num - 1; // 1 -> 0, 2 -> 1, etc.
  }
  return -1;
}

/**
 * Get the alphanumeric product code based on category and product position.
 * Products are indexed sequentially within each category.
 * @param {string|number} categoryId - The category ID (e.g., "A" or 1)
 * @param {number} productIndexWithinCategory - The 1-based index of the product within its category
 * @returns {string} - The alphanumeric code (e.g., A1, B2, C3)
 */
function getProductCode(categoryId, productIndexWithinCategory) {
  const categoryLetter = getCategoryLetterFromId(categoryId);
  if (categoryLetter === '?') return `#?${productIndexWithinCategory || ''}`;
  return `${categoryLetter}${productIndexWithinCategory || ''}`;
}

/**
 * Get products sorted by category and calculate their display index within each category.
 * Returns the product index (1-based) for a given product ID within its category.
 * @param {string|number} productId - The product ID
 * @returns {object} - { index: number, categoryId: string|number, categoryIndex: number, categoryLetter: string }
 */
function getProductDisplayIndex(productId) {
  const products = getProducts();
  const categories = getCategories();
  const prod = products.find(p => String(p.id) === String(productId));
  if (!prod) return { index: 0, categoryId: 0, categoryIndex: -1, categoryLetter: '?' };
  
  const catIndex = getCategoryIndex(prod.categoryId);
  if (catIndex === -1) return { index: 0, categoryId: prod.categoryId, categoryIndex: -1, categoryLetter: '?' };
  
  // Get all products in the same category, sorted by their ID
  const catProducts = products
    .filter(p => String(p.categoryId).toUpperCase() === String(prod.categoryId).toUpperCase())
    .sort((a, b) => {
      const idA = String(a.id).toUpperCase();
      const idB = String(b.id).toUpperCase();
      return idA.localeCompare(idB);
    });
  
  const productIndex = catProducts.findIndex(p => String(p.id).toUpperCase() === String(productId).toUpperCase()) + 1;
  return {
    index: productIndex,
    categoryId: prod.categoryId,
    categoryIndex: catIndex,
    categoryLetter: getCategoryCode(catIndex)
  };
}

/* ==========================================================================
   FIRESTORE DATA SANITIZATION
   Fixes mismatches between document IDs and inner field values.
   ========================================================================== */

/**
 * Sanitize Firestore product data by ensuring:
 * 1. Product doc.id matches inner field `id`
 * 2. categoryId is updated to match the Category Letter String
 * This function should be called once during admin initialization.
 */
async function sanitizeFirestoreProducts() {
  if (!window.db) {
    console.warn('[Sanitizer] Firestore not connected. Skipping sanitization.');
    return { success: false, message: 'Firestore not connected' };
  }

  try {
    console.log('[Sanitizer] Starting Firestore product data sanitization...');
    
    // Get all categories to determine the letter mapping
    const categories = await loadCategoriesFromFirestore();
    
    // Map categories by their index to letter
    const categoryLetterMap = {};
    categories.forEach((cat, idx) => {
      const letter = getCategoryLetterFromId(cat.id);
      categoryLetterMap[idx + 1] = letter; // numeric -> letter
      categoryLetterMap[letter] = letter; // letter -> letter (pass-through)
    });
    
    // Fetch all products
    const snapshot = await window.db.collection('products').get();
    const batch = window.db.batch();
    let fixCount = 0;
    
    snapshot.forEach(doc => {
      const data = doc.data();
      const docId = doc.id;
      let needsUpdate = false;
      const updates = {};
      
      // Fix 1: Ensure inner `id` matches document ID
      if (String(data.id) !== docId) {
        updates.id = docId;
        needsUpdate = true;
        console.log(`[Sanitizer] Product ${docId}: Fixing inner id from "${data.id}" to "${docId}"`);
      }
      
      // Fix 2: Ensure categoryId is the letter string
      const correctCategoryId = categoryLetterMap[data.categoryId] || categoryLetterMap[String(data.categoryId)];
      if (correctCategoryId && String(data.categoryId) !== correctCategoryId) {
        updates.categoryId = correctCategoryId;
        needsUpdate = true;
        console.log(`[Sanitizer] Product ${docId}: Fixing categoryId from "${data.categoryId}" to "${correctCategoryId}"`);
      }
      
      if (needsUpdate) {
        batch.update(doc.ref, updates);
        fixCount++;
      }
    });
    
    if (fixCount > 0) {
      await batch.commit();
      console.log(`[Sanitizer] ✓ Fixed ${fixCount} product documents in Firestore.`);
      // Refresh localStorage cache
      await loadProductsFromFirestore();
    } else {
      console.log('[Sanitizer] ✓ No product documents needed fixing.');
    }
    
    return { success: true, fixedCount: fixCount };
  } catch (err) {
    console.error('[Sanitizer] ✗ Failed to sanitize Firestore products:', err);
    return { success: false, message: err.message };
  }
}

/**
 * Sanitize Firestore category data by ensuring category IDs are strings.
 */
async function sanitizeFirestoreCategories() {
  if (!window.db) {
    console.warn('[Sanitizer] Firestore not connected. Skipping sanitization.');
    return { success: false, message: 'Firestore not connected' };
  }

  try {
    console.log('[Sanitizer] Starting Firestore category data sanitization...');
    
    const snapshot = await window.db.collection('categories').get();
    const batch = window.db.batch();
    let fixCount = 0;
    
    snapshot.forEach(doc => {
      const data = doc.data();
      const docId = doc.id;
      
      // Ensure inner `id` matches document ID (should be letter strings)
      if (String(data.id) !== docId) {
        batch.update(doc.ref, { id: docId });
        fixCount++;
        console.log(`[Sanitizer] Category ${docId}: Fixing inner id from "${data.id}" to "${docId}"`);
      }
    });
    
    if (fixCount > 0) {
      await batch.commit();
      console.log(`[Sanitizer] ✓ Fixed ${fixCount} category documents in Firestore.`);
      await loadCategoriesFromFirestore();
    } else {
      console.log('[Sanitizer] ✓ No category documents needed fixing.');
    }
    
    return { success: true, fixedCount: fixCount };
  } catch (err) {
    console.error('[Sanitizer] ✗ Failed to sanitize Firestore categories:', err);
    return { success: false, message: err.message };
  }
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

  // Fetch categories directly without artificial timeout
  return window.db.collection('categories')
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

/* ==========================================================================
   STATE MINIMUM ORDER RULES - Firestore Sync Layer
   - getStateMinimumRules(): fetches state rules from Firestore, caches to localStorage
   - saveStateMinimumRules(rules): upserts all state rules to Firestore
   - saveStateRuleToFirestore(rule): upserts a single state rule
   - deleteStateRuleFromFirestore(stateName): removes a state rule by name
   All functions are async and return Promises.
   ========================================================================== */

const DEFAULT_STATE_RULES = [
  { state: 'Tamil Nadu', minimumOrder: 3000 },
  { state: 'Kerala', minimumOrder: 5000 },
  { state: 'Telangana', minimumOrder: 4000 }
];

/**
 * Get state minimum rules from localStorage, falling back to defaults.
 */
function getStateMinimumRules() {
  const stored = localStorage.getItem('kpr_state_rules');
  if (!stored) {
    console.warn('[getStateMinimumRules] localStorage empty. Returning DEFAULT_STATE_RULES.');
    return DEFAULT_STATE_RULES;
  }
  try {
    const parsed = JSON.parse(stored);
    if (!Array.isArray(parsed)) {
      console.error('[getStateMinimumRules] Parsed data is not an array. Returning DEFAULT_STATE_RULES.');
      return DEFAULT_STATE_RULES;
    }
    return parsed;
  } catch (e) {
    console.error('[getStateMinimumRules] JSON.parse failed. Returning DEFAULT_STATE_RULES.', e);
    return DEFAULT_STATE_RULES;
  }
}

/**
 * Get the minimum order value for a specific state.
 * @param {string} stateName - The state name to look up
 * @returns {number} - The minimum order value, or 3000 as default
 */
function getStateMinimumOrder(stateName) {
  if (!stateName) return 3000;
  const rules = getStateMinimumRules();
  const rule = rules.find(r => r.state.toLowerCase() === stateName.toLowerCase());
  return rule ? rule.minimumOrder : 3000; // Default to 3000 if state not found
}

/**
 * Fetch all state minimum rules from Firestore (LIVE SERVER).
 * Caches to localStorage under 'kpr_state_rules' for instant subsequent reads.
 */
function loadStateMinimumRulesFromFirestore() {
  console.log('[data.js] loadStateMinimumRulesFromFirestore() called. window.db:', window.db ? 'CONNECTED' : 'NULL');

  if (!window.db) {
    console.warn('[data.js] window.db is NULL. Returning localStorage state rules.');
    return Promise.resolve(getStateMinimumRules());
  }

  const timeoutPromise = new Promise((_, reject) => {
    setTimeout(() => reject(new Error('Firestore state rules fetch timeout (10s)')), 10000);
  });

  const fetchPromise = window.db.collection('stateRules')
    .orderBy('state', 'asc')
    .get({ source: 'server' })
    .then(snapshot => {
      console.log('[data.js] Firestore state rules snapshot received. Empty?', snapshot.empty);

      if (snapshot.empty) {
        console.log('[data.js] State rules collection empty on server. Seeding DEFAULT_STATE_RULES.');
        return seedFirestoreStateRules(DEFAULT_STATE_RULES).then(() => DEFAULT_STATE_RULES);
      }

      const rules = [];
      snapshot.forEach(doc => {
        rules.push(doc.data());
      });

      console.log('[data.js] ✓ Loaded', rules.length, 'state rules from Firestore server.');
      localStorage.setItem('kpr_state_rules', JSON.stringify(rules));
      return rules;
    })
    .catch(err => {
      console.error('[data.js] ✗ Firestore state rules fetch FAILED:', err);
      return getStateMinimumRules();
    });

  return Promise.race([fetchPromise, timeoutPromise]).catch(timeoutErr => {
    console.error('[data.js] ✗ Timeout in loadStateMinimumRulesFromFirestore:', timeoutErr);
    return getStateMinimumRules();
  });
}

/**
 * Save (upsert) all state rules to Firestore.
 */
function saveStateRulesToFirestore(rules) {
  if (!window.db) return Promise.resolve();

  const batch = window.db.batch();
  rules.forEach(rule => {
    const ref = window.db.collection('stateRules').doc(String(rule.state));
    batch.set(ref, {
      state: rule.state,
      minimumOrder: rule.minimumOrder
    });
  });

  return batch.commit().then(() => {
    localStorage.setItem('kpr_state_rules', JSON.stringify(rules));
    console.log('[Firestore] Saved', rules.length, 'state rules.');
  }).catch(err => {
    console.error('[Firestore] Failed to save state rules:', err);
    throw err;
  });
}

/**
 * One-time bulk seed: pushes state rules into Firestore.
 */
function seedFirestoreStateRules(sourceRules) {
  if (!window.db) return Promise.resolve();

  const rulesToSeed = (sourceRules && sourceRules.length > 0)
    ? sourceRules
    : DEFAULT_STATE_RULES;

  const batch = window.db.batch();
  rulesToSeed.forEach(rule => {
    const ref = window.db.collection('stateRules').doc(String(rule.state));
    batch.set(ref, {
      state: rule.state,
      minimumOrder: rule.minimumOrder
    });
  });

  return batch.commit().then(() => {
    localStorage.setItem('kpr_state_rules', JSON.stringify(rulesToSeed));
    console.log('[Firestore] Seeded', rulesToSeed.length, 'state rules.');
  });
}

/**
 * Delete a state rule from Firestore by state name.
 * @param {string} stateName - The state name to delete
 */
function deleteStateRuleFromFirestore(stateName) {
  if (!window.db) return Promise.resolve();

  return window.db.collection('stateRules')
    .doc(String(stateName))
    .delete()
    .then(() => {
      console.log('[data.js] ✓ State rule deleted from Firestore:', stateName);
      // Update localStorage cache
      const cached = getStateMinimumRules().filter(r => r.state !== stateName);
      localStorage.setItem('kpr_state_rules', JSON.stringify(cached));
    })
    .catch(err => {
      console.error('[data.js] ✗ Firestore state rule delete FAILED:', err);
      throw err;
    });
}

/* ==========================================================================
   FIRESTORE REAL-TIME LISTENERS (onSnapshot)
   These listeners provide instant UI updates when admin changes data.
   They replace the need for manual page refresh on the storefront.
   When any category, product, or banner is added/edited/deleted from the
   Admin panel, the storefront immediately reflects the changes.
   ========================================================================== */

// Unsubscribe handles for clean teardown
let _unsubscribeCategoriesListener = null;
let _unsubscribeProductsListener = null;
let _unsubscribeBannersListener = null;

/**
 * Set up a real-time onSnapshot listener for the categories collection.
 * - On initial snapshot: hydrates localStorage and renders the UI
 * - On subsequent changes: immediately updates localStorage and re-renders
 * - Handles empty collection by seeding defaults
 * - Gracefully errors: falls back silently if Firestore is unavailable
 * @returns {function|null} The unsubscribe function, or null if Firestore is unavailable
 */
function listenCategoriesRealtime() {
  if (!window.db) {
    console.warn('[Realtime] Firestore not connected. Cannot listen to categories.');
    return null;
  }

  // Unsubscribe any previous listener to prevent duplicates
  if (_unsubscribeCategoriesListener) {
    _unsubscribeCategoriesListener();
    _unsubscribeCategoriesListener = null;
  }

  console.log('[Realtime] 📡 Setting up CATEGORIES real-time listener...');

  _unsubscribeCategoriesListener = window.db.collection('categories')
    .orderBy('id', 'asc')
    .onSnapshot((snapshot) => {
      console.log('[Realtime] Categories snapshot received. Size:', snapshot.size, 'Empty:', snapshot.empty);

      let categories;

      if (snapshot.empty) {
        // Collection is empty — seed with defaults so the storefront is never blank
        console.log('[Realtime] Categories collection empty. Seeding DEFAULT_CATEGORIES to Firestore...');
        const batch = window.db.batch();
        DEFAULT_CATEGORIES.forEach(cat => {
          const ref = window.db.collection('categories').doc(String(cat.id));
          batch.set(ref, cat);
        });
        batch.commit().then(() => {
          console.log('[Realtime] ✓ Default categories seeded.');
        }).catch(err => {
          console.error('[Realtime] ✗ Failed to seed categories:', err);
        });
        categories = DEFAULT_CATEGORIES;
      } else {
        categories = [];
        snapshot.forEach(doc => {
          categories.push(doc.data());
        });
      }

      // Always update localStorage (single source of truth)
      localStorage.setItem('jcs_categories', JSON.stringify(categories));

      // Re-render all storefront UI that depends on categories
      if (typeof renderCategoriesGrid === 'function') {
        renderCategoriesGrid();
      }
      if (typeof renderFilterButtons === 'function') {
        renderFilterButtons();
      }
      if (typeof renderProductsCatalog === 'function') {
        renderProductsCatalog();
      }
      if (typeof renderMobileSlider === 'function') {
        renderMobileSlider();
      }
      if (typeof populateStateDropdown === 'function') {
        populateStateDropdown();
      }

      console.log('[Realtime] ✓ Categories updated. Count:', categories.length);
    }, (error) => {
      // Error callback — log but don't crash the app
      console.error('[Realtime] ✗ Categories listener error:', error.code, error.message);
    });

  console.log('[Realtime] ✅ Categories listener active.');
  return _unsubscribeCategoriesListener;
}

/**
 * Set up a real-time onSnapshot listener for the products collection.
 * - On initial snapshot: hydrates localStorage and renders the UI
 * - On subsequent changes: immediately updates localStorage and re-renders
 * - Handles empty collection by seeding defaults
 * - Also syncs all product action buttons to reflect price/category/stock changes
 * @returns {function|null} The unsubscribe function, or null if Firestore is unavailable
 */
function listenProductsRealtime() {
  if (!window.db) {
    console.warn('[Realtime] Firestore not connected. Cannot listen to products.');
    return null;
  }

  // Unsubscribe any previous listener to prevent duplicates
  if (_unsubscribeProductsListener) {
    _unsubscribeProductsListener();
    _unsubscribeProductsListener = null;
  }

  console.log('[Realtime] 📡 Setting up PRODUCTS real-time listener...');

  _unsubscribeProductsListener = window.db.collection('products')
    .orderBy('id', 'asc')
    .onSnapshot((snapshot) => {
      console.log('[Realtime] Products snapshot received. Size:', snapshot.size, 'Empty:', snapshot.empty);

      let products;

      if (snapshot.empty) {
        // Collection is empty — seed with defaults
        console.log('[Realtime] Products collection empty. Seeding DEFAULT_PRODUCTS to Firestore...');
        const batch = window.db.batch();
        DEFAULT_PRODUCTS.forEach(prod => {
          const ref = window.db.collection('products').doc(String(prod.id));
          batch.set(ref, prod);
        });
        batch.commit().then(() => {
          console.log('[Realtime] ✓ Default products seeded.');
        }).catch(err => {
          console.error('[Realtime] ✗ Failed to seed products:', err);
        });
        products = DEFAULT_PRODUCTS;
      } else {
        products = [];
        snapshot.forEach(doc => {
          products.push(doc.data());
        });
      }

      // Always update localStorage (single source of truth)
      localStorage.setItem('jcs_products', JSON.stringify(products));

      // Re-render all storefront UI that depends on products
      if (typeof renderProductsCatalog === 'function') {
        renderProductsCatalog();
      }
      if (typeof renderMobileSlider === 'function') {
        renderMobileSlider();
      }

      // Sync all product card action buttons (ADD/stepper) to reflect changes
      // like price updates, stock status changes, or new products appearing
      products.forEach(prod => {
        if (typeof syncProductAction === 'function') {
          syncProductAction(prod.id);
        }
      });

      console.log('[Realtime] ✓ Products updated. Count:', products.length);
    }, (error) => {
      // Error callback — log but don't crash the app
      console.error('[Realtime] ✗ Products listener error:', error.code, error.message);
    });

  console.log('[Realtime] ✅ Products listener active.');
  return _unsubscribeProductsListener;
}

/**
 * Set up a real-time onSnapshot listener for the banners collection.
 * - On initial snapshot: hydrates localStorage and re-initializes the carousel
 * - On subsequent changes: immediately updates banners and re-initializes carousel
 * - Handles empty collection by seeding defaults
 * @returns {function|null} The unsubscribe function, or null if Firestore is unavailable
 */
function listenBannersRealtime() {
  if (!window.db) {
    console.warn('[Realtime] Firestore not connected. Cannot listen to banners.');
    return null;
  }

  // Unsubscribe any previous listener to prevent duplicates
  if (_unsubscribeBannersListener) {
    _unsubscribeBannersListener();
    _unsubscribeBannersListener = null;
  }

  console.log('[Realtime] 📡 Setting up BANNERS real-time listener...');

  _unsubscribeBannersListener = window.db.collection('banners')
    .orderBy('order', 'asc')
    .onSnapshot((snapshot) => {
      console.log('[Realtime] Banners snapshot received. Size:', snapshot.size, 'Empty:', snapshot.empty);

      let banners;

      if (snapshot.empty) {
        // Collection is empty — seed with defaults
        console.log('[Realtime] Banners collection empty. Seeding DEFAULT_BANNERS to Firestore...');
        const batch = window.db.batch();
        DEFAULT_BANNERS.forEach((banner, i) => {
          const ref = window.db.collection('banners').doc(String(i));
          batch.set(ref, {
            order: i,
            tagline: banner.tagline,
            headingTitle: banner.headingTitle,
            description: banner.description,
            imageBase64: banner.imageBase64
          });
        });
        batch.commit().then(() => {
          console.log('[Realtime] ✓ Default banners seeded.');
        }).catch(err => {
          console.error('[Realtime] ✗ Failed to seed banners:', err);
        });
        banners = DEFAULT_BANNERS;
      } else {
        banners = [];
        snapshot.forEach(doc => {
          banners.push(doc.data());
        });
      }

      const normalized = normalizeBanners(banners);

      // Always update localStorage
      localStorage.setItem('bannersData', JSON.stringify(normalized));

      // Re-initialize the carousel with updated banners
      if (typeof initCarousel === 'function') {
        initCarousel();
      }

      console.log('[Realtime] ✓ Banners updated. Count:', normalized.length);
    }, (error) => {
      // Error callback — log but don't crash the app
      console.error('[Realtime] ✗ Banners listener error:', error.code, error.message);
    });

  console.log('[Realtime] ✅ Banners listener active.');
  return _unsubscribeBannersListener;
}

/**
 * Clean up all active real-time listeners.
 * Useful for SPA-style navigation or page unload scenarios.
 */
function unsubscribeAllRealtimeListeners() {
  if (_unsubscribeCategoriesListener) {
    _unsubscribeCategoriesListener();
    _unsubscribeCategoriesListener = null;
    console.log('[Realtime] Categories listener unsubscribed.');
  }
  if (_unsubscribeProductsListener) {
    _unsubscribeProductsListener();
    _unsubscribeProductsListener = null;
    console.log('[Realtime] Products listener unsubscribed.');
  }
  if (_unsubscribeBannersListener) {
    _unsubscribeBannersListener();
    _unsubscribeBannersListener = null;
    console.log('[Realtime] Banners listener unsubscribed.');
  }
}

// Expose listener functions globally for use in app.js (classic script pattern)
if (typeof window !== 'undefined') {
  window.listenCategoriesRealtime = listenCategoriesRealtime;
  window.listenProductsRealtime = listenProductsRealtime;
  window.listenBannersRealtime = listenBannersRealtime;
  window.unsubscribeAllRealtimeListeners = unsubscribeAllRealtimeListeners;
}
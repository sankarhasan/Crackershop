// KPR Crackers - Admin Control Panel Logic (admin.js)

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Escape HTML special characters to prevent XSS and rendering issues.
 * @param {string} str - The string to escape
 * @returns {string} - The escaped string
 */
function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&')
    .replace(/</g, '<')
    .replace(/>/g, '>')
    .replace(/"/g, '"')
    .replace(/'/g, '&#039;');
}

// Local state for delete confirmations
let deleteTargetType = null; // 'product' | 'category' | 'enquiry' | 'banner'
let deleteTargetId = null;

// Firestore-backed enquiries cache (populated by the realtime listener)
let firestoreEnquiries = [];

document.addEventListener('DOMContentLoaded', () => {
  initAdminAuth();
  
  // Navigation sidebar handler
  const sidebarLinks = document.querySelectorAll('.sidebar-link[data-section]');
  sidebarLinks.forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      const section = link.getAttribute('data-section');
      showDashboardSection(section);
    });
  });
  
  // Search and filter events for products
  const prodSearch = document.getElementById('admin-product-search');
  const prodFilterCat = document.getElementById('admin-product-filter-cat');
  if (prodSearch) prodSearch.addEventListener('input', renderProductsTable);
  if (prodFilterCat) prodFilterCat.addEventListener('change', renderProductsTable);
  
  // Filter events for enquiries
  const enquiryFilterStatus = document.getElementById('admin-enquiry-filter-status');
  if (enquiryFilterStatus) enquiryFilterStatus.addEventListener('change', renderEnquiriesTable);
  
  // Forms submit handlers
  const prodForm = document.getElementById('product-form');
  if (prodForm) {
    prodForm.addEventListener('submit', (e) => {
      e.preventDefault();
      saveProductData();
    });
  }
  
  const catForm = document.getElementById('category-form');
  if (catForm) {
    catForm.addEventListener('submit', (e) => {
      e.preventDefault();
      saveCategoryData();
    });
    
    // Auto generate slug as user types category name
    const catNameInput = document.getElementById('category-modal-name');
    catNameInput.addEventListener('input', () => {
      const slugInput = document.getElementById('category-modal-slug');
      slugInput.value = slugify(catNameInput.value);
    });
  }
  
  // Confirm delete button click event
  const confirmDelBtn = document.getElementById('delete-confirm-btn');
  if (confirmDelBtn) {
    confirmDelBtn.addEventListener('click', executePendingDelete);
  }
  
  // Image URL input changes to update preview
  const imgUrlInput = document.getElementById('product-modal-image-url');
  if (imgUrlInput) {
    imgUrlInput.addEventListener('input', () => {
      const url = imgUrlInput.value.trim();
      updateImagePreview(url);
    });
  }
  
  // Image file input changes to update preview
  const imgFileInput = document.getElementById('product-modal-image-file');
  if (imgFileInput) {
    imgFileInput.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (file) {
        // Read file as Data URL (base64)
        const reader = new FileReader();
        reader.onload = (event) => {
          updateImagePreview(event.target.result);
        };
        reader.readAsDataURL(file);
      }
    });
  }
  
  // Category image upload -> preview (base64) + dimension reading & validation
  const catFileInput = document.getElementById('categoryImageFile');
  
  if (catFileInput) {
    catFileInput.addEventListener('change', (e) => {
      const file = e.target.files && e.target.files[0] ? e.target.files[0] : null;
      if (!file) {
        setCategoryImagePreview('');
        resetCategoryImageDimensionInfo();
        return;
      }
      
      // Read file as data URL for preview
      const reader = new FileReader();
      reader.onload = (event) => {
        const dataUrl = event.target.result;
        setCategoryImagePreview(dataUrl);
        
        // Read image dimensions from the selected file
        readImageDimensions(file, (width, height) => {
          updateCategoryImageDimensionInfo(width, height);
          validateCategoryImageDimensions(width, height);
        });
      };
      reader.readAsDataURL(file);
    });
  }
  
  // If there is already a value in the hidden legacy field (should not happen often), reflect it.
  const legacyCatImg = document.getElementById('categoryImageUrl');
  if (legacyCatImg && legacyCatImg.value) {
    setCategoryImagePreview(legacyCatImg.value);
  }
  
  // Auto-calculate sale price from original price and discount label
  const origPriceInput = document.getElementById('product-modal-orig-price');
  const discountInput = document.getElementById('product-modal-discount');
  if (origPriceInput) origPriceInput.addEventListener('input', updateSalePriceFromDiscount);
  if (discountInput) discountInput.addEventListener('input', updateSalePriceFromDiscount);
});

/* ==========================================================================
   1. Authentication Gate (Firebase Auth: email + password)
   ========================================================================== */
function initAdminAuth() {
  if (typeof firebase === 'undefined' || !firebase.auth) {
    console.error('[Admin] Firebase Auth SDK not loaded.');
    showAdminToast('Authentication service unavailable.', 'error');
    return;
  }
  
  const auth = firebase.auth();
  window.adminAuth = auth;
  
  // Login form -> Firebase email/password sign-in
  const loginForm = document.getElementById('admin-login-form');
  if (loginForm) {
    loginForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const email = document.getElementById('login-email').value.trim();
      const pass = document.getElementById('login-password').value;
      const errorMsg = document.getElementById('login-error-msg');
      if (errorMsg) errorMsg.style.display = 'none';
      
      const btn = loginForm.querySelector('button[type="submit"]');
      const btnText = btn ? btn.innerText : '';
      if (btn) { btn.disabled = true; btn.innerText = 'Verifying...'; }
      
      auth.signInWithEmailAndPassword(email, pass)
        .then(() => {
          showAdminToast('Welcome back, Admin! 🔓', 'success');
        })
        .catch((err) => {
          console.error('[Admin] Login failed:', err);
          if (errorMsg) {
            errorMsg.innerText = '⚠️ ' + (err && err.message ? err.message : 'Invalid email or password!');
            errorMsg.style.display = 'block';
          }
          showAdminToast('Authentication failed. Check credentials.', 'error');
        })
        .finally(() => {
          if (btn) { btn.disabled = false; btn.innerText = btnText; }
        });
    });
  }
  
  // Observe auth state to toggle the login form vs. dashboard
  auth.onAuthStateChanged((user) => {
    const loginSection = document.getElementById('login-section');
    const dashboard = document.getElementById('admin-dashboard');
    
    if (user) {
      if (loginSection) loginSection.style.display = 'none';
      if (dashboard) dashboard.style.display = 'grid';
      onAdminAuthenticated();
    } else {
      if (loginSection) loginSection.style.display = 'flex';
      if (dashboard) dashboard.style.display = 'none';
    }
  });
}

// Runs once the admin is confirmed logged in.
function onAdminAuthenticated() {
  // Diagnostic: verify Firestore connection status
  console.log('[Firestore] Authenticated. window.db status:', window.db ? 'CONNECTED' : 'NULL');
  if (!window.db) {
    showAdminToast('Firestore not initialized. Check console for details.', 'error');
    console.error('[Firestore] window.db is null. Verify: 1) firebase-app-compat.js loaded, 2) firebase-firestore-compat.js loaded, 3) firebase-config.js has correct projectId "kpr-crackers"');
  }
  // Update global portal date
  const dateInfo = document.getElementById('current-date-info');
  if (dateInfo) {
    const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    dateInfo.innerText = new Date().toLocaleDateString('en-US', options);
  }
  
  // Seed initial admin drop-down select options
  populateCategoryDropdowns();
  
  // Hydrate products from Firestore into localStorage cache, then render
  loadProductsFromFirestore().then(() => {
    renderProductsTable();
  });
  
  // Hydrate banners from Firestore into localStorage cache
  loadBannersFromFirestore();
  
  // Hydrate categories from Firestore into localStorage cache, then refresh dropdowns
  loadCategoriesFromFirestore().then(() => {
    populateCategoryDropdowns();
    renderCategoriesTable();
  });
  
  // Start realtime Firestore enquiries stream (auto-refreshes tables + stats)
  listenToEnquiries();
  
  // ALSO do a one-time direct fetch as fallback (ensures data loads even if onSnapshot is slow)
  if (window.db) {
    console.log('[Admin] Doing direct fetch fallback for enquiries...');
    window.db.collection('enquiries')
      .orderBy('timestamp', 'desc')
      .get({ source: 'server' })
      .then((snapshot) => {
        console.log('[Admin] ✓ Direct fetch enquiries complete. Docs:', snapshot.docs.length);
        if (firestoreEnquiries.length === 0 && snapshot.docs.length > 0) {
          // Only update if onSnapshot hasn't already populated the data
          firestoreEnquiries = snapshot.docs.map((doc) => {
            const d = doc.data() || {};
            let dateStr;
            if (d.timestamp && typeof d.timestamp.toDate === 'function') {
              dateStr = d.timestamp.toDate().toISOString();
            } else {
              dateStr = d.date || new Date().toISOString();
            }
            const customer = d.customer || {};
            return {
              docId: doc.id,
              name: customer.name || d.name || '',
              phone: customer.phone || d.phone || '',
              deliveryAddress: customer.deliveryAddress || d.deliveryAddress || customer.address || '',
              pincode: customer.pincode || d.pincode || '',
              state: customer.state || d.state || '',
              category: customer.categoryInterest || d.category || '',
              message: d.message || d.enquiryMessage || '',
              enquiryMessage: d.enquiryMessage || d.message || '',
              status: d.status || 'new',
              date: dateStr,
              cartItems: d.cartItems || null,
              financialBreakdown: d.financialBreakdown || null
            };
          });
          updateDashboardStats();
          renderEnquiriesTable();
          console.log('[Admin] ✓ Fallback enquiries data applied. Count:', firestoreEnquiries.length);
        }
      })
      .catch((err) => {
        console.error('[Admin] ✗ Direct fetch enquiries failed:', err);
      });
  }
  
  // Purge orphaned numeric product documents & sanitize Firestore data on startup
  purgeOrphanedNumericProductDocuments();
  
  // Run Firestore data sanitization to fix field mismatches
  if (window.db) {
    sanitizeFirestoreCategories().then(() => {
      sanitizeFirestoreProducts();
    });
  }
  
  // Refresh stats and show main dashboard
  updateDashboardStats();
  showDashboardSection('dashboard');
}

function logoutAdmin() {
  if (window.adminAuth) {
    window.adminAuth.signOut()
      .then(() => showAdminToast('Logged out securely.', 'info'))
      .catch((err) => {
        console.error('[Admin] Logout failed:', err);
        showAdminToast('Could not log out. Please try again.', 'error');
      });
  }
}

/* ==========================================================================
   CATEGORIES TABLE RENDERING
   ========================================================================== */
function renderCategoriesTable() {
  const tbody = document.getElementById('categories-table-body');
  if (!tbody) return;
  
  const categories = getCategories();
  
  tbody.innerHTML = '';
  
  if (categories.length === 0) {
    tbody.innerHTML = '<tr><td colspan="5" class="text-center">No categories found.</td></tr>';
    return;
  }
  
  // Calculate bgIndex using category letter position
  const emojiMap = { 'A': '🌀', 'B': '🌋', 'C': '⛲', 'D': '✏️', 'E': '✨', 'F': '💣', 'G': '🚀', 'H': '⚡', 'I': '🎁', 'J': '🌀', 'K': '🌋', 'L': '⛲' };
  
  categories.forEach(cat => {
    const catLetter = String(cat.id).toUpperCase();
    const bgIndex = (catLetter.charCodeAt(0) - 64) % 9 + 1;
    const emoji = emojiMap[catLetter] || '🎆';
    
    let imageCellContent = `<div class="prod-placeholder-cell p-bg-${bgIndex}">${emoji}</div>`;
    const imageUrl = cat.categoryImageUrl || cat.image;
    if (imageUrl) {
      imageCellContent = `<img src="${imageUrl}" class="admin-prod-thumb" alt="${cat.name}" style="width: 40px; height: 40px; object-fit: cover; border-radius: var(--radius-sm); border: 1px solid var(--admin-border);">`;
    }
    
    tbody.innerHTML += `
      <tr>
        <td>#${escapeHtml(cat.id)}</td>
        <td>${imageCellContent}</td>
        <td><strong>${escapeHtml(cat.name)}</strong></td>
        <td><code>${escapeHtml(cat.slug)}</code></td>
        <td>
          <div class="table-actions">
            <button class="btn-action edit" onclick="openCategoryEditModal('${cat.id}')" title="Edit Category">✏️</button>
            <button class="btn-action delete" onclick="confirmDelete('category', '${cat.id}')" title="Delete Category">🗑️</button>
          </div>
        </td>
      </tr>
    `;
  });
}

/* ==========================================================================
   ENQUIRIES TABLE RENDERING
   ========================================================================== */
function renderEnquiriesTable() {
  const tbody = document.getElementById('enquiries-table-body');
  if (!tbody) return;
  
  const enquiries = firestoreEnquiries;
  const statusFilter = document.getElementById('admin-enquiry-filter-status')?.value || 'all';
  
  // Apply status filter if not "all"
  let filtered = enquiries;
  if (statusFilter !== 'all') {
    filtered = enquiries.filter(e => e.status === statusFilter);
  }
  
  tbody.innerHTML = '';
  
  if (filtered.length === 0) {
    tbody.innerHTML = '<tr><td colspan="8" class="text-center">No enquiries found.</td></tr>';
    return;
  }
  
  const categories = getCategories();
  
  filtered.forEach(enq => {
    // Format date
    const formattedDate = new Date(enq.date).toLocaleDateString('en-IN', {
      day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit'
    });
    
    // Get category name
    let catName = 'N/A';
    if (enq.category === 'all') {
      catName = 'Complete Combo Box';
    } else {
      const match = categories.find(c => c.slug === enq.category);
      catName = match ? match.name : enq.category;
    }
    
    // Get order total from financialBreakdown or calculate from cartItems
    let orderTotal = '—';
    if (enq.financialBreakdown && typeof enq.financialBreakdown.grandTotal === 'number') {
      orderTotal = `₹${enq.financialBreakdown.grandTotal.toLocaleString('en-IN')}`;
    } else if (enq.cartItems && enq.cartItems.length > 0) {
      const total = enq.cartItems.reduce((sum, item) => sum + (item.totalPrice || 0), 0);
      orderTotal = `₹${total.toLocaleString('en-IN')}`;
    }
    
    tbody.innerHTML += `
      <tr>
        <td>#${escapeHtml((enq.docId || '').substring(0, 6))}</td>
        <td>${formattedDate}</td>
        <td>
          <strong>${escapeHtml(enq.name || '')}</strong><br>
          <small>${escapeHtml(enq.phone || '')}</small>
        </td>
        <td>${escapeHtml(enq.pincode || '')}</td>
        <td>${escapeHtml(enq.enquiryMessage || enq.message || '')}</td>
        <td>${orderTotal}</td>
        <td><span class="status-badge ${enq.status}">${escapeHtml(enq.status)}</span></td>
        <td>
          <div class="table-actions">
            <button class="btn-action edit" onclick="openEnquiryViewModal('${enq.docId}')" title="View Details">👁️</button>
            <button class="btn-action delete" onclick="confirmDelete('enquiry', '${enq.docId}')" title="Delete Enquiry">🗑️</button>
          </div>
        </td>
      </tr>
    `;
  });
}

/* ==========================================================================
   1b. Realtime Enquiries stream from Firestore
   ========================================================================== */
function listenToEnquiries() {
  if (!window.db) {
    console.error('[Admin] Firestore not available for enquiries.');
    return;
  }
  
  console.log('[Admin] Starting enquiries real-time listener...');
  
  window.db.collection('enquiries')
    .orderBy('timestamp', 'desc')
    .onSnapshot((snapshot) => {
      console.log('[Admin] ✓ Enquiries onSnapshot fired. Docs count:', snapshot.docs.length);
      
      firestoreEnquiries = snapshot.docs.map((doc) => {
        const d = doc.data() || {};
        let dateStr;
        if (d.timestamp && typeof d.timestamp.toDate === 'function') {
          dateStr = d.timestamp.toDate().toISOString();
        } else {
          dateStr = d.date || new Date().toISOString();
        }
        // Support BOTH old flat format and new structured format
        const customer = d.customer || {};
        return {
          docId: doc.id,
          name: customer.name || d.name || '',
          phone: customer.phone || d.phone || '',
          deliveryAddress: customer.deliveryAddress || d.deliveryAddress || customer.address || '',
          pincode: customer.pincode || d.pincode || '',
          state: customer.state || d.state || '',
          category: customer.categoryInterest || d.category || '',
          message: d.message || d.enquiryMessage || '',
          enquiryMessage: d.enquiryMessage || d.message || '',
          status: d.status || 'new',
          date: dateStr,
          // New structured data (if present)
          cartItems: d.cartItems || null,
          financialBreakdown: d.financialBreakdown || null
        };
      });
      
      console.log('[Admin] ✓ firestoreEnquiries updated. Count:', firestoreEnquiries.length);
      
      // Refresh any views that depend on enquiries
      updateDashboardStats();
      renderEnquiriesTable();
    }, (err) => {
      console.error('[Admin] ✗ Failed to load enquiries from Firestore:', err);
      console.error('[Admin] Error code:', err.code, 'Message:', err.message);
      showAdminToast('Could not load enquiries from cloud: ' + (err.message || 'Unknown error'), 'error');
    });
}

/* ==========================================================================
   2. Workspace Dashboard Section Switching
   ========================================================================== */
function showDashboardSection(sectionName) {
  // Hide all sections
  document.querySelectorAll('.dashboard-section').forEach(sec => {
    sec.style.display = 'none';
  });
  
  // Remove active sidebar link style
  document.querySelectorAll('.sidebar-link').forEach(link => {
    link.classList.remove('active');
  });
  
  // Display target section
  const target = document.getElementById(`section-${sectionName}`);
  if (target) target.style.display = 'block';
  
  // Set active link style
  const activeLink = document.querySelector(`.sidebar-link[data-section="${sectionName}"]`);
  if (activeLink) activeLink.classList.add('active');
  
  // Set current title
  const title = document.getElementById('current-section-title');
  if (title) {
    const titles = {
      'dashboard': 'Dashboard Statistics',
      'products': 'Manage Firecrackers Inventory',
      'categories': 'Manage Catalog Categories',
      'enquiries': 'Customer Enquiries Portal',
      'banners': 'Manage Homepage Banners',
      'offers': 'Manage Festival Offer Banner',
      'coupons': 'Manage Coupon Codes',
      'state-rules': 'Manage State Minimum Order Rules'
    };
    title.innerText = titles[sectionName] || 'Administration';
  }
  
  // Refresh section data
  if (sectionName === 'dashboard') {
    updateDashboardStats();
  } else if (sectionName === 'products') {
    renderProductsTable();
  } else if (sectionName === 'categories') {
    renderCategoriesTable();
  } else if (sectionName === 'enquiries') {
    renderEnquiriesTable();
  } else if (sectionName === 'banners') {
    renderBannersTable();
  } else if (sectionName === 'offers') {
    loadOfferForm();
  } else if (sectionName === 'coupons') {
    loadCouponsFromFirestore().then(coupons => {
      adminCoupons = coupons;
      renderCouponsTable();
    });
  } else if (sectionName === 'state-rules') {
    loadStateRules();
  }
}


function showDashboardSectionDirect(sectionName) {
  showDashboardSection(sectionName);
}

/* ==========================================================================
   3. Statistics Calculation & Mini-Tables
   ========================================================================== */
function updateDashboardStats() {
  const products = getProducts();
  const categories = getCategories();
  const enquiries = firestoreEnquiries;
  
  // Count stats
  const totalProducts = products.length;
  const totalCategories = categories.length;
  const newEnquiriesCount = enquiries.filter(e => e.status === 'new').length;
  
  // Sum up estimated revenue pool — prefer structured financialBreakdown, fallback to message parsing
  let revenuePoolVal = 0;
  enquiries.forEach(enq => {
    // New structured format: use grandTotal from financialBreakdown
    if (enq.financialBreakdown && enq.financialBreakdown.grandTotal) {
      revenuePoolVal += enq.financialBreakdown.grandTotal;
    }
    // Fallback: parse from message string "Total Est: ₹XXXX"
    else if (enq.message && enq.message.includes('Total Est: ₹')) {
      const parts = enq.message.split('Total Est: ₹');
      if (parts.length > 1) {
        const val = parseInt(parts[1].replace(/,/g, ''));
        if (!isNaN(val)) revenuePoolVal += val;
      }
    }
  });
  
  // Set DOM text
  document.getElementById('stat-products-count').innerText = totalProducts;
  document.getElementById('stat-categories-count').innerText = totalCategories;
  document.getElementById('stat-enquiries-count').innerText = newEnquiriesCount;
  document.getElementById('stat-revenue-pool').innerText = `₹${revenuePoolVal.toLocaleString('en-IN')}`;
  
  // Sidebar notification badge
  const sidebarBadge = document.getElementById('enquiry-badge-count');
  if (sidebarBadge) {
    sidebarBadge.innerText = newEnquiriesCount;
    sidebarBadge.style.display = newEnquiriesCount > 0 ? 'inline-block' : 'none';
  }
  
  renderRecentEnquiriesMiniTable();
}

function renderRecentEnquiriesMiniTable() {
  const tbody = document.getElementById('recent-enquiries-tbody');
  if (!tbody) return;
  
  const enquiries = firestoreEnquiries;
  const categories = getCategories();
  
  // Sort by date descending
  const sorted = [...enquiries].sort((a, b) => new Date(b.date) - new Date(a.date));
  const recent = sorted.slice(0, 5);
  
  tbody.innerHTML = '';
  
  if (recent.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6" class="text-center">No enquiries received yet.</td></tr>';
    return;
  }
  
  recent.forEach(enq => {
    const formattedDate = new Date(enq.date).toLocaleDateString('en-IN', {
      day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit'
    });
    
    let catName = 'N/A';
    if (enq.category === 'all') {
      catName = 'Complete Combo Box';
    } else {
      const match = categories.find(c => c.slug === enq.category);
      catName = match ? match.name : enq.category;
    }
    
    tbody.innerHTML += `
      <tr>
        <td>#${(enq.docId || '').substring(0, 6)}</td>
        <td><strong>${escapeHtml(enq.name)}</strong></td>
        <td><a href="https://wa.me/91${enq.phone}" target="_blank" style="color:var(--admin-info)">📞 ${escapeHtml(enq.phone)}</a></td>
        <td>${catName}</td>
        <td>${formattedDate}</td>
        <td><span class="status-badge ${enq.status}">${enq.status}</span></td>
      </tr>
    `;
  });
}

/* ==========================================================================
   4. Products Inventory CRUD Manager
   ========================================================================== */
function parseDiscountPercent(label) {
  const match = String(label).match(/(\d+(?:\.\d+)?)/);
  return match ? Math.min(100, Math.max(0, parseFloat(match[1]))) : 0;
}

function calculateSalePrice(originalPrice, discountPercent) {
  if (!originalPrice || originalPrice <= 0) return 0;
  const pct = Math.min(100, Math.max(0, discountPercent));
  return Math.round(originalPrice * (1 - pct / 100));
}

function updateSalePriceFromDiscount() {
  const origPriceInput = document.getElementById('product-modal-orig-price');
  const discountInput = document.getElementById('product-modal-discount');
  const salePriceInput = document.getElementById('product-modal-price');
  if (!origPriceInput || !discountInput || !salePriceInput) return;
  
  const originalPrice = parseFloat(origPriceInput.value) || 0;
  const discountRaw = discountInput.value.trim();
  
  // If discount is empty, no discount - sale price equals original price
  if (discountRaw === '') {
    salePriceInput.value = originalPrice > 0 ? originalPrice : '';
    return;
  }
  
  const discountPercent = parseDiscountPercent(discountRaw);
  const salePrice = calculateSalePrice(originalPrice, discountPercent);
  
  salePriceInput.value = salePrice > 0 ? salePrice : '';
}

function renderProductsTable() {
  const tbody = document.getElementById('products-table-body');
  if (!tbody) return;
  
  const products = getProducts();
  const categories = getCategories();
  const searchVal = document.getElementById('admin-product-search')?.value.toLowerCase() || '';
  const filterCat = document.getElementById('admin-product-filter-cat')?.value || 'all';
  
  tbody.innerHTML = '';
  
  let filtered = products;
  
  // Category dropdown filter check - use string matching
  if (filterCat !== 'all') {
    filtered = filtered.filter(p => String(p.categoryId).toUpperCase() === String(filterCat).toUpperCase());
  }
  
  // Search text filter check
  if (searchVal.trim() !== '') {
    filtered = filtered.filter(p => p.name.toLowerCase().includes(searchVal));
  }
  
  if (filtered.length === 0) {
    tbody.innerHTML = '<tr><td colspan="9" class="text-center">No inventory matching criteria found.</td></tr>';
    return;
  }
  
  // Pre-calculate product indices for each category
  const productIndicesByCategory = {};
  categories.forEach((cat, catIndex) => {
    const catProducts = products.filter(p => String(p.categoryId).toUpperCase() === String(cat.id).toUpperCase())
      .sort((a, b) => {
        const idA = String(a.id).toUpperCase();
        const idB = String(b.id).toUpperCase();
        return idA.localeCompare(idB);
      });
    catProducts.forEach((p, idx) => {
      productIndicesByCategory[p.id] = { index: idx + 1, catIndex: catIndex };
    });
  });
  
  filtered.forEach(p => {
    // Use string matching for category lookup
    const cat = categories.find(c => String(c.id).toUpperCase() === String(p.categoryId).toUpperCase());
    const catName = cat ? cat.name : 'Unknown';
    
    // Calculate bgIndex using category letter position
    const catLetter = String(p.categoryId).toUpperCase();
    const bgIndex = (catLetter.charCodeAt(0) - 64) % 9 + 1; // A=1, B=2, etc.
    const emojiMap = { 1: '🌀', 2: '🌋', 3: '⛲', 4: '✏️', 5: '✨', 6: '💣', 7: '🚀', 8: '⚡', 9: '🎁', 10: '🌀', 11: '🌋', 12: '⛲' };
    const emoji = emojiMap[bgIndex] || '🎆';
    
    // Get alphanumeric product code - use product.id directly since it's now "A1", "B2", etc.
    const productCode = `#${p.id}`;
    
    let imageCellContent = `<div class="prod-placeholder-cell p-bg-${bgIndex}">${emoji}</div>`;
    if (p.image) {
      imageCellContent = `<img src="${p.image}" class="admin-prod-thumb" alt="${p.name}" style="width: 40px; height: 40px; object-fit: cover; border-radius: var(--radius-sm); border: 1px solid var(--admin-border);">`;
    }
    
    tbody.innerHTML += `
      <tr>
        <td>${productCode}</td>
        <td>
          ${imageCellContent}
        </td>
        <td><strong>${escapeHtml(p.name)}</strong></td>
        <td>${catName}</td>
        <td>₹${p.price}</td>
        <td><span style="text-decoration:line-through;color:var(--admin-text-muted)">₹${p.originalPrice}</span></td>
        <td>
          <span class="stock-status ${p.inStock ? 'in' : 'out'}">${p.inStock ? 'In Stock' : 'Out of Stock'}</span>
        </td>
        <td>${p.qty}</td>
        <td>
          <div class="table-actions">
            <button class="btn-action edit" onclick="openProductEditModal('${p.id}')" title="Edit Product">✏️</button>
            <button class="btn-action delete" onclick="confirmDelete('product', '${p.id}')" title="Delete Product">🗑️</button>
          </div>
        </td>
      </tr>
    `;
  });
}

function populateCategoryDropdowns() {
  const categories = getCategories();
  const filterDropdown = document.getElementById('admin-product-filter-cat');
  const modalDropdown = document.getElementById('product-modal-cat');
  
  if (filterDropdown) {
    filterDropdown.innerHTML = '<option value="all">All Categories</option>';
    categories.forEach(cat => {
      filterDropdown.innerHTML += `<option value="${cat.id}">${cat.name}</option>`;
    });
  }
  
  if (modalDropdown) {
    modalDropdown.innerHTML = '<option value="" disabled selected>Select category...</option>';
    categories.forEach(cat => {
      modalDropdown.innerHTML += `<option value="${cat.id}">${cat.name}</option>`;
    });
  }
}

function openProductAddModal() {
  document.getElementById('product-modal-title').innerText = 'Add Firecracker Details';
  document.getElementById('product-form').reset();
  document.getElementById('product-modal-id').value = '';
  
  // Reset image preview state
  updateImagePreview('');
  // Set default radio selection to url
  document.querySelector('input[name="image-source"][value="url"]').checked = true;
  toggleImageSourceInput('url');
  
  document.getElementById('product-modal').style.display = 'flex';
}

function openProductEditModal(id) {
  const products = getProducts();
  const p = products.find(prod => String(prod.id) === String(id));
  if (!p) return;
  
  document.getElementById('product-modal-title').innerText = 'Edit Firecracker Details';
  document.getElementById('product-modal-id').value = p.id;
  document.getElementById('product-modal-name').value = p.name;
  document.getElementById('product-modal-cat').value = p.categoryId;
  document.getElementById('product-modal-qty').value = p.qty;
  document.getElementById('product-modal-orig-price').value = p.originalPrice;
  document.getElementById('product-modal-discount').value = p.discount || '';
  updateSalePriceFromDiscount();
  document.getElementById('product-modal-desc').value = p.description;
  document.getElementById('product-modal-stock').checked = p.inStock;
  
  // Set image state
  if (p.image) {
    if (p.image.startsWith('data:')) {
      // It's a file upload base64
      document.querySelector('input[name="image-source"][value="file"]').checked = true;
      toggleImageSourceInput('file');
      // Set preview directly
      updateImagePreview(p.image);
    } else {
      // It's a URL
      document.querySelector('input[name="image-source"][value="url"]').checked = true;
      document.getElementById('product-modal-image-url').value = p.image;
      toggleImageSourceInput('url');
    }
  } else {
    document.querySelector('input[name="image-source"][value="url"]').checked = true;
    document.getElementById('product-modal-image-url').value = '';
    toggleImageSourceInput('url');
    updateImagePreview('');
  }
  
  document.getElementById('product-modal').style.display = 'flex';
}

function closeProductModal() {
  document.getElementById('product-modal').style.display = 'none';
}

function saveProductData() {
  updateSalePriceFromDiscount();
  
  const idVal = document.getElementById('product-modal-id').value;
  const name = document.getElementById('product-modal-name').value;
  const categoryIdInput = document.getElementById('product-modal-cat').value;
  const qty = document.getElementById('product-modal-qty').value;
  const originalPrice = parseInt(document.getElementById('product-modal-orig-price').value);
  const discountRaw = document.getElementById('product-modal-discount').value.trim();
  
  // Convert categoryId to letter string for consistency
  const categoryId = getCategoryLetterFromId(categoryIdInput);
  
  // If discount is empty, no discount - sale price equals original price and discount field is empty string
  let price, discount;
  if (discountRaw === '') {
    // No discount - sale price equals original price
    price = originalPrice;
    discount = '';
  } else {
    // Has discount - calculate sale price
    const discountPct = parseDiscountPercent(discountRaw);
    price = calculateSalePrice(originalPrice, discountPct);
    discount = discountPct > 0 ? `${Math.round(discountPct)}% OFF` : '';
  }
  const description = document.getElementById('product-modal-desc').value;
  const inStock = document.getElementById('product-modal-stock').checked;
  
  // Get image value from preview src (which holds either URL or base64 data)
  const previewImg = document.getElementById('product-modal-image-preview');
  const image = previewImg.style.display === 'block' ? previewImg.src : '';
  
  const products = getProducts();
  
  // Track original category for change detection (EDIT MODE fix)
  let originalCategoryId = null;
  let originalProductId = null;
  
  if (idVal === '') {
    // Add Mode - Generate alphanumeric ID based on category and position
    const catIndex = getCategoryIndex(categoryId);
    const catProducts = products.filter(p => String(p.categoryId).toUpperCase() === String(categoryId).toUpperCase());
    const newIndexWithinCategory = catProducts.length + 1;
    const newId = getProductCode(categoryId, newIndexWithinCategory);
    
    const newProduct = {
      id: newId,
      name,
      categoryId, // Already a letter string like "A", "B"
      price,
      originalPrice,
      discount,
      qty,
      description,
      inStock,
      image
    };
    products.push(newProduct);
  } else {
    // Edit Mode - capture original values BEFORE update
    const existingProduct = products.find(p => String(p.id) === String(idVal));
    if (existingProduct) {
      originalCategoryId = existingProduct.categoryId;
      originalProductId = existingProduct.id;
    }
    
    const pIndex = products.findIndex(prod => String(prod.id) === String(idVal));
    if (pIndex !== -1) {
      products[pIndex] = {
        id: idVal,
        name,
        categoryId, // Already a letter string like "A", "B"
        price,
        originalPrice,
        discount,
        qty,
        description,
        inStock,
        image
      };
    }
  }
  
  // Show a single clean success toast
  showAdminToast('Product saved successfully!', 'success');
  
  saveProducts(products);
  
  // Sync to Firestore (async) with visible error feedback
  const productToSync = idVal === '' ? products[products.length - 1] : products.find(p => String(p.id) === String(idVal));
  
  if (!window.db) {
    console.error('[Firestore] window.db is NULL — Firebase not initialized. Check that firebase-config.js loaded correctly.');
    showAdminToast('Firestore not connected. Data saved locally only.', 'error');
  } else if (productToSync) {
    // CRITICAL FIX: Check if category has changed during edit
    const categoryChanged = originalCategoryId !== null && String(originalCategoryId).toUpperCase() !== String(categoryId).toUpperCase();
    
    if (categoryChanged) {
      // Category CHANGED: Need to DELETE old document and CREATE new one
      console.log('[Firestore] Category changed. Moving product from cat', originalCategoryId, 'to cat', categoryId);
      
      handleCategoryChangeFirestore(originalProductId, productToSync)
        .then(() => {
          console.log('[Firestore] Product moved to new category successfully.');
          // Re-render products table after Firestore sync
          loadProductsFromFirestore().then(() => {
            renderProductsTable();
          });
        })
        .catch(err => {
          const code = err.code || 'unknown';
          const msg = err.message || 'Unknown error';
          console.error('[Firestore] Category change/move FAILED. Code:', code, 'Message:', msg, err);
          showAdminToast('Firestore move failed [' + code + ']: ' + msg, 'error');
          // Still re-render to show local state
          renderProductsTable();
        });
    } else {
      // Category UNCHANGED: Simple update
      saveProductToFirestore(productToSync)
        .then(() => {
          console.log('[Firestore] Product synced successfully:', productToSync.name);
        })
        .catch(err => {
          const code = err.code || 'unknown';
          const msg = err.message || 'Unknown error';
          console.error('[Firestore] Product sync FAILED. Code:', code, 'Message:', msg, err);
          showAdminToast('Firestore error [' + code + ']: ' + msg, 'error');
        });
    }
  }
  
  closeProductModal();
  renderProductsTable();
}

/**
 * Handle moving a product to a new category in Firestore.
 * Deletes the old document at the original category's ID location and creates a new one.
 * @param {string|number} oldProductId - The original product ID
 * @param {Object} updatedProduct - The product with updated data
 */
async function handleCategoryChangeFirestore(oldProductId, updatedProduct) {
  if (!window.db) {
    throw new Error('Firestore not connected');
  }
  
  const oldDocId = String(oldProductId);
  
  // Fetch current Firestore products to determine the new index
  const snapshot = await window.db.collection('products').get();
  const firestoreProducts = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  
  // Find products in the NEW category to calculate the correct index
  // Support both numeric and string categoryIds
  const productsInNewCategory = firestoreProducts.filter(p => 
    String(p.categoryId).toUpperCase() === String(updatedProduct.categoryId).toUpperCase()
  );
  const sortedNewCatProducts = productsInNewCategory
    .filter(p => p.id !== oldDocId) // Exclude the old product if it's already there
    .sort((a, b) => {
      // Sort by alphanumeric ID
      const idA = String(a.id).toUpperCase();
      const idB = String(b.id).toUpperCase();
      return idA.localeCompare(idB);
    });
  
  // Calculate the new product index within the category
  const newIndexWithinCategory = sortedNewCatProducts.length + 1;
  
  // Generate the alphanumeric code for the new category
  const newId = getProductCode(updatedProduct.categoryId, newIndexWithinCategory);
  
  // Update product object with correct IDs
  updatedProduct.id = newId;
  
  // Delete the old document
  await window.db.collection('products').doc(oldDocId).delete();
  console.log('[Firestore] Old product document deleted:', oldDocId);
  
  // Save the new document
  await window.db.collection('products').doc(String(newId)).set(updatedProduct);
  console.log('[Firestore] New product document created:', String(newId));
  
  // Update localStorage cache
  const cached = getProducts();
  const filtered = cached.filter(p => String(p.id) !== String(oldProductId));
  filtered.push(updatedProduct);
  localStorage.setItem('jcs_products', JSON.stringify(filtered));
}

/**
 * Purge orphaned numeric document entries from Firestore products collection.
 * These are legacy documents with numeric IDs that need to be converted.
 */
async function purgeOrphanedNumericProductDocuments() {
  if (!window.db) {
    console.warn('[Admin] Firestore not connected. Skipping orphan purge.');
    return;
  }
  
  try {
    const snapshot = await window.db.collection('products').get();
    const categories = getCategories();
    const validCategoryLetters = categories.map(c => String(c.id).toUpperCase());
    const migratedProducts = [];
    
    snapshot.forEach(doc => {
      const data = doc.data();
      const docId = doc.id;
      
      // Check if document ID is numeric (legacy format like "101", "301", etc.)
      if (/^\d+$/.test(docId)) {
        // Convert numeric ID to alphanumeric format
        const numId = parseInt(docId, 10);
        const catIndex = Math.floor(numId / 100) - 1; // 101 -> 0 (Ground Chakkars/A)
        if (catIndex >= 0 && catIndex < validCategoryLetters.length) {
          const catLetter = validCategoryLetters[catIndex];
          const prodIndex = (numId % 100) || 1; // 101 % 100 = 1, use 1 if 0
          
          // Prepare updated product with correct IDs
          migratedProducts.push({
            ref: doc.ref,
            updates: {
              id: `${catLetter}${prodIndex}`,
              categoryId: catLetter
            }
          });
          console.log('[Admin] Found legacy product doc to migrate:', docId, '->', `${catLetter}${prodIndex}`);
        }
      }
    });
    
    // Update migrated documents
    if (migratedProducts.length > 0) {
      const batch = window.db.batch();
      migratedProducts.forEach(({ ref, updates }) => {
        batch.update(ref, updates);
      });
      await batch.commit();
      console.log('[Admin] Migrated', migratedProducts.length, 'product documents to new ID format.');
      showAdminToast(`Migrated ${migratedProducts.length} product document(s) to new ID format.`, 'info');
      
      // Refresh the product list
      await loadProductsFromFirestore();
    }
  } catch (err) {
    console.error('[Admin] Failed to migrate legacy documents:', err);
  }
}

/* ==========================================================================
   5. Categories CRUD Manager (modals + save)
   NOTE: Category IDs are letter strings ("A", "B", ...). All lookups use
   String comparison to stay compatible with the alphanumeric ID scheme.
   ========================================================================== */
function openCategoryAddModal() {
  document.getElementById('category-modal-title').innerText = 'Add Category';
  document.getElementById('category-form').reset();
  document.getElementById('category-modal-id').value = '';
  // Reset image preview to placeholder state
  setCategoryImagePreview('');
  resetCategoryImageDimensionInfo();
  document.getElementById('category-modal').style.display = 'flex';
}

function openCategoryEditModal(id) {
  const categories = getCategories();
  const cat = categories.find(c => String(c.id) === String(id));
  if (!cat) return;

  document.getElementById('category-modal-title').innerText = 'Edit Category Name';
  document.getElementById('category-modal-id').value = cat.id;
  document.getElementById('category-modal-name').value = cat.name;
  document.getElementById('category-modal-slug').value = cat.slug;

  // Backward compatible read: new field categoryImageUrl, old field image
  const imgVal = (cat.categoryImageUrl ?? cat.image ?? '').toString();

  const hiddenInput = document.getElementById('categoryImageUrl');
  if (hiddenInput) hiddenInput.value = imgVal;

  setCategoryImagePreview(imgVal);

  // Reset file input so choosing a new file is required to update.
  const fileInput = document.getElementById('categoryImageFile');
  if (fileInput) fileInput.value = '';

  document.getElementById('category-modal').style.display = 'flex';
}

function closeCategoryModal() {
  document.getElementById('category-modal').style.display = 'none';
}

function saveCategoryData() {
  const idVal = document.getElementById('category-modal-id').value;

  const name = document.getElementById('category-modal-name').value;
  const slug = document.getElementById('category-modal-slug').value;

  // Hidden field is updated when a new file is selected; preserved on edit.
  let selectedImg = document.getElementById('categoryImageUrl')?.value?.trim() || '';

  const categories = getCategories();

  if (idVal === '') {
    // Add Mode - generate the next letter code (A, B, C, ...) for consistency
    const newId = getCategoryCode(categories.length);
    const newCat = {
      id: newId,
      name,
      slug,
      categoryImageUrl: selectedImg,
      image: selectedImg // legacy field
    };
    categories.push(newCat);
  } else {
    // Edit Mode
    const index = categories.findIndex(c => String(c.id) === String(idVal));
    if (index !== -1) {
      categories[index].name = name;
      categories[index].slug = slug;
      categories[index].categoryImageUrl = selectedImg;
      categories[index].image = selectedImg; // legacy field
    }
  }

  saveCategories(categories);
  console.log('[Category Save] localStorage updated. Categories count:', categories.length);

  showAdminToast('Category saved successfully!', 'success');

  // Async Firestore sync (fire-and-forget, error only shown if sync fails)
  const categoryToSync = idVal === ''
    ? categories[categories.length - 1]
    : categories.find(c => String(c.id) === String(idVal));

  if (window.db && categoryToSync) {
    console.log('[Category Save] Attempting Firestore write for category ID:', categoryToSync.id);
    try {
      saveCategoryToFirestore(categoryToSync)
        .then(() => {
          console.log('[Firestore] ✓ Category synced successfully:', categoryToSync.name);
        })
        .catch(err => {
          const code = err.code || 'unknown';
          const msg = err.message || 'Unknown error';
          console.error('[Firestore] ✗ Category sync FAILED. Code:', code, 'Message:', msg, err);
          showAdminToast('Firestore category error [' + code + ']: ' + msg, 'error');
        });
    } catch (syncError) {
      console.error('[Category Save] Exception during saveCategoryToFirestore():', syncError);
      showAdminToast('Sync error: ' + (syncError.message || 'Unknown'), 'error');
    }
  } else if (!window.db) {
    console.error('[Firestore] window.db is NULL — cannot sync categories.');
  }

  closeCategoryModal();
  populateCategoryDropdowns();
  renderCategoriesTable();
}

/* ==========================================================================
   6. Enquiries Viewer & Status Manager
   ========================================================================== */
function openEnquiryModal(id) {
  const enq = firestoreEnquiries.find(e => e.docId === id);
  if (!enq) return;

  const categories = getCategories();
  let catName = 'N/A';
  if (enq.category === 'all') {
    catName = 'Complete Combo Box';
  } else {
    const match = categories.find(c => c.slug === enq.category);
    catName = match ? match.name : enq.category;
  }

  document.getElementById('enquiry-modal-id').value = enq.docId;
  document.getElementById('enquiry-modal-name').innerText = enq.name;
  document.getElementById('enquiry-modal-phone').innerHTML = `<a href="https://wa.me/91${enq.phone}" target="_blank" style="color:var(--admin-info)">${enq.phone} 🚀 (Send WA Message)</a>`;
  document.getElementById('enquiry-modal-email').innerText = enq.deliveryAddress || 'N/A';
  document.getElementById('enquiry-modal-pincode').innerText = enq.pincode || (enq.customer && enq.customer.pincode) || 'N/A';
  document.getElementById('enquiry-modal-state').innerText = (enq.customer && enq.customer.state) || enq.state || 'N/A';
  document.getElementById('enquiry-modal-date').innerText = new Date(enq.date).toLocaleString('en-IN');
  document.getElementById('enquiry-modal-message').innerText = enq.enquiryMessage || enq.message || '—';
  document.getElementById('enquiry-modal-status').value = enq.status;

  // Populate Order Details Modal with cart items and financial breakdown
  populateOrderDetailsModal(enq);

  document.getElementById('enquiry-modal').style.display = 'flex';
}

function closeEnquiryModal() {
  document.getElementById('enquiry-modal').style.display = 'none';
}

/**
 * Populate the Order Details Modal with purchased items and financial summary.
 * @param {Object} enq - The enquiry object with cartItems and financialBreakdown.
 */
function populateOrderDetailsModal(enq) {
  const itemsListEl = document.getElementById('order-details-items-list');
  if (itemsListEl) {
    if (enq.cartItems && enq.cartItems.length > 0) {
      let itemsHtml = '';
      enq.cartItems.forEach(item => {
        const productName = item.productName || item.name || 'Unknown Product';
        const quantity = item.quantity || 1;
        const finalPrice = (item.totalPrice || item.totalOriginalPrice || 0).toLocaleString('en-IN');
        itemsHtml += `
          <div class="order-detail-item">
            <span class="order-detail-name">${escapeHtml(productName)}</span>
            <span class="order-detail-qty">x${quantity}</span>
            <span class="order-detail-price">₹${finalPrice}</span>
          </div>
        `;
      });
      itemsListEl.innerHTML = itemsHtml;
    } else {
      itemsListEl.innerHTML = '<div class="order-detail-empty">No items in this order.</div>';
    }
  }

  const fb = enq.financialBreakdown || {};

  const totalOriginal = fb.totalOriginal || 0;
  const totalSavings = fb.totalSavings || 0;
  const overallDiscountPercent = fb.overallDiscountPercent || 0;
  const nonDiscountedTotal = fb.nonDiscountedTotal || 0;
  const spinWheelDiscount = fb.spinWheelDiscount || 0;
  const couponDiscount = fb.couponDiscount || 0;

  // Grand Total = Original Total - You Saved - Coupon Applied - Spin Wheel Reward
  const grandTotal = totalOriginal - totalSavings - spinWheelDiscount - couponDiscount;

  const totalEl = document.getElementById('order-summary-total');
  if (totalEl) {
    totalEl.textContent = '₹' + totalOriginal.toLocaleString('en-IN');
  }

  const discountBadgeEl = document.querySelector('.order-summary-badge');
  if (discountBadgeEl) {
    discountBadgeEl.textContent = overallDiscountPercent > 0 ? overallDiscountPercent + '% OFF' : '0% OFF';
  }

  const savedAmountEl = document.getElementById('order-summary-saved-amount');
  if (savedAmountEl) {
    savedAmountEl.textContent = totalSavings > 0 ? '-₹' + totalSavings.toLocaleString('en-IN') : '—';
  }

  const nonDiscountedEl = document.getElementById('order-summary-non-discounted');
  if (nonDiscountedEl) {
    nonDiscountedEl.textContent = '₹' + nonDiscountedTotal.toLocaleString('en-IN');
  }

  const spinWheelEl = document.getElementById('order-summary-spin-wheel');
  if (spinWheelEl) {
    spinWheelEl.textContent = spinWheelDiscount > 0 ? '-₹' + spinWheelDiscount.toLocaleString('en-IN') : '—';
  }

  const grandTotalEl = document.getElementById('order-summary-grand-total');
  if (grandTotalEl) {
    grandTotalEl.textContent = '₹' + grandTotal.toLocaleString('en-IN');
  }

  const couponEl = document.getElementById('order-summary-coupon');
  if (couponEl) {
    couponEl.textContent = couponDiscount > 0 ? '-₹' + couponDiscount.toLocaleString('en-IN') : '—';
  }
}

function saveEnquiryStatus() {
  const docId = document.getElementById('enquiry-modal-id').value;
  const status = document.getElementById('enquiry-modal-status').value;

  if (!docId || !window.db) {
    showAdminToast('Could not update enquiry status.', 'error');
    return;
  }

  window.db.collection('enquiries').doc(docId).update({ status })
    .then(() => {
      showAdminToast(`Enquiry status modified to ${status.toUpperCase()}.`, 'success');
    })
    .catch((err) => {
      console.error('[Admin] Failed to update enquiry status:', err);
      showAdminToast('Could not update enquiry status.', 'error');
    });

  // Firestore onSnapshot listener refreshes the tables + stats automatically.
  closeEnquiryModal();
}
/* ==========================================================================
   7. Item Deletions Confirmation Popups
   Handles product | category | enquiry | banner | coupon | state-rule.
   ========================================================================== */
function confirmDelete(type, id) {
  deleteTargetType = type;
  deleteTargetId = id;

  const label = document.getElementById('delete-modal-text');

  if (type === 'product') {
    label.innerText = 'This will permanently remove this firecracker product from your storefront catalogs.';
  } else if (type === 'category') {
    // Prevent deleting a category still linked to products (string comparison).
    const products = getProducts();
    const isLinked = products.some(p => String(p.categoryId).toUpperCase() === String(id).toUpperCase());
    if (isLinked) {
      showAdminToast('Cannot delete category linked to existing products!', 'error');
      return;
    }
    label.innerText = 'This will permanently delete this category link from system.';
  } else if (type === 'enquiry') {
    label.innerText = 'This will permanently delete the selected customer enquiry record.';
  } else if (type === 'banner') {
    label.innerText = 'This will permanently delete the selected homepage banner.';
  } else if (type === 'coupon') {
    label.innerText = 'This will permanently delete the selected coupon code.';
  } else if (type === 'state-rule') {
    label.innerText = 'This will permanently delete the selected state minimum rule.';
  }

  document.getElementById('delete-modal').style.display = 'flex';
}

function closeDeleteModal() {
  document.getElementById('delete-modal').style.display = 'none';
  deleteTargetType = null;
  deleteTargetId = null;
}

function executePendingDelete() {
  if (deleteTargetType === 'product') {
    let products = getProducts();
    products = products.filter(p => String(p.id) !== String(deleteTargetId));
    saveProducts(products);
    if (!window.db) {
      console.error('[Firestore] window.db is NULL — cannot delete from Firestore.');
    } else {
      deleteProductFromFirestore(deleteTargetId)
        .catch(err => {
          const code = err.code || 'unknown';
          console.error('[Firestore] Product delete FAILED. Code:', code, 'Message:', err.message, err);
          showAdminToast('Firestore delete error [' + code + ']: ' + (err.message || 'Unknown'), 'error');
        });
    }
    showAdminToast('Product removed successfully!', 'success');
    renderProductsTable();
  } else if (deleteTargetType === 'category') {
    let categories = getCategories();
    categories = categories.filter(c => String(c.id) !== String(deleteTargetId));
    saveCategories(categories);
    if (!window.db) {
      console.error('[Firestore] window.db is NULL — cannot delete category from Firestore.');
    } else {
      deleteCategoryFromFirestore(deleteTargetId)
        .then(() => console.log('[Firestore] Category deleted successfully.'))
        .catch(err => {
          const code = err.code || 'unknown';
          console.error('[Firestore] Category delete FAILED. Code:', code, 'Message:', err.message, err);
          showAdminToast('Firestore category delete error [' + code + ']: ' + (err.message || 'Unknown'), 'error');
        });
    }
    showAdminToast('Category removed successfully!', 'success');
    populateCategoryDropdowns();
    renderCategoriesTable();
  } else if (deleteTargetType === 'enquiry') {
    if (window.db && deleteTargetId) {
      window.db.collection('enquiries').doc(deleteTargetId).delete()
        .then(() => showAdminToast('Enquiry record deleted.', 'info'))
        .catch((err) => {
          console.error('[Admin] Failed to delete enquiry:', err);
          showAdminToast('Could not delete enquiry.', 'error');
        });
      // onSnapshot listener refreshes the table automatically.
    }
  } else if (deleteTargetType === 'banner') {
    const banners = getBannersData();
    const idx = Number(deleteTargetId);
    if (!isNaN(idx) && idx >= 0 && idx < banners.length) {
      banners.splice(idx, 1);
      saveBannersData(banners);
      if (!window.db) {
        console.error('[Firestore] window.db is NULL — cannot sync banners to Firestore.');
        showAdminToast('Firestore not connected. Banner saved locally only.', 'error');
      } else {
        saveBannersToFirestore(banners)
          .then(() => console.log('[Firestore] Banners synced successfully.'))
          .catch(err => {
            console.error('[Firestore] Banner sync FAILED. Code:', err.code || 'unknown', err);
            showAdminToast('Firestore banner error [' + (err.code || 'unknown') + ']: ' + (err.message || 'Unknown'), 'error');
          });
      }
      showAdminToast('Banner deleted successfully.', 'info');
      renderBannersTable();
    }
  } else if (deleteTargetType === 'coupon') {
    if (!window.db) {
      console.error('[Firestore] window.db is NULL — cannot delete coupon from Firestore.');
      showAdminToast('Firestore not connected. Coupon saved locally only.', 'error');
    } else {
      deleteCouponFromFirestore(deleteTargetId)
        .then(() => {
          console.log('[Admin] ✓ Coupon deleted from Firestore:', deleteTargetId);
          showAdminToast('Coupon code deleted successfully.', 'success');
          loadCouponsFromFirestore().then(coupons => {
            adminCoupons = coupons;
            renderCouponsTable();
          });
        })
        .catch(err => {
          console.error('[Admin] Coupon delete failed:', err);
          showAdminToast('Failed to delete coupon: ' + (err.message || 'Unknown'), 'error');
        });
    }
  } else if (deleteTargetType === 'state-rule') {
    adminStateRules = adminStateRules.filter(r => r.state !== deleteTargetId);
    localStorage.setItem('kpr_state_rules', JSON.stringify(adminStateRules));

    if (!window.db) {
      console.error('[Firestore] window.db is NULL — cannot delete state rule from Firestore.');
    } else {
      deleteStateRuleFromFirestore(deleteTargetId)
        .then(() => {
          console.log('[Admin] ✓ State rule deleted from Firestore:', deleteTargetId);
        })
        .catch(err => {
          console.error('[Admin] State rule delete failed:', err);
          showAdminToast('Failed to delete state rule: ' + (err.message || 'Unknown'), 'error');
        });
    }
    showAdminToast('State rule deleted successfully.', 'success');
    renderStateRulesTable();
  }

  closeDeleteModal();
  updateDashboardStats();
}

/* ==========================================================================
   8. Utility helpers
   ========================================================================== */
function slugify(text) {
  return text.toString().toLowerCase()
    .replace(/\s+/g, '-')           // Replace spaces with -
    .replace(/[^\w\-]+/g, '')       // Remove all non-word chars
    .replace(/\-\-+/g, '-')         // Replace multiple - with single -
    .replace(/^-+/, '')             // Trim - from start of text
    .replace(/-+$/, '');            // Trim - from end of text
}

function showAdminToast(message, type = 'success') {
  const container = document.getElementById('admin-toast-container');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = `toast-admin ${type}`;

  toast.innerHTML = `
    <span>${message}</span>
    <button class="toast-admin-close" onclick="this.parentElement.remove()">✕</button>
  `;

  container.appendChild(toast);

  setTimeout(() => {
    toast.remove();
  }, 4000);
}

// Category image helpers
window.triggerCategoryImageUpload = function triggerCategoryImageUpload() {
  const fileInput = document.getElementById('categoryImageFile');
  if (fileInput) fileInput.click();
};

function setCategoryImagePreview(dataUrl) {
  const previewImg = document.getElementById('category-modal-image-preview');
  const placeholder = document.getElementById('category-modal-image-placeholder');
  const removeBtn = document.getElementById('category-image-remove-btn');
  const previewBox = document.getElementById('category-image-preview-box');
  const hiddenInput = document.getElementById('categoryImageUrl');

  if (hiddenInput) hiddenInput.value = (dataUrl || '').toString();

  if (dataUrl && String(dataUrl).trim() !== '') {
    if (previewImg) {
      previewImg.src = dataUrl;
      previewImg.style.display = 'block';
    }
    if (placeholder) placeholder.style.display = 'none';
    if (removeBtn) removeBtn.style.display = 'flex';
    if (previewBox) previewBox.style.borderColor = 'var(--admin-success)';
  } else {
    if (previewImg) {
      previewImg.src = '';
      previewImg.style.display = 'none';
    }
    if (removeBtn) removeBtn.style.display = 'none';
    if (placeholder) placeholder.style.display = 'flex';
    if (previewBox) previewBox.style.borderColor = '';
  }
}

window.removeCategoryImage = function removeCategoryImage() {
  const fileInput = document.getElementById('categoryImageFile');
  if (fileInput) fileInput.value = '';

  setCategoryImagePreview('');
  resetCategoryImageDimensionInfo();
};

// Toggle between URL and File input groups (product modal)
window.toggleImageSourceInput = function(source) {
  const urlGroup = document.getElementById('image-url-group');
  const fileGroup = document.getElementById('image-file-group');

  if (source === 'url') {
    urlGroup.style.display = 'block';
    fileGroup.style.display = 'none';

    const url = document.getElementById('product-modal-image-url').value.trim();
    updateImagePreview(url);
  } else {
    urlGroup.style.display = 'none';
    fileGroup.style.display = 'block';

    const fileInput = document.getElementById('product-modal-image-file');
    if (fileInput.files && fileInput.files[0]) {
      const reader = new FileReader();
      reader.onload = (event) => {
        updateImagePreview(event.target.result);
      };
      reader.readAsDataURL(fileInput.files[0]);
    } else {
      updateImagePreview('');
    }
  }
};

function updateImagePreview(src) {
  const preview = document.getElementById('product-modal-image-preview');
  const placeholder = document.getElementById('product-modal-image-placeholder');

  if (src && src.trim() !== '') {
    preview.src = src;
    preview.style.display = 'block';
    placeholder.style.display = 'none';
  } else {
    preview.src = '';
    preview.style.display = 'none';
    placeholder.style.display = 'flex';
  }
}

/* ==========================================================================
   8b. Category Image Dimension Helpers & Validation
   ========================================================================== */
const CATEGORY_IMAGE_RECOMMENDED_WIDTH = 400;
const CATEGORY_IMAGE_RECOMMENDED_HEIGHT = 300;

function readImageDimensions(file, callback) {
  if (!file || !callback) return;

  const img = new Image();
  const objectUrl = URL.createObjectURL(file);

  img.onload = function () {
    callback(this.width, this.height);
    URL.revokeObjectURL(objectUrl);
  };

  img.onerror = function () {
    console.error('[Admin] Failed to read image dimensions for:', file.name);
    URL.revokeObjectURL(objectUrl);
    callback(0, 0);
  };

  img.src = objectUrl;
}

function updateCategoryImageDimensionInfo(width, height) {
  const infoEl = document.getElementById('category-image-dimension-values');
  if (!infoEl) return;

  if (width > 0 && height > 0) {
    infoEl.textContent = `${width} × ${height} px`;
  } else {
    infoEl.textContent = '-- × -- px';
  }
}

function resetCategoryImageDimensionInfo() {
  const infoEl = document.getElementById('category-image-dimension-values');
  if (infoEl) {
    infoEl.textContent = '-- × -- px';
  }

  const dimInfo = document.getElementById('category-image-dimension-info');
  if (dimInfo) {
    dimInfo.style.color = '';
  }
}

function validateCategoryImageDimensions(width, height) {
  const dimInfo = document.getElementById('category-image-dimension-info');
  if (!dimInfo) return;

  if (!width || !height) return;

  const widthOk = width <= CATEGORY_IMAGE_RECOMMENDED_WIDTH;
  const heightOk = height <= CATEGORY_IMAGE_RECOMMENDED_HEIGHT;

  if (widthOk && heightOk) {
    dimInfo.style.color = 'var(--admin-success, #22c55e)';
    return;
  }

  dimInfo.style.color = 'var(--admin-danger, #ef4444)';

  showAdminToast(
    `⚠️ Warning: The uploaded image size is ${width}×${height} px. For best display in the user page category box, please upload an image of exactly ${CATEGORY_IMAGE_RECOMMENDED_WIDTH}×${CATEGORY_IMAGE_RECOMMENDED_HEIGHT} px or smaller.`,
    'warning'
  );
}
/* ==========================================================================
   9. Banners (edit + add, base64 images)
   ========================================================================== */
function getBannersData() {
  const key = 'bannersData';
  const raw = localStorage.getItem(key);

  // First-run defaults: seed 3 banners so UI isn't empty.
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
    return getBannersData();
  }
}

function saveBannersData(banners) {
  const key = 'bannersData';
  const arr = Array.isArray(banners) ? banners : [];
  const normalized = arr.map(item => ({
    tagline: (item?.tagline ?? '').toString(),
    headingTitle: (item?.headingTitle ?? '').toString(),
    description: (item?.description ?? '').toString(),
    imageBase64: (item?.imageBase64 ?? '').toString()
  }));
  localStorage.setItem(key, JSON.stringify(normalized));
}

function renderBannersTable() {
  const tbody = document.getElementById('banners-table-body');
  if (!tbody) return;

  const banners = getBannersData();

  tbody.innerHTML = '';

  banners.forEach((b, i) => {
    const bannerNum = `Banner #${i + 1}`;
    const imgHtml = b.imageBase64
      ? `<img src="${b.imageBase64}" alt="${escapeHtml(bannerNum)}" style="width:60px;height:40px;object-fit:cover;border-radius:var(--radius-sm);border:1px solid var(--admin-border);" />`
      : `<span style="color:var(--admin-text-muted);font-size:0.85rem;">No image</span>`;

    tbody.innerHTML += `
      <tr>
        <td>${bannerNum}</td>
        <td>${imgHtml}</td>
        <td>${escapeHtml(b.tagline || '')}</td>
        <td>${escapeHtml(b.headingTitle || '')}</td>
        <td>
          <div class="table-actions">
            <button class="btn-admin btn-admin-secondary" onclick="openBannerEditModal(${i})" title="Edit">Edit</button>
            <button class="btn-admin btn-admin-danger" onclick="confirmDelete('banner', ${i})" title="Delete Banner">🗑️ Delete</button>
          </div>
        </td>
      </tr>
    `;
  });

  if (banners.length === 0) {
    tbody.innerHTML = '<tr><td colspan="5" class="text-center">No banners added yet.</td></tr>';
  }
}

function openBannerAddModal() {
  document.getElementById('banner-modal-title').innerText = 'Add New Banner';
  document.getElementById('banner-modal-index').value = '';

  document.getElementById('banner-modal-tagline').value = '';
  document.getElementById('banner-modal-heading').value = '';
  document.getElementById('banner-modal-description').value = '';
  document.getElementById('banner-modal-image-data').value = '';

  const previewImg = document.getElementById('banner-image-preview');
  const placeholder = document.getElementById('banner-image-placeholder');
  previewImg.src = '';
  previewImg.style.display = 'none';
  placeholder.style.display = 'flex';

  const fileInput = document.getElementById('banner-image-file');
  if (fileInput) fileInput.value = '';

  document.getElementById('banner-modal').style.display = 'flex';
}

function openBannerEditModal(index) {
  const banners = getBannersData();
  const banner = banners[index];
  if (!banner) return;

  document.getElementById('banner-modal-title').innerText = `Edit Banner #${index + 1}`;
  document.getElementById('banner-modal-index').value = String(index);

  document.getElementById('banner-modal-tagline').value = banner.tagline || '';
  document.getElementById('banner-modal-heading').value = banner.headingTitle || '';
  document.getElementById('banner-modal-description').value = banner.description || '';
  document.getElementById('banner-modal-image-data').value = banner.imageBase64 || '';

  const previewImg = document.getElementById('banner-image-preview');
  const placeholder = document.getElementById('banner-image-placeholder');
  const data = banner.imageBase64 || '';
  if (data) {
    previewImg.src = data;
    previewImg.style.display = 'block';
    placeholder.style.display = 'none';
  } else {
    previewImg.src = '';
    previewImg.style.display = 'none';
    placeholder.style.display = 'flex';
  }

  const fileInput = document.getElementById('banner-image-file');
  if (fileInput) fileInput.value = '';

  document.getElementById('banner-modal').style.display = 'flex';
}

function closeBannerModal() {
  document.getElementById('banner-modal').style.display = 'none';
}

function saveBannerEdit() {
  const idxRaw = document.getElementById('banner-modal-index').value;
  const idx = idxRaw === '' || idxRaw === null ? null : parseInt(idxRaw, 10);

  const tagline = document.getElementById('banner-modal-tagline').value;
  const headingTitle = document.getElementById('banner-modal-heading').value;
  const description = document.getElementById('banner-modal-description').value;
  const imageBase64 = document.getElementById('banner-modal-image-data').value;

  if (!imageBase64 || String(imageBase64).trim() === '') {
    showAdminToast('Banner image is required.', 'error');
    return;
  }

  const banners = getBannersData();

  const payload = {
    tagline: (tagline ?? '').toString(),
    headingTitle: (headingTitle ?? '').toString(),
    description: (description ?? '').toString(),
    imageBase64
  };

  if (idx === null || isNaN(idx)) {
    // Add mode
    banners.push(payload);
    saveBannersData(banners);
    if (!window.db) {
      console.error('[Firestore] window.db is NULL — cannot sync banners.');
      showAdminToast('Firestore not connected. Banner saved locally only.', 'error');
    } else {
      saveBannersToFirestore(banners)
        .then(() => console.log('[Firestore] Banners synced (add).'))
        .catch(err => {
          console.error('[Firestore] Banner sync FAILED. Code:', err.code || 'unknown', err);
          showAdminToast('Firestore banner error [' + (err.code || 'unknown') + ']: ' + (err.message || 'Unknown'), 'error');
        });
    }
    closeBannerModal();
    renderBannersTable();
    showAdminToast('New banner added successfully.', 'success');
    return;
  }

  // Edit mode
  if (idx < 0 || idx >= banners.length) return;
  banners[idx] = { ...banners[idx], ...payload };

  saveBannersData(banners);
  if (!window.db) {
    console.error('[Firestore] window.db is NULL — cannot sync banners.');
    showAdminToast('Firestore not connected. Banner saved locally only.', 'error');
  } else {
    saveBannersToFirestore(banners)
      .then(() => console.log('[Firestore] Banners synced (edit).'))
      .catch(err => {
        console.error('[Firestore] Banner sync FAILED. Code:', err.code || 'unknown', err);
        showAdminToast('Firestore banner error [' + (err.code || 'unknown') + ']: ' + (err.message || 'Unknown'), 'error');
      });
  }
  closeBannerModal();
  renderBannersTable();
  showAdminToast('Banner updated successfully.', 'success');
}

// Image file -> base64 conversion for banner modal
(function wireBannerModalUploadOnce() {
  document.addEventListener('DOMContentLoaded', () => {
    const fileInput = document.getElementById('banner-image-file');

    if (!fileInput) return;

    fileInput.addEventListener('change', (e) => {
      const file = e.target.files && e.target.files[0] ? e.target.files[0] : null;
      if (!file) {
        document.getElementById('banner-modal-image-data').value = '';
        const previewImg = document.getElementById('banner-image-preview');
        const placeholder = document.getElementById('banner-image-placeholder');
        previewImg.src = '';
        previewImg.style.display = 'none';
        placeholder.style.display = 'flex';
        return;
      }

      const reader = new FileReader();
      reader.onload = (event) => {
        const dataUrl = event.target.result;
        document.getElementById('banner-modal-image-data').value = dataUrl;

        const previewImg = document.getElementById('banner-image-preview');
        const placeholder = document.getElementById('banner-image-placeholder');
        previewImg.src = dataUrl;
        previewImg.style.display = 'block';
        placeholder.style.display = 'none';
      };
      reader.readAsDataURL(file);
    });
  });
})();

/* ==========================================================================
   OFFER BANNER — Admin Form Logic
   ========================================================================== */
function loadOfferForm() {
  console.log('[Admin] Loading offer form...');
  loadOfferFromFirestore()
    .then(offer => {
      console.log('[Admin] Offer loaded:', offer);
      document.getElementById('offer-tag').value = offer.tag || '';
      document.getElementById('offer-title').value = offer.title || '';
      document.getElementById('offer-subtitle').value = offer.subTitle || '';
      document.getElementById('offer-description').value = offer.description || '';
      document.getElementById('offer-button-text').value = offer.buttonText || '';
      document.getElementById('offer-button-link').value = offer.buttonLink || '#';
      document.getElementById('offer-active').checked = offer.active !== false;

      if (offer.targetDate) {
        const dt = new Date(offer.targetDate);
        const local = dt.getFullYear() + '-' +
          String(dt.getMonth() + 1).padStart(2, '0') + '-' +
          String(dt.getDate()).padStart(2, '0') + 'T' +
          String(dt.getHours()).padStart(2, '0') + ':' +
          String(dt.getMinutes()).padStart(2, '0');
        document.getElementById('offer-target-date').value = local;
      }

      showAdminToast('Offer loaded from cloud database.', 'success');
    })
    .catch(err => {
      console.error('[Admin] Failed to load offer:', err);
      showAdminToast('Failed to load offer: ' + (err.message || 'Unknown error'), 'error');
    });
}

// Offer form submit handler
document.addEventListener('DOMContentLoaded', () => {
  const offerForm = document.getElementById('offer-form');
  if (offerForm) {
    offerForm.addEventListener('submit', (e) => {
      e.preventDefault();
      console.log('[Admin] Offer form submitted.');

      const targetDateVal = document.getElementById('offer-target-date').value;
      if (!targetDateVal) {
        showAdminToast('Please set an offer end date.', 'error');
        return;
      }

      const offerData = {
        id: 'diwali_sale',
        tag: document.getElementById('offer-tag').value.trim(),
        title: document.getElementById('offer-title').value.trim(),
        subTitle: document.getElementById('offer-subtitle').value.trim(),
        description: document.getElementById('offer-description').value.trim(),
        buttonText: document.getElementById('offer-button-text').value.trim(),
        buttonLink: document.getElementById('offer-button-link').value.trim() || '#',
        targetDate: new Date(targetDateVal).toISOString(),
        active: document.getElementById('offer-active').checked
      };

      console.log('[Admin] Offer data to save:', offerData);

      try {
        saveOfferToFirestore(offerData)
          .then(() => {
            console.log('[Admin] ✓ Offer saved successfully.');
            showAdminToast('Offer banner saved and synced to cloud!', 'success');
          })
          .catch(err => {
            console.error('[Admin] Offer save failed:', err);
            showAdminToast('Offer saved locally but cloud sync failed: ' + (err.message || 'Unknown'), 'error');
          });
      } catch (syncError) {
        console.error('[Admin] Exception during offer save:', syncError);
        showAdminToast('Exception: ' + (syncError.message || 'Unknown'), 'error');
      }
    });
  }
});
/* ==========================================================================
   COUPON CODES — Admin Management Module
   ========================================================================== */
let adminCoupons = []; // Cache for coupon codes

function renderCouponsTable() {
  const tbody = document.getElementById('coupons-table-body');
  if (!tbody) return;

  const coupons = adminCoupons;
  tbody.innerHTML = '';

  if (coupons.length === 0) {
    tbody.innerHTML = '<tr><td colspan="5" class="text-center">No coupon codes created yet.</td></tr>';
    return;
  }

  coupons.forEach(coupon => {
    const validUntilDate = coupon.validUntil ? new Date(coupon.validUntil).toLocaleString('en-IN', {
      day: 'numeric', month: 'short', year: 'numeric'
    }) : '—';

    const statusBadge = coupon.active ?
      '<span class="status-badge resolved">Active</span>' :
      '<span class="status-badge out">Inactive</span>';

    tbody.innerHTML += `
      <tr>
        <td><strong>${escapeHtml(coupon.code)}</strong></td>
        <td>${coupon.discountPercent}%</td>
        <td>${validUntilDate}</td>
        <td>${statusBadge}</td>
        <td>
          <div class="table-actions">
            <button class="btn-action edit" onclick="openCouponEditModal('${escapeHtml(coupon.code)}')" title="Edit Coupon">✏️</button>
            <button class="btn-action delete" onclick="confirmDelete('coupon', '${escapeHtml(coupon.code)}')" title="Delete Coupon">🗑️</button>
          </div>
        </td>
      </tr>
    `;
  });
}

function openCouponAddModal() {
  document.getElementById('coupon-modal-title').innerText = 'Create Coupon';
  document.getElementById('coupon-form').reset();
  document.getElementById('coupon-modal-id').value = '';

  // Set default datetime to 1 month from now
  const defaultDate = new Date();
  defaultDate.setMonth(defaultDate.getMonth() + 1);
  const defaultDateTime = defaultDate.toISOString().slice(0, 16);
  document.getElementById('coupon-modal-valid-until').value = defaultDateTime;

  document.getElementById('coupon-modal').style.display = 'flex';
}

function openCouponEditModal(code) {
  const coupon = adminCoupons.find(c => c.code === code);
  if (!coupon) return;

  document.getElementById('coupon-modal-title').innerText = 'Edit Coupon';
  document.getElementById('coupon-modal-id').value = coupon.code;
  document.getElementById('coupon-modal-code').value = coupon.code;
  document.getElementById('coupon-modal-discount').value = coupon.discountPercent;

  if (coupon.validUntil) {
    const dt = new Date(coupon.validUntil);
    const local = dt.getFullYear() + '-' +
      String(dt.getMonth() + 1).padStart(2, '0') + '-' +
      String(dt.getDate()).padStart(2, '0') + 'T' +
      String(dt.getHours()).padStart(2, '0') + ':' +
      String(dt.getMinutes()).padStart(2, '0');
    document.getElementById('coupon-modal-valid-until').value = local;
  }

  document.getElementById('coupon-modal-active').checked = coupon.active !== false;

  document.getElementById('coupon-modal').style.display = 'flex';
}

function closeCouponModal() {
  document.getElementById('coupon-modal').style.display = 'none';
}

function saveCouponData() {
  const idVal = document.getElementById('coupon-modal-id').value;
  const code = document.getElementById('coupon-modal-code').value.trim().toUpperCase();
  const discountPercent = parseInt(document.getElementById('coupon-modal-discount').value) || 0;
  const validUntilRaw = document.getElementById('coupon-modal-valid-until').value;
  const active = document.getElementById('coupon-modal-active').checked;

  if (!code) {
    showAdminToast('Coupon code is required.', 'error');
    return;
  }

  if (discountPercent < 1 || discountPercent > 100) {
    showAdminToast('Discount percentage must be between 1-100.', 'error');
    return;
  }

  const couponData = {
    code: code,
    discountPercent: discountPercent,
    validUntil: validUntilRaw ? new Date(validUntilRaw).toISOString() : '',
    active: active
  };

  showAdminToast('Saving coupon...', 'info');

  if (!window.db) {
    console.error('[Firestore] window.db is NULL — cannot sync coupons.');
    showAdminToast('Firestore not connected. Coupon saved locally only.', 'error');
    closeCouponModal();
    return;
  }

  if (typeof firebase !== 'undefined' && firebase.auth) {
    const currentUser = firebase.auth().currentUser;
    if (!currentUser) {
      console.error('[Admin] No authenticated admin user for coupon save.');
      showAdminToast('Admin authentication required. Please log in again.', 'error');
      closeCouponModal();
      return;
    }
  }

  saveCouponToFirestore(couponData)
    .then(() => {
      console.log('[Admin] ✓ Coupon saved to Firestore:', code);
      showAdminToast('Coupon saved to cloud successfully!', 'success');
    })
    .catch(err => {
      console.error('[Admin] Coupon save failed:', err);
      const errCode = err.code || 'unknown';
      const msg = err.message || 'Unknown error';
      showAdminToast('Cloud sync failed [' + errCode + ']: ' + msg, 'error');
    });

  closeCouponModal();
  loadCouponsFromFirestore().then(coupons => {
    adminCoupons = coupons;
    renderCouponsTable();
  });
}

document.addEventListener('DOMContentLoaded', () => {
  const couponForm = document.getElementById('coupon-form');
  if (couponForm) {
    couponForm.addEventListener('submit', (e) => {
      e.preventDefault();
      saveCouponData();
    });
  }
});

/* ==========================================================================
   STATE MINIMUM RULES — Admin Management Module
   ========================================================================== */
let adminStateRules = []; // Cache for state rules

function renderStateRulesTable() {
  const tbody = document.getElementById('state-rules-table-body');
  if (!tbody) return;

  const rules = adminStateRules;
  tbody.innerHTML = '';

  if (rules.length === 0) {
    tbody.innerHTML = '<tr><td colspan="3" class="text-center">No state rules configured yet.</td></tr>';
    return;
  }

  rules.forEach(rule => {
    tbody.innerHTML += `
      <tr>
        <td><strong>${escapeHtml(rule.state)}</strong></td>
        <td>₹${rule.minimumOrder.toLocaleString('en-IN')}</td>
        <td>
          <div class="table-actions">
            <button class="btn-action edit" onclick="openStateRuleEditModal('${escapeHtml(rule.state)}')" title="Edit Rule">✏️</button>
            <button class="btn-action delete" onclick="confirmDelete('state-rule', '${escapeHtml(rule.state)}')" title="Delete Rule">🗑️</button>
          </div>
        </td>
      </tr>
    `;
  });
}

function openStateRuleAddModal() {
  document.getElementById('state-rule-modal-title').innerText = 'Add State Rule';
  document.getElementById('state-rule-form').reset();
  document.getElementById('state-rule-modal-id').value = '';
  document.getElementById('state-rule-modal').style.display = 'flex';
}

function openStateRuleEditModal(state) {
  const rule = adminStateRules.find(r => r.state === state);
  if (!rule) return;

  document.getElementById('state-rule-modal-title').innerText = 'Edit State Rule';
  document.getElementById('state-rule-modal-id').value = rule.state;
  document.getElementById('state-rule-name').value = rule.state;
  document.getElementById('state-rule-minimum').value = rule.minimumOrder;

  document.getElementById('state-rule-modal').style.display = 'flex';
}

function closeStateRuleModal() {
  document.getElementById('state-rule-modal').style.display = 'none';
}

function saveStateRuleData() {
  const stateName = document.getElementById('state-rule-name').value.trim();
  const minimumOrder = parseInt(document.getElementById('state-rule-minimum').value) || 0;
  const existingState = document.getElementById('state-rule-modal-id').value;

  if (!stateName) {
    showAdminToast('State name is required.', 'error');
    return;
  }

  if (minimumOrder < 1) {
    showAdminToast('Minimum order must be at least 1.', 'error');
    return;
  }

  if (!existingState && adminStateRules.some(r => r.state.toLowerCase() === stateName.toLowerCase())) {
    showAdminToast('State already exists. Please edit the existing rule instead.', 'error');
    return;
  }

  let rules = [...adminStateRules];
  if (existingState) {
    rules = rules.filter(r => r.state !== existingState);
  }

  const ruleData = {
    state: stateName,
    minimumOrder: minimumOrder
  };

  rules.push(ruleData);

  showAdminToast('Saving state rule...', 'info');

  if (!window.db) {
    console.error('[Firestore] window.db is NULL — cannot sync state rules.');
    showAdminToast('Firestore not connected. State rule saved locally only.', 'error');
    closeStateRuleModal();
    adminStateRules = rules;
    localStorage.setItem('kpr_state_rules', JSON.stringify(adminStateRules));
    renderStateRulesTable();
    return;
  }

  if (typeof firebase !== 'undefined' && firebase.auth) {
    const currentUser = firebase.auth().currentUser;
    if (!currentUser) {
      console.error('[Admin] No authenticated admin user for state rule save.');
      showAdminToast('Admin authentication required. Please log in again.', 'error');
      closeStateRuleModal();
      return;
    }
  }

  const firestoreRules = rules.map(r => ({ state: r.state, minimumOrder: r.minimumOrder }));
  saveStateRulesToFirestore(firestoreRules)
    .then(() => {
      console.log('[Admin] ✓ State rules saved to Firestore.');
      showAdminToast('State rule saved to cloud successfully!', 'success');
    })
    .catch(err => {
      console.error('[Admin] State rules save failed:', err);
      showAdminToast('Cloud sync failed: ' + (err.message || 'Unknown'), 'error');
    });

  closeStateRuleModal();
  adminStateRules = rules;
  renderStateRulesTable();
}

function loadStateRules() {
  loadStateMinimumRulesFromFirestore()
    .then(rules => {
      adminStateRules = rules || [];
      renderStateRulesTable();
      console.log('[Admin] State rules loaded:', adminStateRules.length);
    })
    .catch(err => {
      console.error('[Admin] Failed to load state rules:', err);
      adminStateRules = getStateMinimumRules() || [];
      renderStateRulesTable();
    });
}

document.addEventListener('DOMContentLoaded', () => {
  const stateRuleForm = document.getElementById('state-rule-form');
  if (stateRuleForm) {
    stateRuleForm.addEventListener('submit', (e) => {
      e.preventDefault();
      saveStateRuleData();
    });
  }
});

/* ==========================================================================
   GLOBAL HANDLER ATTACHMENTS
   Inline HTML onclick attributes call these by bare name. admin.js is a
   classic script so top-level declarations are already global, but we also
   attach them to window explicitly for robustness and provide the
   edit/delete aliases used across the admin UI.
   ========================================================================== */
// Products
window.openProductAddModal = openProductAddModal;
window.openProductEditModal = openProductEditModal;
window.closeProductModal = closeProductModal;
window.saveProductData = saveProductData;
window.editProduct = openProductEditModal;
window.deleteProduct = (id) => confirmDelete('product', id);

// Categories
window.openCategoryAddModal = openCategoryAddModal;
window.openCategoryEditModal = openCategoryEditModal;
window.closeCategoryModal = closeCategoryModal;
window.saveCategoryData = saveCategoryData;
window.editCategory = openCategoryEditModal;
window.deleteCategory = (id) => confirmDelete('category', id);

// Enquiries
window.openEnquiryModal = openEnquiryModal;
window.openEnquiryViewModal = openEnquiryModal; // alias used by enquiries table
window.closeEnquiryModal = closeEnquiryModal;
window.saveEnquiryStatus = saveEnquiryStatus;

// Banners
window.renderBannersTable = renderBannersTable;
window.openBannerAddModal = openBannerAddModal;
window.openBannerEditModal = openBannerEditModal;
window.closeBannerModal = closeBannerModal;
window.saveBannerEdit = saveBannerEdit;

// Offers
window.loadOfferForm = loadOfferForm;

// Coupons
window.renderCouponsTable = renderCouponsTable;
window.openCouponAddModal = openCouponAddModal;
window.openCouponEditModal = openCouponEditModal;
window.closeCouponModal = closeCouponModal;
window.saveCouponData = saveCouponData;
window.editCoupon = openCouponEditModal;
window.deleteCoupon = (code) => confirmDelete('coupon', code);

// State rules
window.renderStateRulesTable = renderStateRulesTable;
window.loadStateRules = loadStateRules;
window.openStateRuleAddModal = openStateRuleAddModal;
window.openStateRuleEditModal = openStateRuleEditModal;
window.closeStateRuleModal = closeStateRuleModal;
window.saveStateRuleData = saveStateRuleData;
window.editStateRule = openStateRuleEditModal;
window.deleteStateRule = (state) => confirmDelete('state-rule', state);

// Deletion + misc shared handlers
window.confirmDelete = confirmDelete;
window.closeDeleteModal = closeDeleteModal;
window.executePendingDelete = executePendingDelete;
window.logoutAdmin = logoutAdmin;
window.showDashboardSection = showDashboardSection;
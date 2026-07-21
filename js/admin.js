// KPR Crackers - Admin Control Panel Logic (admin.js)

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
      'coupons': 'Manage Coupon Codes'
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
      catName = 'Complete Combo';
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
  
  // Category dropdown filter check
  if (filterCat !== 'all') {
    filtered = filtered.filter(p => Number(p.categoryId) === Number(filterCat));
  }
  
  // Search text filter check
  if (searchVal.trim() !== '') {
    filtered = filtered.filter(p => p.name.toLowerCase().includes(searchVal));
  }
  
  if (filtered.length === 0) {
    tbody.innerHTML = '<tr><td colspan="9" class="text-center">No inventory matching criteria found.</td></tr>';
    return;
  }
  
  filtered.forEach(p => {
    const cat = categories.find(c => Number(c.id) === Number(p.categoryId));
    const catName = cat ? cat.name : 'Unknown';
    const bgIndex = (p.categoryId % 9) + 1;
    const emojiMap = { 1: '🌀', 2: '🌋', 3: '⛲', 4: '✏️', 5: '✨', 6: '💣', 7: '🚀', 8: '⚡', 9: '🎁' };
    const emoji = emojiMap[p.categoryId] || '🎆';
    
    let imageCellContent = `<div class="prod-placeholder-cell p-bg-${bgIndex}">${emoji}</div>`;
    if (p.image) {
      imageCellContent = `<img src="${p.image}" class="admin-prod-thumb" alt="${p.name}" style="width: 40px; height: 40px; object-fit: cover; border-radius: var(--radius-sm); border: 1px solid var(--admin-border);">`;
    }

    tbody.innerHTML += `
      <tr>
        <td>#${p.id}</td>
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
            <button class="btn-action edit" onclick="openProductEditModal(${p.id})" title="Edit Product">✏️</button>
            <button class="btn-action delete" onclick="confirmDelete('product', ${p.id})" title="Delete Product">🗑️</button>
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
  const p = products.find(prod => Number(prod.id) === Number(id));
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
  const categoryId = parseInt(document.getElementById('product-modal-cat').value);
  const qty = document.getElementById('product-modal-qty').value;
  const originalPrice = parseInt(document.getElementById('product-modal-orig-price').value);
  const discountRaw = document.getElementById('product-modal-discount').value.trim();
  
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
  
  if (idVal === '') {
    // Add Mode
    const newId = generateId(products);
    const newProduct = {
      id: newId, name, categoryId, price, originalPrice, discount, qty, description, inStock, image
    };
    products.push(newProduct);
  } else {
    // Edit Mode
    const pIndex = products.findIndex(prod => Number(prod.id) === Number(idVal));
    if (pIndex !== -1) {
      products[pIndex] = {
        id: Number(idVal), name, categoryId, price, originalPrice, discount, qty, description, inStock, image
      };
    }
  }

  // Show a single clean success toast
  showAdminToast('Product saved successfully!', 'success');
  
  saveProducts(products);
  // Sync to Firestore (async) with visible error feedback
  const productToSync = idVal === '' ? products[products.length - 1] : products.find(p => Number(p.id) === Number(idVal));
  if (!window.db) {
    console.error('[Firestore] window.db is NULL — Firebase not initialized. Check that firebase-config.js loaded correctly.');
    showAdminToast('Firestore not connected. Data saved locally only.', 'error');
  } else if (productToSync) {
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
  closeProductModal();
  renderProductsTable();
}

/* ==========================================================================
   5. Category Settings CRUD Manager
   ========================================================================= */
function renderCategoriesTable() {
  const tbody = document.getElementById('categories-table-body');
  if (!tbody) return;
  
  const categories = getCategories();
  tbody.innerHTML = '';
  
  if (categories.length === 0) {
    tbody.innerHTML = '<tr><td colspan="4" class="text-center">No categories present.</td></tr>';
    return;
  }
  
  categories.forEach(cat => {
    const imgVal = (cat.categoryImageUrl ?? cat.image ?? '').toString();

    let imageCell = `
      <div class="cat-no-image">
        <span class="cat-no-image-icon">🖼️</span>
        <span class="cat-no-image-text">No Image</span>
      </div>
    `;

    if (imgVal && imgVal.trim() !== '') {
      imageCell = `
        <img
          src="${imgVal}"
          class="cat-thumb"
          alt="${escapeHtml(cat.name)}"
        >
      `;
    }

    tbody.innerHTML += `
      <tr>
        <td>#${cat.id}</td>
        <td>
          ${imageCell}
        </td>
        <td><strong>${escapeHtml(cat.name)}</strong></td>
        <td><code>${escapeHtml(cat.slug)}</code></td>
        <td>
          <div class="table-actions">
            <button class="btn-action edit" onclick="openCategoryEditModal(${cat.id})" title="Edit CategoryName">✏️</button>
            <button class="btn-action delete" onclick="confirmDelete('category', ${cat.id})" title="Delete Category">🗑️</button>
          </div>
        </td>
      </tr>
    `;
  });
}

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
  const cat = categories.find(c => Number(c.id) === Number(id));
  if (!cat) return;

  document.getElementById('category-modal-title').innerText = 'Edit Category Name';
  document.getElementById('category-modal-id').value = cat.id;
  document.getElementById('category-modal-name').value = cat.name;
  document.getElementById('category-modal-slug').value = cat.slug;

  // Backward compatible read:
  // - new field: categoryImageUrl
  // - old field: image
  const imgVal = (cat.categoryImageUrl ?? cat.image ?? '').toString();

  // For edit: show existing image preview and prefill hidden legacy field.
  const hiddenInput = document.getElementById('categoryImageUrl');
  if (hiddenInput) hiddenInput.value = imgVal;

  setCategoryImagePreview(imgVal);

  // Also reset file input so that choosing a new file is required to update.
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

  // The hidden field will be updated when a new file is selected.
  // If no file selected during edit, keep existing image.
  let selectedImg = document.getElementById('categoryImageUrl')?.value?.trim() || '';

  const categories = getCategories();

  if (idVal === '') {
    // Add Mode
    const newId = generateId(categories);
    const newCat = {
      id: newId,
      name,
      slug,
      categoryImageUrl: selectedImg,
      // legacy field
      image: selectedImg
    };
    categories.push(newCat);
  } else {
    // Edit Mode
    const index = categories.findIndex(c => Number(c.id) === Number(idVal));
    if (index !== -1) {
      // If no new upload happened, selectedImg may still be the existing value
      // (we prefill it in openCategoryEditModal), so it will be preserved.
      // If admin clears preview, it will save empty string.
      categories[index].name = name;
      categories[index].slug = slug;
      categories[index].categoryImageUrl = selectedImg;
      // legacy field
      categories[index].image = selectedImg;
    }
  }

  saveCategories(categories);
  console.log('[Category Save] localStorage updated. Categories count:', categories.length);

  // Show a single clean success toast immediately
  showAdminToast('Category saved successfully!', 'success');

  // Async Firestore sync (fire-and-forget, error only shown if sync fails)
  const categoryToSync = idVal === '' ? categories[categories.length - 1] : categories.find(c => Number(c.id) === Number(idVal));

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
function renderEnquiriesTable() {
  const tbody = document.getElementById('enquiries-table-body');
  if (!tbody) return;
  
  const enquiries = firestoreEnquiries;
  const categories = getCategories();
  const statusFilter = document.getElementById('admin-enquiry-filter-status')?.value || 'all';
  
  tbody.innerHTML = '';
  
  let filtered = enquiries;
  if (statusFilter !== 'all') {
    filtered = enquiries.filter(e => e.status === statusFilter);
  }
  
  // Sort descending by date
  filtered.sort((a, b) => new Date(b.date) - new Date(a.date));
  
  if (filtered.length === 0) {
    tbody.innerHTML = '<tr><td colspan="7" class="text-center">No customer enquiries found matching filter.</td></tr>';
    return;
  }
  
     filtered.forEach(enq => {
     const formattedDate = new Date(enq.date).toLocaleString('en-IN', {
       day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
     });
     
     // Get pincode - check both customer.pincode and direct pincode field
     const pincodeDisplay = enq.pincode || (enq.customer && enq.customer.pincode) || 'N/A';
     
     // Get enquiry message - check both enquiryMessage and message fields
     const enquiryMsg = enq.enquiryMessage || enq.message || '';
     const messagePreview = enquiryMsg.length > 80 ? enquiryMsg.substring(0, 80) + '...' : enquiryMsg || '—';
     
     // Calculate grand total for display
     let grandTotalDisplay = '—';
     if (enq.financialBreakdown && enq.financialBreakdown.grandTotal) {
       grandTotalDisplay = `₹${enq.financialBreakdown.grandTotal.toLocaleString('en-IN')}`;
     } else if (enq.cartItems && enq.cartItems.length > 0) {
       const totalFromItems = enq.cartItems.reduce((sum, item) => sum + (item.totalPrice || 0), 0);
       grandTotalDisplay = `₹${totalFromItems.toLocaleString('en-IN')}`;
     }

     tbody.innerHTML += `
       <tr>
         <td>#${(enq.docId || '').substring(0, 6)}</td>
         <td>${formattedDate}</td>
         <td>
           <strong>${escapeHtml(enq.name)}</strong><br>
           <a href="https://wa.me/91${enq.phone}" target="_blank" style="color:var(--admin-info)">📞 ${escapeHtml(enq.phone)}</a><br>
         <span style="font-size:0.75rem;color:var(--admin-text-muted)">${escapeHtml(enq.deliveryAddress || 'No delivery address')}</span>

         </td>
         <td>${escapeHtml(pincodeDisplay)}</td>
         <td>${escapeHtml(messagePreview)}</td>
         <td>
           <a href="#" class="grand-total-badge" onclick="openEnquiryModal('${enq.docId}');return false;" title="View Order Details">
             ${grandTotalDisplay}
           </a>
         </td>
         <td><span class="status-badge ${enq.status}">${enq.status}</span></td>
         <td>
           <div class="table-actions">
             <button class="btn-action view" onclick="openEnquiryModal('${enq.docId}')" title="View Details">🔍</button>
             <button class="btn-action delete" onclick="confirmDelete('enquiry', '${enq.docId}')" title="Delete Enquiry">🗑️</button>
           </div>
         </td>
       </tr>
     `;
   });
}

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
  // Populate purchased items list
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
  
  // Populate financial summary block
  const fb = enq.financialBreakdown || {};
  
  // Extract values for dynamic calculation (matching Firebase payload keys)
  const totalOriginal = fb.totalOriginal || 0;
  const totalSavings = fb.totalSavings || 0;
  const overallDiscountPercent = fb.overallDiscountPercent || 0;
  const nonDiscountedTotal = fb.nonDiscountedTotal || 0;
  const spinWheelDiscount = fb.spinWheelDiscount || 0;
  const couponDiscount = fb.couponDiscount || 0;
  
   // Calculate Grand Total dynamically using the correct formula:
   // Grand Total = Original Total - You Saved - Coupon Applied - Spin Wheel Reward
   const grandTotal = totalOriginal - totalSavings - spinWheelDiscount - couponDiscount;
  
  // Original Total
  const totalEl = document.getElementById('order-summary-total');
  if (totalEl) {
    totalEl.textContent = '₹' + totalOriginal.toLocaleString('en-IN');
  }
  
  // Discount Percentage Badge - FIXED: Use correct selector for class-based element
  const discountBadgeEl = document.querySelector('.order-summary-badge');
  if (discountBadgeEl) {
    discountBadgeEl.textContent = overallDiscountPercent > 0 ? overallDiscountPercent + '% OFF' : '0% OFF';
  }
  
  // You Saved Amount display
  const savedAmountEl = document.getElementById('order-summary-saved-amount');
  if (savedAmountEl) {
    savedAmountEl.textContent = totalSavings > 0 ? '-₹' + totalSavings.toLocaleString('en-IN') : '—';
  }
  
  // Non-Discounted Items Total
  const nonDiscountedEl = document.getElementById('order-summary-non-discounted');
  if (nonDiscountedEl) {
    nonDiscountedEl.textContent = '₹' + nonDiscountedTotal.toLocaleString('en-IN');
  }
  
  // Spin Wheel Discount
  const spinWheelEl = document.getElementById('order-summary-spin-wheel');
  if (spinWheelEl) {
    spinWheelEl.textContent = spinWheelDiscount > 0 ? '-₹' + spinWheelDiscount.toLocaleString('en-IN') : '—';
  }
  
  // Grand Total - FIXED: Use dynamic calculation based on formula
  const grandTotalEl = document.getElementById('order-summary-grand-total');
  if (grandTotalEl) {
    grandTotalEl.textContent = '₹' + grandTotal.toLocaleString('en-IN');
  }
  
  // Coupon applied
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
  
  // Firestore onSnapshot listener will refresh the tables + stats automatically.
  closeEnquiryModal();
}

/* ==========================================================================
   7. Item Deletions Confirmation Popups
   ========================================================================== */
function confirmDelete(type, id) {
  deleteTargetType = type;
  deleteTargetId = id;
  
  const label = document.getElementById('delete-modal-text');
  
  if (type === 'product') {
    label.innerText = 'This will permanently remove this firecracker product from your storefront catalogs.';
  } else if (type === 'category') {
    // Check if category is currently linked to products
    const products = getProducts();
    const isLinked = products.some(p => Number(p.categoryId) === Number(id));
    if (isLinked) {
      showAdminToast('Cannot delete category linked to existing products!', 'error');
      return;
    }
    label.innerText = 'This will permanently delete this category link from system.';
  } else if (type === 'enquiry') {
    label.innerText = 'This will permanently delete the selected customer enquiry record.';
  } else if (type === 'banner') {
    label.innerText = 'This will permanently delete the selected homepage banner.';
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
    products = products.filter(p => Number(p.id) !== Number(deleteTargetId));
    saveProducts(products);
    // Delete from Firestore (async) with visible error feedback
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
    categories = categories.filter(c => Number(c.id) !== Number(deleteTargetId));
    saveCategories(categories);
    // Delete from Firestore (async) with visible error feedback
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
    // Delete state rule from localStorage
    adminStateRules = adminStateRules.filter(r => r.state !== deleteTargetId);
    localStorage.setItem('kpr_state_rules', JSON.stringify(adminStateRules));
    
    // Delete from Firestore (async)
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

function escapeHtml(text) {
  if (!text) return '';
  const map = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  };
  return text.replace(/[&<>"']/g, m => map[m]);
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
    // Image selected: show img + remove btn, hide placeholder
    if (previewImg) {
      previewImg.src = dataUrl;
      previewImg.style.display = 'block';
    }
    if (placeholder) placeholder.style.display = 'none';
    if (removeBtn) removeBtn.style.display = 'flex';
    if (previewBox) previewBox.style.borderColor = 'var(--admin-success)';
  } else {
    // No image: hide img + remove btn, show placeholder
    if (previewImg) {
      previewImg.src = '';
      previewImg.style.display = 'none';
    }
    if (removeBtn) removeBtn.style.display = 'none';
    if (placeholder) placeholder.style.display = 'flex';
    if (previewBox) previewBox.style.borderColor = '';
  }
}

/**
 * Removes the selected category image and resets the preview to placeholder state.
 */
window.removeCategoryImage = function removeCategoryImage() {
  const fileInput = document.getElementById('categoryImageFile');
  if (fileInput) fileInput.value = '';

  setCategoryImagePreview('');
  resetCategoryImageDimensionInfo();
};


// Toggle between URL and File input groups
window.toggleImageSourceInput = function(source) {
  const urlGroup = document.getElementById('image-url-group');
  const fileGroup = document.getElementById('image-file-group');
  
  if (source === 'url') {
    urlGroup.style.display = 'block';
    fileGroup.style.display = 'none';
    
    // Update preview with URL value
    const url = document.getElementById('product-modal-image-url').value.trim();
    updateImagePreview(url);
  } else {
    urlGroup.style.display = 'none';
    fileGroup.style.display = 'block';
    
    // Reset file preview or show file preview
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

// Recommended dimensions for category images (4:3 aspect ratio matching front-end cards)
const CATEGORY_IMAGE_RECOMMENDED_WIDTH = 400;
const CATEGORY_IMAGE_RECOMMENDED_HEIGHT = 300;

/**
 * Reads an image file's natural dimensions asynchronously.
 * @param {File} file - The image file selected by the user.
 * @param {function} callback - Called with (width, height) once loaded.
 */
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

/**
 * Updates the dimension info text in the category modal.
 * @param {number} width - Image width in pixels.
 * @param {number} height - Image height in pixels.
 */
function updateCategoryImageDimensionInfo(width, height) {
  const infoEl = document.getElementById('category-image-dimension-values');
  if (!infoEl) return;

  if (width > 0 && height > 0) {
    infoEl.textContent = `${width} × ${height} px`;
  } else {
    infoEl.textContent = '-- × -- px';
  }
}

/**
 * Resets the dimension display to the default placeholder.
 */
function resetCategoryImageDimensionInfo() {
  const infoEl = document.getElementById('category-image-dimension-values');
  if (infoEl) {
    infoEl.textContent = '-- × -- px';
  }

  // Also reset any color styling from validation
  const dimInfo = document.getElementById('category-image-dimension-info');
  if (dimInfo) {
    dimInfo.style.color = '';
  }
}

/**
 * Validates the uploaded image dimensions against the recommended size.
 * Shows a warning toast/popup if dimensions exceed recommended values.
 * @param {number} width - Image width in pixels.
 * @param {number} height - Image height in pixels.
 */
function validateCategoryImageDimensions(width, height) {
  const dimInfo = document.getElementById('category-image-dimension-info');
  if (!dimInfo) return;

  // If dimensions couldn't be read, skip validation
  if (!width || !height) return;

  const widthOk = width <= CATEGORY_IMAGE_RECOMMENDED_WIDTH;
  const heightOk = height <= CATEGORY_IMAGE_RECOMMENDED_HEIGHT;

  if (widthOk && heightOk) {
    // Within recommended range — show green indicator
    dimInfo.style.color = 'var(--admin-success, #22c55e)';
    return;
  }

  // Exceeds recommended size — show warning toast
  dimInfo.style.color = 'var(--admin-danger, #ef4444)';

  showAdminToast(
    `⚠️ Warning: The uploaded image size is ${width}×${height} px. For best display in the user page category box, please upload an image of exactly ${CATEGORY_IMAGE_RECOMMENDED_WIDTH}×${CATEGORY_IMAGE_RECOMMENDED_HEIGHT} px or smaller.`,
    'warning'
  );
}

/* ==========================================================================
   9. Banners (fixed 3-banner edit-only)
   ========================================================================== */

function getBannersData() {
  const key = 'bannersData';
  const raw = localStorage.getItem(key);

  // First-run defaults: seed 3 banners so UI isn't empty, but do NOT enforce fixed length.
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

    // Normalize structure but keep ALL items.
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

  // reset preview
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

  // preview
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

  // For edit: reset file input so selecting a new file replaces image.
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

  // Image is strictly required (HTML required + extra guard)
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
    const imageDataInput = document.getElementById('banner-modal-image-data');

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
   Loads offer data into the form, handles save to Firestore.
   ========================================================================== */

/**
 * Load offer data from Firestore into the admin form.
 */
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

      // Convert ISO date to datetime-local format (YYYY-MM-DDTHH:MM)
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
   COUPON CODES - Admin Management Module
   ========================================================================== */

let adminCoupons = []; // Cache for coupon codes

/**
 * Render the coupons table in the admin panel.
 */
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

/**
 * Open the Add Coupon modal.
 */
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

/**
 * Open the Edit Coupon modal.
 */
function openCouponEditModal(code) {
  const coupon = adminCoupons.find(c => c.code === code);
  if (!coupon) return;

  document.getElementById('coupon-modal-title').innerText = 'Edit Coupon';
  document.getElementById('coupon-modal-id').value = coupon.code;
  document.getElementById('coupon-modal-code').value = coupon.code;
  document.getElementById('coupon-modal-discount').value = coupon.discountPercent;
  
  // Format validUntil for datetime-local input
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

/**
 * Close the Coupon modal.
 */
function closeCouponModal() {
  document.getElementById('coupon-modal').style.display = 'none';
}

/**
 * Save coupon data to Firestore.
 */
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

  // Check if admin is authenticated
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
      const code = err.code || 'unknown';
      const msg = err.message || 'Unknown error';
      showAdminToast('Cloud sync failed [' + code + ']: ' + msg, 'error');
    });

  closeCouponModal();
  loadCouponsFromFirestore().then(coupons => {
    adminCoupons = coupons;
    renderCouponsTable();
  });
}

/**
 * Handle coupon form submission.
 */
document.addEventListener('DOMContentLoaded', () => {
  const couponForm = document.getElementById('coupon-form');
  if (couponForm) {
    couponForm.addEventListener('submit', (e) => {
      e.preventDefault();
      saveCouponData();
    });
  }
});

/**
 * Add coupon to delete confirmation types.
 */
function confirmDelete(type, id) {
  deleteTargetType = type;
  deleteTargetId = id;

  const label = document.getElementById('delete-modal-text');

  if (type === 'product') {
    label.innerText = 'This will permanently remove this firecracker product from your storefront catalogs.';
  } else if (type === 'category') {
    const products = getProducts();
    const isLinked = products.some(p => Number(p.categoryId) === Number(id));
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

/* ==========================================================================
   STATE MINIMUM RULES - Admin Management Module
   ========================================================================== */

let adminStateRules = []; // Cache for state rules

/**
 * Render the state rules table in the admin panel.
 */
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

/**
 * Open the Add State Rule modal.
 */
function openStateRuleAddModal() {
  document.getElementById('state-rule-modal-title').innerText = 'Add State Rule';
  document.getElementById('state-rule-form').reset();
  document.getElementById('state-rule-modal-id').value = '';
  document.getElementById('state-rule-modal').style.display = 'flex';
}

/**
 * Open the Edit State Rule modal.
 */
function openStateRuleEditModal(state) {
  const rule = adminStateRules.find(r => r.state === state);
  if (!rule) return;

  document.getElementById('state-rule-modal-title').innerText = 'Edit State Rule';
  document.getElementById('state-rule-modal-id').value = rule.state;
  document.getElementById('state-rule-name').value = rule.state;
  document.getElementById('state-rule-minimum').value = rule.minimumOrder;

  document.getElementById('state-rule-modal').style.display = 'flex';
}

/**
 * Close the State Rule modal.
 */
function closeStateRuleModal() {
  document.getElementById('state-rule-modal').style.display = 'none';
}

/**
 * Save state rule data to Firestore.
 */
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

  // Check for duplicate state (when adding new)
  if (!existingState && adminStateRules.some(r => r.state.toLowerCase() === stateName.toLowerCase())) {
    showAdminToast('State already exists. Please edit the existing rule instead.', 'error');
    return;
  }

  // If editing and state name changed, update the existing rule
  let rules = [...adminStateRules];
  if (existingState) {
    // Editing existing - remove old entry
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
    renderStateRulesTable();
    return;
  }

  // Check if admin is authenticated
  if (typeof firebase !== 'undefined' && firebase.auth) {
    const currentUser = firebase.auth().currentUser;
    if (!currentUser) {
      console.error('[Admin] No authenticated admin user for state rule save.');
      showAdminToast('Admin authentication required. Please log in again.', 'error');
      closeStateRuleModal();
      return;
    }
  }

  // Save to Firestore
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

/**
 * Load state rules from Firestore on page load.
 */
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

/**
 * Initialize state rules form event listener.
 */
document.addEventListener('DOMContentLoaded', () => {
  const stateRuleForm = document.getElementById('state-rule-form');
  if (stateRuleForm) {
    stateRuleForm.addEventListener('submit', (e) => {
      e.preventDefault();
      saveStateRuleData();
    });
  }
});

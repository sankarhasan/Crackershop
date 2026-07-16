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

  // Category image upload -> preview (base64)
  const catFileInput = document.getElementById('categoryImageFile');

  if (catFileInput) {
    catFileInput.addEventListener('change', (e) => {
      const file = e.target.files && e.target.files[0] ? e.target.files[0] : null;
      if (!file) {
        setCategoryImagePreview('');
        return;
      }

      const reader = new FileReader();
      reader.onload = (event) => {
        setCategoryImagePreview(event.target.result);
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

  // Start realtime Firestore enquiries stream (auto-refreshes tables + stats)
  listenToEnquiries();

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

  window.db.collection('enquiries')
    .orderBy('timestamp', 'desc')
    .onSnapshot((snapshot) => {
      firestoreEnquiries = snapshot.docs.map((doc) => {
        const d = doc.data() || {};
        let dateStr;
        if (d.timestamp && typeof d.timestamp.toDate === 'function') {
          dateStr = d.timestamp.toDate().toISOString();
        } else {
          dateStr = d.date || new Date().toISOString();
        }
        return {
          docId: doc.id,
          name: d.name || '',
          phone: d.phone || '',
          deliveryAddress: d.deliveryAddress || '',
          category: d.category || '',
          message: d.message || '',
          status: d.status || 'new',
          date: dateStr
        };
      });

      // Refresh any views that depend on enquiries
      updateDashboardStats();
      renderEnquiriesTable();
    }, (err) => {
      console.error('[Admin] Failed to load enquiries from Firestore:', err);
      showAdminToast('Could not load enquiries from cloud.', 'error');
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
      'banners': 'Manage Homepage Banners'
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
  
  // Sum up estimated revenue pool based on "Total Est: ₹XXXX" string parsing or calculating
  let revenuePoolVal = 0;
  enquiries.forEach(enq => {
    if (enq.message && enq.message.includes('Total Est: ₹')) {
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
  const discountPercent = parseDiscountPercent(discountInput.value);
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
  const discountRaw = document.getElementById('product-modal-discount').value;
  const discountPct = parseDiscountPercent(discountRaw);
  const discount = discountPct > 0 ? `${Math.round(discountPct)}% OFF` : discountRaw.trim();
  const price = calculateSalePrice(originalPrice, discountPct);
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
    showAdminToast('New firecracker item added!', 'success');
  } else {
    // Edit Mode
    const pIndex = products.findIndex(prod => Number(prod.id) === Number(idVal));
    if (pIndex !== -1) {
      products[pIndex] = {
        id: Number(idVal), name, categoryId, price, originalPrice, discount, qty, description, inStock, image
      };
      showAdminToast('Firecracker specifications updated.', 'success');
    }
  }
  
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
    showAdminToast('New category link established!', 'success');
  } else {
    // Edit Mode
    const index = categories.findIndex(c => Number(c.id) === Number(idVal));
    if (index !== -1) {
      const existing = categories[index];

      // If no new upload happened, selectedImg may still be the existing value
      // (we prefill it in openCategoryEditModal), so it will be preserved.
      // If admin clears preview, it will save empty string.
      categories[index].name = name;
      categories[index].slug = slug;
      categories[index].categoryImageUrl = selectedImg;
      // legacy field
      categories[index].image = selectedImg;

      showAdminToast('Category configuration modified.', 'success');
    }
  }

  saveCategories(categories);
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
    
    let catName = 'N/A';
    if (enq.category === 'all') {
      catName = 'Complete Combo Box';
    } else {
      const match = categories.find(c => c.slug === enq.category);
      catName = match ? match.name : enq.category;
    }
    
    // Shorten preview text
    const messagePreview = enq.message.length > 80 ? enq.message.substring(0, 80) + '...' : enq.message;
    
    tbody.innerHTML += `
      <tr>
        <td>#${(enq.docId || '').substring(0, 6)}</td>
        <td>${formattedDate}</td>
        <td>
          <strong>${escapeHtml(enq.name)}</strong><br>
          <a href="https://wa.me/91${enq.phone}" target="_blank" style="color:var(--admin-info)">📞 ${escapeHtml(enq.phone)}</a><br>
        <span style="font-size:0.75rem;color:var(--admin-text-muted)">${escapeHtml(enq.deliveryAddress || 'No delivery address')}</span>

        </td>
        <td><span class="badge-cat-label">${catName}</span></td>
        <td><div style="max-width:300px;word-break:break-all;">${escapeHtml(messagePreview)}</div></td>
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
  document.getElementById('enquiry-modal-cat').innerText = catName;
  document.getElementById('enquiry-modal-date').innerText = new Date(enq.date).toLocaleString('en-IN');
  document.getElementById('enquiry-modal-message').innerText = enq.message;
  document.getElementById('enquiry-modal-status').value = enq.status;
  
  document.getElementById('enquiry-modal').style.display = 'flex';
}

function closeEnquiryModal() {
  document.getElementById('enquiry-modal').style.display = 'none';
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
    showAdminToast('Firecracker item deleted.', 'info');
    renderProductsTable();
  } else if (deleteTargetType === 'category') {
    let categories = getCategories();
    categories = categories.filter(c => Number(c.id) !== Number(deleteTargetId));
    saveCategories(categories);
    showAdminToast('Category configuration deleted.', 'info');
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
  const hiddenInput = document.getElementById('categoryImageUrl');

  if (hiddenInput) hiddenInput.value = (dataUrl || '').toString();

  if (dataUrl && String(dataUrl).trim() !== '') {
    if (previewImg) {
      previewImg.src = dataUrl;
      previewImg.style.display = 'block';
    }
    if (placeholder) placeholder.style.display = 'none';
  } else {
    if (previewImg) {
      previewImg.src = '';
      previewImg.style.display = 'none';
    }
    if (placeholder) placeholder.style.display = 'flex';
  }
}


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

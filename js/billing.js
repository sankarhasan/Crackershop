/* ==========================================================================
   KPR ADMIN - BILLING / INVOICE MODULE (in-store POS) — Phase 1
   --------------------------------------------------------------------------
   Vanilla JS, Firebase compat, mirrors the existing modular admin pattern
   (js/banners.js, js/coupon-stack.js). Reuses window.db (the "kpr-admin"
   named-app Firestore handle bound in js/admin.js), window.adminAuth for the
   signed-in admin, showAdminToast() and logActivity() from js/admin.js, and
   the jsPDF + autotable globals already loaded on admin.html.

   Rules honoured for this shop:
     * NO numeric inventory. Product.inStock is ONLY an enable/disable flag
       for billing — no stock read, cap, deduction, oversell block or alerts.
     * NO tax by default. GST lives in billing_settings (taxEnabled/taxRate)
       and is off unless the admin turns it on.
     * Existing product data & all other features are untouched.
   ========================================================================== */

(function () {
  'use strict';

  /* ---------------------- Module state ---------------------- */
  var billingProducts = [];       // live docs from the products collection
  var billingCategories = [];     // live docs from the categories collection
  var cart = [];                  // [{productId,code,name,unitPrice(original),finalUnitPrice,qty,discountPerUnit(derived)}] // Rate & Final Rate come from the product record; only Qty is editable.
  var billingSettings = null;     // shop billing profile (see DEFAULT_SETTINGS)
  var listenersAttached = false;  // static input listeners wired once
  var productsBound = false;      // Firestore snapshot listeners bound once
  var isSubmitting = false;       // duplicate-submit guard
  var currentView = 'create';     // create | history | settings

  // Sales history cache (bounded latest slice, filtered/paginated client-side)
  var histCache = null;           // null = not loaded yet; else array of models
  var histFiltered = [];          // after filters
  var histPage = 0;               // 0-based
  var HIST_PAGE_SIZE = 20;
  var HIST_MAX_LOAD = 500;

  var _previewModel = null;       // invoice currently shown in the preview modal
  var _previewMode = 'a4';        // a4 | receipt

  var SETTINGS_DOC_ID = 'shop';   // billing_settings/{shop}
  var DEFAULT_SETTINGS = {
    shopName: 'KPR Crackers',
    shopAddress: '',
    shopPhone: '',
    gstin: '',
    logoPath: 'Icons/Brand Logo png.png',
    taxEnabled: false,
    taxRate: 0
  };

  /* ---------------------- Money helpers (integer paise) ---------------------- */
  function toPaise(v) { return Math.round((Number(v) || 0) * 100); }
  function rupeesOf(paise) { return (Number(paise) || 0) / 100; }
  function formatINR(rupees) {
    var n = Number(rupees) || 0;
    var sign = n < 0 ? '-' : '';
    return sign + '₹' + Math.abs(n).toLocaleString('en-IN', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2
    });
  }
  // Signed rupee string with a trailing 2-decimal only when paise exist.
  function moneyPlain(paise) {
    var r = rupeesOf(paise);
    return (Math.abs(r * 100 - Math.round(r) * 100) < 0.005)
      ? Math.round(r)
      : Number(r.toFixed(2));
  }

  /* ---------------------- Init ---------------------- */
  function initBillingPage() {
    if (listenersAttached) return;
    var search = document.getElementById('billing-search');
    if (!search) return; // billing section not present on this page
    listenersAttached = true;

    // POS autocomplete search: type -> dropdown, arrows -> navigate, Enter -> add.
    search.addEventListener('input', onSearchInput);
    search.addEventListener('keydown', onSearchKeydown);
    search.addEventListener('focus', function () {
      if (search.value.trim()) { runSearch(); openDropdown(); }
    });
    search.addEventListener('blur', function () { setTimeout(closeDropdown, 120); });

    // Add on mouse/touch: mousedown fires before the input blur so the click
    // reliably registers before the dropdown closes.
    var dropdown = document.getElementById('billing-search-dropdown');
    if (dropdown) dropdown.addEventListener('mousedown', function (e) {
      var item = e.target.closest('[data-result-index]');
      if (item) { e.preventDefault(); addResultByIndex(parseInt(item.getAttribute('data-result-index'), 10)); }
    });

    // Dismiss the dropdown when clicking anywhere outside the search area.
    document.addEventListener('click', function (e) {
      var wrap = document.querySelector('.billing-search-wrap');
      if (wrap && !wrap.contains(e.target)) closeDropdown();
    });

    var discount = document.getElementById('bill-discount');
    var received = document.getElementById('bill-received');
    if (discount) discount.addEventListener('input', recalcBillTotals);
    if (received) received.addEventListener('input', recalcBillTotals);

    ensurePreviewModal();
  }

  // Called from js/admin.js showDashboardSection('billing').
  function renderBillingSection() {
    initBillingPage();
    bindProductSnapshots();
    updateBillDateTime();
    clearSearch();
    loadBillingSettings().then(function () {
      populateSettingsForm();
      renderCart();
      recalcBillTotals();
      refreshInvoiceNumberPreview();
    });
  }

  /* ---------------------- Data binding ---------------------- */
  function bindProductSnapshots() {
    if (productsBound || !window.db) return;
    productsBound = true;
    try {
      window.db.collection('products').onSnapshot(function (snap) {
        billingProducts = snap.docs.map(function (d) { return Object.assign({ docId: d.id }, d.data()); });
        refreshDropdownIfOpen();
      }, function (err) {
        console.error('[Billing] products listener failed', err);
        productsBound = false;
      });

      window.db.collection('categories').onSnapshot(function (snap) {
        // Categories stay loaded so each result can show its category name —
        // only the standalone category FILTER dropdown was removed from billing.
        billingCategories = snap.docs.map(function (d) { return Object.assign({ id: d.id }, d.data()); });
      }, function () { /* categories optional */ });
    } catch (e) {
      console.error('[Billing] snapshot bind error', e);
      productsBound = false;
    }
  }

  /* ---------------------- Product search autocomplete ---------------------- */
  var searchResults = [];   // matched products for the current term
  var highlightIndex = -1;  // keyboard-highlighted row (0-based into searchResults)

  function isDropdownOpen() {
    var dropdown = document.getElementById('billing-search-dropdown');
    return !!(dropdown && dropdown.style.display === 'block');
  }

  function clearSearch() {
    var search = document.getElementById('billing-search');
    if (search) search.value = '';
    searchResults = [];
    highlightIndex = -1;
    closeDropdown();
  }

  function refreshDropdownIfOpen() {
    var search = document.getElementById('billing-search');
    if (search && search === document.activeElement && search.value.trim()) {
      runSearch();
      openDropdown();
    }
  }

  function onSearchInput() {
    var search = document.getElementById('billing-search');
    if (!search) return;
    if (!search.value.trim()) { searchResults = []; highlightIndex = -1; closeDropdown(); return; }
    runSearch();
    openDropdown();
  }

  function runSearch() {
    var search = document.getElementById('billing-search');
    var term = (search ? search.value : '').trim().toLowerCase();
    searchResults = searchProducts(term);
    highlightIndex = searchResults.length ? 0 : -1; // first result highlighted by default
    renderSearchDropdown();
  }

  function searchProducts(term) {
    if (!term) return [];
    var matches = billingProducts.filter(function (p) {
      var code = String(p.id || p.docId || '').toLowerCase();
      var name = String(p.name || '').toLowerCase();
      return name.indexOf(term) !== -1 || code.indexOf(term) !== -1;
    });
    // Prefix matches first, then alphabetical — most relevant stays on top.
    matches.sort(function (a, b) {
      var an = String(a.name || ''), bn = String(b.name || '');
      var aStarts = an.toLowerCase().indexOf(term) === 0 ? 0 : 1;
      var bStarts = bn.toLowerCase().indexOf(term) === 0 ? 0 : 1;
      if (aStarts !== bStarts) return aStarts - bStarts;
      return an.localeCompare(bn);
    });
    return matches.slice(0, 30);
  }

  function renderSearchDropdown() {
    var dropdown = document.getElementById('billing-search-dropdown');
    if (!dropdown) return;
    if (!billingProducts.length) {
      dropdown.innerHTML = '<div class="billing-search-msg">Loading products&hellip;</div>';
      return;
    }
    if (!searchResults.length) {
      dropdown.innerHTML = '<div class="billing-search-msg">No products found</div>';
      return;
    }
    dropdown.innerHTML = searchResults.map(function (p, i) {
      var code = escapeHtml(String(p.id || p.docId || ''));
      var name = escapeHtml(p.name || '');
      var catName = categoryName(p.categoryId);
      var price = Number(p.price) || 0;
      var enabled = p.inStock !== false; // inStock boolean = enable/disable for billing only
      var cls = 'billing-search-item' + (i === highlightIndex ? ' active' : '') + (enabled ? '' : ' is-disabled');
      var meta = '#' + code + (catName ? ' \u00b7 ' + escapeHtml(catName) : '');
      return '' +
        '<div class="' + cls + '" data-result-index="' + i + '" role="option" aria-selected="' + (i === highlightIndex) + '">' +
          '<div class="billing-search-item-main">' +
            '<span class="billing-search-item-name">' + name + '</span>' +
            '<span class="billing-search-item-meta">' + meta + '</span>' +
          '</div>' +
          '<span class="billing-search-item-price">' + formatINR(price) + '</span>' +
          (enabled ? '' : '<span class="billing-badge-disabled">Disabled</span>') +
        '</div>';
    }).join('');
  }

  function openDropdown() {
    var dropdown = document.getElementById('billing-search-dropdown');
    var search = document.getElementById('billing-search');
    if (!dropdown) return;
    dropdown.style.display = 'block';
    if (search) search.setAttribute('aria-expanded', 'true');
    scrollHighlightIntoView();
  }

  function closeDropdown() {
    var dropdown = document.getElementById('billing-search-dropdown');
    var search = document.getElementById('billing-search');
    if (dropdown) dropdown.style.display = 'none';
    if (search) search.setAttribute('aria-expanded', 'false');
  }

  function moveHighlight(delta) {
    if (!searchResults.length) return;
    highlightIndex = (highlightIndex + delta + searchResults.length) % searchResults.length;
    renderSearchDropdown();
    scrollHighlightIntoView();
  }

  function scrollHighlightIntoView() {
    var dropdown = document.getElementById('billing-search-dropdown');
    if (!dropdown) return;
    var active = dropdown.querySelector('.billing-search-item.active');
    if (active) active.scrollIntoView({ block: 'nearest' });
  }

  function addResultByIndex(i) {
    var product = searchResults[i];
    if (!product) return;
    if (product.inStock === false) {
      showAdminToast('"' + (product.name || '') + '" is disabled for billing.', 'error');
      return;
    }
    addToCart(product);
    clearSearch();                 // clear input + hide dropdown
    var search = document.getElementById('billing-search');
    if (search) search.focus();    // ready for the next product immediately
  }

  function onSearchKeydown(e) {
    // Never let the search box submit any surrounding form.
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (!isDropdownOpen()) { runSearch(); openDropdown(); }
      else moveHighlight(1);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (isDropdownOpen()) moveHighlight(-1);
    } else if (e.key === 'Enter') {
      e.preventDefault();          // add exactly one item; block form submission
      if (isDropdownOpen() && highlightIndex >= 0 && searchResults[highlightIndex]) {
        addResultByIndex(highlightIndex);
      } else if (searchResults.length) {
        addResultByIndex(0);
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      closeDropdown();
    }
  }

  function categoryName(id) {
    var c = billingCategories.filter(function (x) { return String(x.id) === String(id); })[0];
    return c ? (c.name || c.id) : '';
  }

  /* ---------------------- Cart ---------------------- */
  function addToCart(product) {
    var code = String(product.id || product.docId || '');
    var existing = cart.filter(function (i) { return i.productId === code; })[0];
    if (existing) {
      existing.qty += 1;
    } else {
      // RATE column = product.originalPrice (MRP, falls back to price).
      // FINAL RATE column = product.price (the discounted per-unit selling price).
      // Discount is never entered manually: Discount = RATE - FINAL RATE.
      var origPU = Number(product.originalPrice) || Number(product.price) || 0;
      var finalPU = Math.min(Number(product.price) || 0, origPU);
      cart.push({
        productId: code,
        code: code,
        name: product.name || '',
        unitPrice: origPU,
        finalUnitPrice: finalPU,
        qty: 1,
        discountPerUnit: Math.round((origPU - finalPU) * 100) / 100
      });
    }
    renderCart();
    recalcBillTotals();
    scrollCartRowIntoView(code);   // reveal the newly added / updated row
  }

  function changeQty(index, delta) {
    if (!cart[index]) return;
    cart[index].qty = Math.max(1, (cart[index].qty || 1) + delta);
    syncLineDiscount(index);
    renderCart();
    recalcBillTotals();
  }

  // Keep the derived per-unit discount in sync: Discount = RATE - FINAL RATE.
  // Both prices come from the product record; nothing here is user-editable.
  function syncLineDiscount(index) {
    var item = cart[index];
    if (!item) return;
    var orig = item.unitPrice || 0;
    var final = (typeof item.finalUnitPrice === 'number') ? item.finalUnitPrice : orig;
    if (final < 0) final = 0;
    if (final > orig) final = orig;
    item.finalUnitPrice = final;
    item.discountPerUnit = Math.round((orig - final) * 100) / 100;
  }

  function removeCartItem(index) {
    cart.splice(index, 1);
    renderCart();
    recalcBillTotals();
  }

  function renderCart() {
    var body = document.getElementById('billing-cart-body');
    if (!body) return;
    if (!cart.length) {
      body.innerHTML = '<tr class="billing-cart-empty"><td colspan="8">No items added yet.</td></tr>';
      return;
    }
    body.innerHTML = cart.map(function (item, i) {
      syncLineDiscount(i);                                // guarantee Rate - Final consistency
      var discPU = item.discountPerUnit || 0;
      var finalUnitPaise = toPaise(item.unitPrice) - toPaise(discPU); // per-unit selling price
      var amountPaise = finalUnitPaise * item.qty;                    // Amount = Final Rate x Qty
      var rateCell = discPU > 0
        ? '<span class="billing-cart-strike">' + formatINR(item.unitPrice) + '</span>'
        : formatINR(item.unitPrice);
      var nameCell = escapeHtml(item.name) + (item.code ? ' (' + escapeHtml(item.code) + ')' : '');
      return '' +
        '<tr data-cart-code="' + escapeHtml(item.code) + '">' +
          '<td class="billing-cart-sno">' + (i + 1) + '</td>' +
          '<td class="billing-cart-name">' + nameCell + '</td>' +
          '<td class="billing-cart-center">' + rateCell + '</td>' +
          '<td class="billing-cart-center billing-cart-disc-cell">' + formatINR(discPU) + '</td>' +
          '<td class="billing-cart-qty-cell">' +
            '<span class="billing-qty-control">' +
              '<button type="button" data-qty="dec" data-i="' + i + '" aria-label="Decrease quantity">&minus;</button>' +
              '<span class="billing-qty-value">' + item.qty + '</span>' +
              '<button type="button" data-qty="inc" data-i="' + i + '" aria-label="Increase quantity">+</button>' +
            '</span>' +
          '</td>' +
          '<td class="billing-cart-center billing-cart-final">' + formatINR(rupeesOf(finalUnitPaise)) + '</td>' +
          '<td class="billing-cart-center billing-cart-amount">' + formatINR(rupeesOf(amountPaise)) + '</td>' +
          '<td class="billing-cart-action"><button type="button" class="billing-cart-remove" data-remove="' + i + '" title="Remove">&times;</button></td>' +
        '</tr>';
    }).join('');

    bindCartEvents(body);
  }

  // Reveal the just-added (or quantity-updated) cart row. Now that the billing
  // panel is full width (single column), the scroll container is the admin
  // .main-content; scrollIntoView with block:'nearest' moves only the minimum
  // needed and never jumps the whole page or the top nav / search.
  function scrollCartRowIntoView(code) {
    var body = document.getElementById('billing-cart-body');
    if (!body) return;
    var sel = (window.CSS && CSS.escape) ? CSS.escape(code) : String(code).replace(/["\\]/g, '\\$&');
    var row = body.querySelector('tr[data-cart-code="' + sel + '"]');
    if (!row) return;
    requestAnimationFrame(function () {
      try { row.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' }); }
      catch (e) { row.scrollIntoView(false); }
    });
  }

  function bindCartEvents(body) {
    Array.prototype.forEach.call(body.querySelectorAll('[data-qty]'), function (btn) {
      btn.addEventListener('click', function () {
        var i = parseInt(btn.getAttribute('data-i'), 10);
        changeQty(i, btn.getAttribute('data-qty') === 'inc' ? 1 : -1);
      });
    });
    // Qty is changed ONLY via the +/- buttons; every other cell is plain text.
    Array.prototype.forEach.call(body.querySelectorAll('[data-remove]'), function (btn) {
      btn.addEventListener('click', function () { removeCartItem(parseInt(btn.getAttribute('data-remove'), 10)); });
    });
  }

  /* ---------------------- Totals ---------------------- */
  function computeTotals() {
    var subtotalPaise = 0;     // gross before any discount
    var itemsDiscPaise = 0;
    cart.forEach(function (item) {
      var lineSub = toPaise(item.unitPrice) * item.qty;
      var discPU = Math.min(toPaise(item.discountPerUnit || 0), toPaise(item.unitPrice)); // per-unit cap
      subtotalPaise += lineSub;
      itemsDiscPaise += discPU * item.qty;
    });

    var billDiscPaise = Math.min(
      toPaise((document.getElementById('bill-discount') || {}).value || 0),
      Math.max(0, subtotalPaise - itemsDiscPaise)
    );
    var discountTotalPaise = itemsDiscPaise + billDiscPaise;
    var taxablePaise = subtotalPaise - discountTotalPaise;

    var taxEnabled = billingSettings && billingSettings.taxEnabled;
    var taxRate = taxEnabled ? (Number(billingSettings.taxRate) || 0) : 0;
    var taxPaise = taxEnabled ? Math.round(taxablePaise * taxRate / 100) : 0;

    var preRoundPaise = taxablePaise + taxPaise;
    var grandPaise = Math.round(preRoundPaise / 100) * 100;   // round to nearest rupee
    var roundOffPaise = grandPaise - preRoundPaise;

    var receivedPaise = Math.max(0, toPaise((document.getElementById('bill-received') || {}).value || 0));
    var balancePaise = grandPaise - receivedPaise;             // >0 = still owed, <0 = change
    var changePaise = balancePaise < 0 ? -balancePaise : 0;
    if (balancePaise < 0) balancePaise = 0;

    var paymentStatus;
    if (grandPaise <= 0) paymentStatus = 'Paid';
    else if (receivedPaise <= 0) paymentStatus = 'Unpaid';
    else if (receivedPaise >= grandPaise) paymentStatus = 'Paid';
    else paymentStatus = 'Partially Paid';

    return {
      subtotalPaise: subtotalPaise,
      itemsDiscPaise: itemsDiscPaise,
      billDiscPaise: billDiscPaise,
      discountTotalPaise: discountTotalPaise,
      taxablePaise: taxablePaise,
      taxEnabled: taxEnabled,
      taxRate: taxRate,
      taxPaise: taxPaise,
      preRoundPaise: preRoundPaise,
      grandPaise: grandPaise,
      roundOffPaise: roundOffPaise,
      receivedPaise: receivedPaise,
      balancePaise: balancePaise,
      changePaise: changePaise,
      paymentStatus: paymentStatus
    };
  }

  function recalcBillTotals() {
    var t = computeTotals();
    setText('bill-subtotal', formatINR(rupeesOf(t.subtotalPaise)));
    setText('bill-discount-total', '\u2212 ' + formatINR(rupeesOf(t.discountTotalPaise)));

    var taxRow = document.getElementById('bill-tax-row');
    if (taxRow) taxRow.style.display = t.taxEnabled ? 'flex' : 'none';
    setText('bill-tax', formatINR(rupeesOf(t.taxPaise)));

    var ro = document.getElementById('bill-roundoff');
    if (ro) {
      ro.textContent = (t.roundOffPaise === 0 ? '₹0' : (t.roundOffPaise > 0 ? '+ ' : '\u2212 ') + formatINR(Math.abs(rupeesOf(t.roundOffPaise))));
      ro.classList.toggle('billing-roundoff-neg', t.roundOffPaise < 0);
    }
    setText('bill-grand-total', formatINR(rupeesOf(t.grandPaise)));

    var balLabel = document.getElementById('bill-balance-label');
    if (balLabel) balLabel.textContent = t.changePaise > 0 ? 'Change to return' : 'Balance due';
    setText('bill-balance', formatINR(rupeesOf(t.changePaise > 0 ? t.changePaise : t.balancePaise)));
  }

  /* ---------------------- Invoice model ---------------------- */
  function buildInvoiceModel() {
    var t = computeTotals();
    var now = new Date();
    var method = (document.getElementById('bill-payment-method') || {}).value || 'Cash';
    var user = window.adminAuth && window.adminAuth.currentUser;
    return {
      invoiceNumber: null, // stamped on save
      docId: null,
      date: now,
      createdBy: user ? (user.email || user.uid) : 'admin',
      createdByUid: user ? user.uid : null,
      shop: {
        name: billingSettings.shopName,
        address: billingSettings.shopAddress,
        phone: billingSettings.shopPhone,
        gstin: billingSettings.gstin,
        logo: billingSettings.logoPath
      },
      customer: {
        name: (document.getElementById('bill-cust-name') || {}).value || '',
        mobile: (document.getElementById('bill-cust-mobile') || {}).value || '',
        address: (document.getElementById('bill-cust-address') || {}).value || '',
        gstin: (document.getElementById('bill-cust-gstin') || {}).value || ''
      },
      items: cart.map(function (item) {
        syncLineDiscount(cart.indexOf(item));
        var discPU = Math.min(item.discountPerUnit || 0, item.unitPrice);
        var finalUnitPaise = toPaise(item.unitPrice) - toPaise(discPU);
        var finalPaise = finalUnitPaise * item.qty;
        return {
          productId: item.productId,
          name: item.name,
          code: item.code,
          unitPrice: item.unitPrice,                 // ORIGINAL unit rate snapshot
          finalRate: rupeesOf(finalUnitPaise),        // discounted per-unit selling price
          qty: item.qty,
          discountPerUnit: discPU,                    // per-unit rupee discount
          discountTotal: rupeesOf(toPaise(discPU) * item.qty),
          lineTotal: rupeesOf(finalPaise)             // Amount = (Rate - Disc/unit) x Qty
        };
      }),
      totals: t,
      paymentMethod: method,
      txnRef: (document.getElementById('bill-txn-ref') || {}).value || '',
      amountReceived: rupeesOf(t.receivedPaise),
      paymentStatus: t.paymentStatus,
      invoiceStatus: 'ACTIVE'
    };
  }

  function validateBill(model) {
    if (!model.items.length) return { ok: false, msg: 'Add at least one product to the bill.' };
    if (!window.db) return { ok: false, msg: 'Database not ready. Please reload.' };
    for (var i = 0; i < cart.length; i++) {
      var it = cart[i];
      if (!Number.isFinite(it.qty) || it.qty < 1) return { ok: false, msg: 'Invalid quantity for "' + it.name + '".' };
      if (!Number.isFinite(it.unitPrice) || it.unitPrice < 0) return { ok: false, msg: 'Invalid price for "' + it.name + '".' };
      if (!Number.isFinite(it.discountPerUnit) || it.discountPerUnit < 0) return { ok: false, msg: 'Invalid discount for "' + it.name + '".' };
      if (it.discountPerUnit > it.unitPrice) return { ok: false, msg: 'Discount exceeds the rate for "' + it.name + '".' };
    }
    var t = model.totals;
    if (t.grandPaise < 0) return { ok: false, msg: 'Discounts exceed the subtotal.' };
    return { ok: true };
  }

  function buildInvoiceDoc(model, invoiceNumber) {
    var t = model.totals;
    return {
      invoiceNumber: invoiceNumber,
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      createdByUid: model.createdByUid || null,
      createdBy: model.createdBy || 'admin',
      customer: model.customer,
      shop: model.shop,
      items: model.items,
      subtotal: rupeesOf(t.subtotalPaise),
      discountTotal: rupeesOf(t.discountTotalPaise),
      billDiscount: rupeesOf(t.billDiscPaise),
      taxEnabled: t.taxEnabled,
      taxRate: t.taxRate,
      tax: rupeesOf(t.taxPaise),
      roundOff: rupeesOf(t.roundOffPaise),
      grandTotal: rupeesOf(t.grandPaise),
      amountReceived: rupeesOf(t.receivedPaise),
      balanceDue: rupeesOf(t.balancePaise),
      change: rupeesOf(t.changePaise),
      paymentMethod: model.paymentMethod,
      txnRef: model.txnRef || '',
      payments: [{
        method: model.paymentMethod,
        amount: rupeesOf(t.receivedPaise),
        reference: model.txnRef || '',
        // FieldValue.serverTimestamp() is NOT allowed inside arrays (and
        // inside transactions). Use a client-side ISO timestamp here; the
        // top-level createdAt keeps the server-timestamp sentinel.
        at: new Date().toISOString()
      }],
      paymentStatus: model.paymentStatus,
      invoiceStatus: 'ACTIVE'
    };
  }

  /* ---------------------- Save (transactional numbering) ---------------------- */
  function saveBill(printAfter) {
    if (isSubmitting) return;
    var model = buildInvoiceModel();
    var v = validateBill(model);
    if (!v.ok) { showAdminToast(v.msg, 'error'); return; }

    isSubmitting = true;
    setBusy(true);

    var year = new Date().getFullYear();
    var counterRef = window.db.collection('invoice_counters').doc(String(year));
    var invoiceRef = window.db.collection('invoices').doc();
    var invoiceNumber = '';

    window.db.runTransaction(function (tx) {
      return tx.get(counterRef).then(function (snap) {
        var seq = snap.exists ? (Number(snap.data().seq) || 0) : 0;
        seq += 1;
        invoiceNumber = 'KPR-INV-' + year + '-' + String(seq).padStart(6, '0');
        model.invoiceNumber = invoiceNumber;
        var doc = buildInvoiceDoc(model, invoiceNumber);
        tx.set(counterRef, { seq: seq, year: year }, { merge: true });
        tx.set(invoiceRef, doc);
        return invoiceRef.id;
      });
    }).then(function (id) {
      model.docId = id;
      histCache = null; // force history reload next time it's opened
      showAdminToast('Invoice ' + invoiceNumber + ' saved.', 'success');
      if (typeof logActivity === 'function') {
        logActivity('SALE', 'Invoice created', invoiceNumber + ' · ' + formatINR(rupeesOf(model.totals.grandPaise)));
      }
      if (printAfter) {
        openInvoicePreview(model, 'a4', true);
      }
      resetBill();
    }).catch(function (err) {
      console.error('[Billing] save failed', err);
      showAdminToast('Could not save bill: ' + ((err && err.message) ? err.message : 'unknown error'), 'error');
    }).then(function () {
      isSubmitting = false;
      setBusy(false);
    });
  }

  function setBusy(busy) {
    ['bill-save-btn', 'bill-save-print-btn'].forEach(function (id) {
      var el = document.getElementById(id);
      if (el) el.disabled = !!busy;
    });
  }

  function resetBill() {
    cart = [];
    ['bill-cust-name', 'bill-cust-mobile', 'bill-cust-address', 'bill-cust-gstin', 'bill-txn-ref'].forEach(function (id) {
      var el = document.getElementById(id);
      if (el) el.value = '';
    });
    var d = document.getElementById('bill-discount'); if (d) d.value = 0;
    var r = document.getElementById('bill-received'); if (r) r.value = 0;
    var m = document.getElementById('bill-payment-method'); if (m) m.value = 'Cash';
    renderCart();
    recalcBillTotals();
    refreshInvoiceNumberPreview();
    updateBillDateTime();
  }

  function refreshInvoiceNumberPreview() {
    var prev = document.getElementById('bill-invoice-preview');
    if (!prev) return;
    if (!window.db) { prev.textContent = 'Auto on save'; return; }
    var year = new Date().getFullYear();
    window.db.collection('invoice_counters').doc(String(year)).get({ source: 'server' })
      .then(function (s) {
        var seq = s.exists ? (Number(s.data().seq) || 0) : 0;
        prev.textContent = 'KPR-INV-' + year + '-' + String(seq + 1).padStart(6, '0') + ' (auto)';
      })
      .catch(function () { prev.textContent = 'Auto on save'; });
  }

  function updateBillDateTime() {
    var el = document.getElementById('bill-datetime');
    if (!el) return;
    el.textContent = new Date().toLocaleString('en-IN', {
      day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
    });
  }

  /* ---------------------- View switching ---------------------- */
  function switchBillingView(view) {
    currentView = view;
    ['create', 'history', 'settings'].forEach(function (v) {
      var el = document.getElementById('billing-view-' + v);
      if (el) el.style.display = (v === view) ? 'block' : 'none';
    });
    Array.prototype.forEach.call(document.querySelectorAll('.billing-tab'), function (tab) {
      tab.classList.toggle('active', tab.getAttribute('data-billing-view') === view);
    });
    // The Product Search lives in the shared top nav row but is only relevant
    // on the Create Bill view — hide it on Sales History / Billing Settings.
    var searchWrap = document.getElementById('billing-search-wrap');
    if (searchWrap) searchWrap.style.display = (view === 'create') ? '' : 'none';
    if (view !== 'create') closeDropdown();
    if (view === 'create') { updateBillDateTime(); recalcBillTotals(); }
    if (view === 'history') { loadHistory(); }
  }

  /* ---------------------- Preview modal ---------------------- */
  function ensurePreviewModal() {
    if (document.getElementById('billing-preview-backdrop')) return;
    var wrap = document.createElement('div');
    wrap.innerHTML =
      '<div class="billing-preview-backdrop" id="billing-preview-backdrop">' +
        '<div class="billing-preview-shell">' +
          '<div class="billing-preview-toolbar">' +
            '<span class="billing-preview-title">Invoice Preview</span>' +
            '<div class="billing-preview-actions">' +
              '<button type="button" class="btn-admin" onclick="printInvoice(\'a4\')">Print A4</button>' +
              '<button type="button" class="btn-admin" onclick="printInvoice(\'receipt\')">Print 80mm</button>' +
              '<button type="button" class="btn-admin" onclick="downloadInvoicePDF()">Download PDF</button>' +
              '<button type="button" class="btn-admin" onclick="closeInvoicePreview()">Close</button>' +
            '</div>' +
          '</div>' +
          '<div id="invoice-print-area"></div>' +
        '</div>' +
      '</div>';
    document.body.appendChild(wrap.firstChild);
  }

  function openInvoicePreview(model, mode, autoPrint) {
    _previewModel = model;
    _previewMode = mode || 'a4';
    var backdrop = document.getElementById('billing-preview-backdrop');
    var area = document.getElementById('invoice-print-area');
    if (!backdrop || !area) return;
    area.innerHTML = buildInvoiceHTML(model, _previewMode);
    backdrop.classList.add('open');
    if (autoPrint) {
      setTimeout(function () { printInvoice(_previewMode); }, 150);
    }
  }

  function closeInvoicePreview() {
    var backdrop = document.getElementById('billing-preview-backdrop');
    if (backdrop) backdrop.classList.remove('open');
    document.body.classList.remove('printing-receipt-80');
  }

  function printInvoice(mode) {
    if (!_previewModel) return;
    _previewMode = mode || _previewMode;
    var area = document.getElementById('invoice-print-area');
    if (area) area.innerHTML = buildInvoiceHTML(_previewModel, _previewMode);
    document.body.classList.toggle('printing-receipt-80', _previewMode === 'receipt');
    var cleanup = function () { document.body.classList.remove('printing-receipt-80'); };
    window.addEventListener('afterprint', cleanup, { once: true });
    window.print();
    setTimeout(cleanup, 1500); // fallback if afterprint never fires
  }

  function previewDraftInvoice() {
    var model = buildInvoiceModel();
    var v = validateBill(model);
    if (!v.ok) { showAdminToast(v.msg, 'error'); return; }
    if (!model.invoiceNumber) model.invoiceNumber = 'DRAFT (unsaved)';
    openInvoicePreview(model, 'a4', false);
  }

  // "Download PDF" on the full-width billing panel: exports the current (draft)
  // bill straight to PDF without saving, using the same validated totals.
  function downloadDraftPDF() {
    var model = buildInvoiceModel();
    var v = validateBill(model);
    if (!v.ok) { showAdminToast(v.msg, 'error'); return; }
    if (!model.invoiceNumber) model.invoiceNumber = 'DRAFT';
    generateInvoicePDF(model);
  }

  /* ---------------------- Invoice HTML (light template) ---------------------- */
  function buildInvoiceHTML(model, mode) {
    var t = model.totals;
    var cls = mode === 'receipt' ? 'invoice-doc receipt' : 'invoice-doc a4';
    var shop = model.shop || {};
    var cust = model.customer || {};
    var dt = model.date instanceof Date ? model.date : new Date();
    var dateStr = dt.toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });

    var logo = shop.logo
      ? '<img class="invoice-logo" src="' + escapeHtml(shop.logo) + '" alt="">'
      : '';

    var itemRows = model.items.map(function (it, idx) {
      var nameCell = escapeHtml(it.name) + (it.code ? ' (' + escapeHtml(it.code) + ')' : '');
      var dpu = (typeof it.discountPerUnit === 'number') ? it.discountPerUnit : 0;
      return '<tr>' +
        '<td class="num">' + (idx + 1) + '</td>' +
        '<td class="strong-col">' + nameCell + '</td>' +
        '<td class="num">' + formatINR(it.unitPrice) + '</td>' +
        '<td class="num">' + formatINR(dpu) + '</td>' +
        '<td class="num">' + it.qty + '</td>' +
        '<td class="num">' + formatINR(it.lineTotal) + '</td>' +
      '</tr>';
    }).join('');

    var taxRow = t.taxEnabled
      ? '<tr><td>GST @ ' + (t.taxRate || 0) + '%</td><td>' + formatINR(rupeesOf(t.taxPaise)) + '</td></tr>'
      : '';
    var roundRow = t.roundOffPaise !== 0
      ? '<tr><td>Round off</td><td>' + (t.roundOffPaise > 0 ? '+ ' : '\u2212 ') + formatINR(Math.abs(rupeesOf(t.roundOffPaise))) + '</td></tr>'
      : '';

    var payExtra = '';
    if (t.receivedPaise > 0 && t.changePaise > 0) {
      payExtra = '<tr><td>Change to return</td><td>' + formatINR(rupeesOf(t.changePaise)) + '</td></tr>';
    } else if (t.balancePaise > 0) {
      payExtra = '<tr><td>Balance due</td><td>' + formatINR(rupeesOf(t.balancePaise)) + '</td></tr>';
    }

    return '' +
    '<div class="' + cls + '">' +
      '<div class="invoice-header">' +
        '<div class="invoice-brand">' + logo +
          '<div>' +
            '<div class="invoice-shop-name">' + escapeHtml(shop.name || 'KPR Crackers') + '</div>' +
            (shop.address ? '<div class="invoice-shop-meta">' + escapeHtml(shop.address) + '</div>' : '') +
            (shop.phone ? '<div class="invoice-shop-meta">Ph: ' + escapeHtml(shop.phone) + '</div>' : '') +
            (shop.gstin ? '<div class="invoice-shop-meta">GSTIN: ' + escapeHtml(shop.gstin) + '</div>' : '') +
          '</div>' +
        '</div>' +
        '<div class="invoice-title-block">' +
          '<div class="invoice-doc-title">Tax Invoice</div>' +
          '<div class="invoice-num">' + escapeHtml(model.invoiceNumber || '') + '</div>' +
          '<div class="invoice-date">' + escapeHtml(dateStr) + '</div>' +
        '</div>' +
      '</div>' +

      '<div class="invoice-parties">' +
        '<div class="invoice-party">' +
          '<h4>Billed To</h4>' +
          '<p><strong>' + escapeHtml(cust.name || 'Walk-in Customer') + '</strong></p>' +
          (cust.mobile ? '<p>' + escapeHtml(cust.mobile) + '</p>' : '') +
          (cust.address ? '<p>' + escapeHtml(cust.address) + '</p>' : '') +
          (cust.gstin ? '<p>GSTIN: ' + escapeHtml(cust.gstin) + '</p>' : '') +
        '</div>' +
        '<div class="invoice-party">' +
          '<h4>Payment</h4>' +
          '<p>Method: ' + escapeHtml(model.paymentMethod || 'Cash') + '</p>' +
          '<p>Status: ' + escapeHtml(model.paymentStatus || '') + '</p>' +
          (model.txnRef ? '<p>Ref: ' + escapeHtml(model.txnRef) + '</p>' : '') +
        '</div>' +
      '</div>' +

      '<table class="invoice-items">' +
        '<thead><tr><th class="num">No.</th><th>Item &amp; Code</th><th class="num">Rate</th><th class="num">Disc.</th><th class="num">Qty</th><th class="num">Amount</th></tr></thead>' +
        '<tbody>' + itemRows + '</tbody>' +
      '</table>' +

      '<div class="invoice-totals">' +
        '<table class="invoice-totals-table">' +
          '<tr><td>Subtotal</td><td>' + formatINR(rupeesOf(t.subtotalPaise)) + '</td></tr>' +
          '<tr><td>Discount</td><td>\u2212 ' + formatINR(rupeesOf(t.discountTotalPaise)) + '</td></tr>' +
          taxRow + roundRow +
          '<tr class="grand"><td>Grand Total</td><td>' + formatINR(rupeesOf(t.grandPaise)) + '</td></tr>' +
          '<tr><td>Amount received</td><td>' + formatINR(rupeesOf(t.receivedPaise)) + '</td></tr>' +
          payExtra +
        '</table>' +
      '</div>' +

      '<div class="invoice-amount-words">Amount in words: <strong>' + escapeHtml(numberToWordsINR(rupeesOf(t.grandPaise))) + '</strong></div>' +

      '<div class="invoice-footer">' +
        '<div class="invoice-thanks">Thank you for shopping at ' + escapeHtml(shop.name || 'KPR Crackers') + '!</div>' +
        '<div class="invoice-signature"><div class="sig-line"></div><span>Authorized Signatory</span></div>' +
      '</div>' +
    '</div>';
  }

  /* ---------------------- PDF export (jsPDF + autotable) ---------------------- */
  function downloadInvoicePDF() {
    if (!_previewModel) return;
    generateInvoicePDF(_previewModel);
  }

  function generateInvoicePDF(model) {
    if (!window.jspdf || !window.jspdf.jsPDF) {
      showAdminToast('PDF library not loaded. Check connection and reload.', 'error');
      return;
    }
    try {
      var t = model.totals;
      var shop = model.shop || {};
      var cust = model.customer || {};
      var dt = model.date instanceof Date ? model.date : new Date();
      var dateStr = dt.toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
      var doc = new window.jspdf.jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });
      var m = 14, W = 210;
      var y = m + 6;

      doc.setFont('helvetica', 'bold'); doc.setFontSize(16); doc.setTextColor(10, 92, 54);
      doc.text(shop.name || 'KPR Crackers', m, y);
      doc.setTextColor(60); doc.setFont('helvetica', 'normal'); doc.setFontSize(9);
      if (shop.address) { var addr = doc.splitTextToSize(shop.address, 110); doc.text(addr, m, y + 5); y += addr.length * 4; }
      if (shop.phone) doc.text('Ph: ' + shop.phone, m, y + 4);
      if (shop.gstin) doc.text('GSTIN: ' + shop.gstin, m, y + 8);

      doc.setFont('helvetica', 'bold'); doc.setFontSize(13); doc.setTextColor(30);
      doc.text('TAX INVOICE', W - m, m + 6, { align: 'right' });
      doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(90);
      doc.text(model.invoiceNumber || '', W - m, m + 12, { align: 'right' });
      doc.text(dateStr, W - m, m + 16, { align: 'right' });

      y = Math.max(y + 14, m + 26);
      doc.setFontSize(9); doc.setTextColor(60);
      doc.text('Billed To: ' + (cust.name || 'Walk-in Customer'), m, y);
      if (cust.mobile || cust.address) doc.text([cust.mobile, cust.address].filter(Boolean).join('  '), m, y + 4);

      var head = [['No.', 'Item & Code', 'Rate', 'Disc./unit', 'Qty', 'Amount']];
      var body = model.items.map(function (it, idx) {
        var dpu = (typeof it.discountPerUnit === 'number') ? it.discountPerUnit : 0;
        return [String(idx + 1), String(it.name) + (it.code ? ' (' + it.code + ')' : ''),
          moneyPlain(toPaise(it.unitPrice)), moneyPlain(toPaise(dpu)), String(it.qty),
          moneyPlain(toPaise(it.lineTotal))];
      });

      doc.autoTable({
        startY: y + 9,
        head: head,
        body: body,
        theme: 'striped',
        styles: { fontSize: 9, cellPadding: 2.5 },
        headStyles: { fillColor: [10, 92, 54], textColor: 255 },
        columnStyles: {
          0: { halign: 'center', cellWidth: 10 },
          2: { halign: 'right', cellWidth: 22 },
          3: { halign: 'right', cellWidth: 24 },
          4: { halign: 'right', cellWidth: 14 },
          5: { halign: 'right', cellWidth: 28 }
        }
      });

      var ry = doc.lastAutoTable.finalY + 6;
      function line(label, val, bold) {
        doc.setFont('helvetica', bold ? 'bold' : 'normal');
        doc.setFontSize(bold ? 11 : 9);
        doc.setTextColor(bold ? 10 : 90, bold ? 92 : 90, bold ? 54 : 90);
        doc.text(label, W - m - 55, ry);
        doc.text(val, W - m, ry, { align: 'right' });
        ry += bold ? 7 : 5;
      }
      line('Subtotal', formatINR(rupeesOf(t.subtotalPaise)));
      line('Discount', '- ' + formatINR(rupeesOf(t.discountTotalPaise)));
      if (t.taxEnabled) line('GST @ ' + (t.taxRate || 0) + '%', formatINR(rupeesOf(t.taxPaise)));
      if (t.roundOffPaise !== 0) line('Round off', (t.roundOffPaise > 0 ? '+ ' : '- ') + formatINR(Math.abs(rupeesOf(t.roundOffPaise))));
      line('Grand Total', formatINR(rupeesOf(t.grandPaise)), true);
      line('Payment: ' + (model.paymentMethod || 'Cash') + '  (' + (model.paymentStatus || '') + ')', '');
      line('Amount received', formatINR(rupeesOf(t.receivedPaise)));
      if (t.changePaise > 0) line('Change to return', formatINR(rupeesOf(t.changePaise)));
      else if (t.balancePaise > 0) line('Balance due', formatINR(rupeesOf(t.balancePaise)));

      doc.setFont('helvetica', 'italic'); doc.setFontSize(8); doc.setTextColor(90);
      doc.text('Amount in words: ' + numberToWordsINR(rupeesOf(t.grandPaise)), m, ry + 2);

      var baseY = Math.max(ry + 16, 250);
      doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(60);
      doc.text('Thank you for shopping at ' + (shop.name || 'KPR Crackers') + '!', m, baseY);
      doc.setDrawColor(120); doc.line(W - m - 45, baseY, W - m, baseY);
      doc.text('Authorized Signatory', W - m - 45, baseY + 4);

      doc.save((model.invoiceNumber ? String(model.invoiceNumber).replace(/[^A-Za-z0-9_-]+/g, '') : 'invoice') + '.pdf');
    } catch (err) {
      console.error('[Billing] PDF failed', err);
      showAdminToast('PDF export failed: ' + ((err && err.message) ? err.message : 'error'), 'error');
    }
  }

  /* ---------------------- Sales history ---------------------- */
  function loadHistory(force) {
    if (!window.db) { renderHistory(); return Promise.resolve(); }
    if (histCache && !force) { applyHistoryFilters(); renderHistory(); return Promise.resolve(); }
    return window.db.collection('invoices')
      .orderBy('createdAt', 'desc')
      .limit(HIST_MAX_LOAD)
      .get({ source: 'server' })
      .then(function (snap) {
        histCache = snap.docs.map(function (d) { return docToModel(d.id, d.data()); });
        applyHistoryFilters();
        renderHistory();
      })
      .catch(function (err) {
        console.error('[Billing] history load failed', err);
        var body = document.getElementById('billing-history-body');
        if (body) body.innerHTML = '<tr><td colspan="9" class="text-center">Failed to load invoices.</td></tr>';
      });
  }

  function docToModel(id, data) {
    var d = data || {};
    var createdAt = (d.createdAt && typeof d.createdAt.toDate === 'function') ? d.createdAt.toDate() : null;
    var items = Array.isArray(d.items) ? d.items : [];
    var sub = toPaise(d.subtotal);
    var discTotal = toPaise(d.discountTotal);
    var taxP = toPaise(d.tax);
    var grandP = toPaise(d.grandTotal);
    var recvP = toPaise(d.amountReceived);
    var balP = toPaise(d.balanceDue);
    var chgP = toPaise(d.change);
    var roundP = toPaise(d.roundOff);
    return {
      docId: id,
      invoiceNumber: d.invoiceNumber || '',
      date: createdAt || new Date(),
      createdBy: d.createdBy || 'admin',
      shop: d.shop || {},
      customer: d.customer || {},
      items: items.map(function (it) {
        var unit = Number(it.unitPrice) || 0;
        var qty = Number(it.qty) || 0;
        var dpu, dTotal;
        if (typeof it.discountPerUnit === 'number') {
          dpu = it.discountPerUnit;
          dTotal = (typeof it.discountTotal === 'number') ? it.discountTotal : dpu * qty;
        } else {
          // Legacy invoices: `lineDiscount` was the TOTAL discount for the line.
          dTotal = Number(it.lineDiscount) || 0;
          dpu = qty > 0 ? dTotal / qty : 0;
        }
        var lineTotal = (typeof it.lineTotal === 'number') ? it.lineTotal : (unit - dpu) * qty;
        return {
          productId: it.productId, name: it.name, code: it.code,
          unitPrice: unit, qty: qty,
          discountPerUnit: dpu, discountTotal: dTotal, lineTotal: lineTotal
        };
      }),
      totals: {
        subtotalPaise: sub, itemsDiscPaise: 0, billDiscPaise: toPaise(d.billDiscount),
        discountTotalPaise: discTotal, taxablePaise: sub - discTotal,
        taxEnabled: !!d.taxEnabled, taxRate: Number(d.taxRate) || 0, taxPaise: taxP,
        preRoundPaise: sub - discTotal + taxP, grandPaise: grandP, roundOffPaise: roundP,
        receivedPaise: recvP, balancePaise: balP, changePaise: chgP,
        paymentStatus: d.paymentStatus || ''
      },
      paymentMethod: d.paymentMethod || 'Cash',
      txnRef: d.txnRef || '',
      amountReceived: rupeesOf(recvP),
      paymentStatus: d.paymentStatus || '',
      invoiceStatus: d.invoiceStatus || 'ACTIVE'
    };
  }

  function applyHistoryFilters() {
    if (!histCache) { histFiltered = []; return; }
    var term = ((document.getElementById('history-search') || {}).value || '').trim().toLowerCase();
    var from = (document.getElementById('history-from') || {}).value;
    var to = (document.getElementById('history-to') || {}).value;
    var pay = (document.getElementById('history-payfilter') || {}).value || '';

    var fromT = from ? new Date(from + 'T00:00:00').getTime() : null;
    var toT = to ? new Date(to + 'T23:59:59').getTime() : null;

    histFiltered = histCache.filter(function (m) {
      if (pay && m.paymentStatus !== pay) return false;
      if (fromT && m.date.getTime() < fromT) return false;
      if (toT && m.date.getTime() > toT) return false;
      if (term) {
        var hay = (m.invoiceNumber + ' ' + (m.customer.name || '')).toLowerCase();
        if (hay.indexOf(term) === -1) return false;
      }
      return true;
    });
    histPage = 0;
  }

  function renderHistory() {
    var body = document.getElementById('billing-history-body');
    if (!body) return;
    if (!histCache) {
      body.innerHTML = '<tr><td colspan="9" class="text-center">Loading invoices&hellip;</td></tr>';
      return;
    }
    if (!histFiltered.length) {
      body.innerHTML = '<tr><td colspan="9" class="text-center">No invoices match your filters.</td></tr>';
      updateHistoryPagination();
      return;
    }
    var start = histPage * HIST_PAGE_SIZE;
    var slice = histFiltered.slice(start, start + HIST_PAGE_SIZE);
    body.innerHTML = slice.map(function (m, idx) {
      var cust = (m.customer.name || 'Walk-in') + (m.customer.mobile ? ' · ' + m.customer.mobile : '');
      var statusCls = m.paymentStatus === 'Paid' ? 'paid' : (m.paymentStatus === 'Partially Paid' ? 'partial' : 'unpaid');
      var gi = start + idx;
      return '' +
        '<tr>' +
          '<td class="billing-h-num">' + escapeHtml(m.invoiceNumber) + '</td>' +
          '<td>' + escapeHtml(m.date.toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })) + '</td>' +
          '<td class="billing-h-cust">' + escapeHtml(cust) + '</td>' +
          '<td class="text-center">' + m.items.length + '</td>' +
          '<td>' + formatINR(rupeesOf(m.totals.grandPaise)) + '</td>' +
          '<td>' + escapeHtml(m.paymentMethod) + '</td>' +
          '<td><span class="billing-h-status ' + statusCls + '">' + escapeHtml(m.paymentStatus) + '</span></td>' +
          '<td>' + escapeHtml(m.invoiceStatus) + '</td>' +
          '<td><div class="billing-h-actions">' +
            '<button type="button" class="billing-h-icon-btn" title="View invoice" data-h-view="' + gi + '">&#128065;</button>' +
            '<button type="button" class="billing-h-icon-btn" title="Print invoice" data-h-print="' + gi + '">&#128424;</button>' +
            '<button type="button" class="billing-h-icon-btn" title="Download PDF" data-h-pdf="' + gi + '">&#11015;</button>' +
          '</div></td>' +
        '</tr>';
    }).join('');

    Array.prototype.forEach.call(body.querySelectorAll('[data-h-view]'), function (b) {
      b.addEventListener('click', function () { openHistoryInvoice(parseInt(b.getAttribute('data-h-view'), 10), 'a4', false); });
    });
    Array.prototype.forEach.call(body.querySelectorAll('[data-h-print]'), function (b) {
      b.addEventListener('click', function () { openHistoryInvoice(parseInt(b.getAttribute('data-h-print'), 10), 'a4', true); });
    });
    Array.prototype.forEach.call(body.querySelectorAll('[data-h-pdf]'), function (b) {
      b.addEventListener('click', function () {
        var m = histFiltered[parseInt(b.getAttribute('data-h-pdf'), 10)];
        if (m) generateInvoicePDF(m);
      });
    });
    updateHistoryPagination();
  }

  function openHistoryInvoice(index, mode, autoPrint) {
    var m = histFiltered[index];
    if (m) openInvoicePreview(m, mode, autoPrint);
  }

  function updateHistoryPagination() {
    var pages = Math.max(1, Math.ceil(histFiltered.length / HIST_PAGE_SIZE));
    var label = document.getElementById('history-page-label');
    if (label) label.textContent = 'Page ' + (histPage + 1) + ' of ' + pages;
    var prev = document.getElementById('history-prev');
    var next = document.getElementById('history-next');
    if (prev) prev.disabled = histPage <= 0;
    if (next) next.disabled = histPage >= pages - 1;
  }

  function historyPrevPage() { if (histPage > 0) { histPage--; renderHistory(); } }
  function historyNextPage() {
    var pages = Math.ceil(histFiltered.length / HIST_PAGE_SIZE);
    if (histPage < pages - 1) { histPage++; renderHistory(); }
  }

  function applyHistoryFiltersFromUI() { applyHistoryFilters(); renderHistory(); }

  /* ---------------------- Billing settings ---------------------- */
  function loadBillingSettings() {
    if (!window.db) { billingSettings = Object.assign({}, DEFAULT_SETTINGS); return Promise.resolve(billingSettings); }
    return window.db.collection('billing_settings').doc(SETTINGS_DOC_ID).get()
      .then(function (snap) {
        if (snap.exists) {
          billingSettings = Object.assign({}, DEFAULT_SETTINGS, snap.data());
        } else {
          billingSettings = Object.assign({}, DEFAULT_SETTINGS);
        }
        return billingSettings;
      })
      .catch(function () { billingSettings = Object.assign({}, DEFAULT_SETTINGS); return billingSettings; });
  }

  function populateSettingsForm() {
    if (!billingSettings) return;
    setInputValue('bs-shop-name', billingSettings.shopName);
    setInputValue('bs-shop-phone', billingSettings.shopPhone);
    setInputValue('bs-shop-address', billingSettings.shopAddress);
    setInputValue('bs-shop-gstin', billingSettings.gstin);
    setInputValue('bs-shop-logo', billingSettings.logoPath);
    var te = document.getElementById('bs-tax-enabled');
    if (te) te.value = billingSettings.taxEnabled ? 'true' : 'false';
    setInputValue('bs-tax-rate', billingSettings.taxRate);
  }

  function saveBillingSettings() {
    if (!window.db) { showAdminToast('Database not ready.', 'error'); return; }
    var payload = {
      shopName: ((document.getElementById('bs-shop-name') || {}).value || '').trim() || DEFAULT_SETTINGS.shopName,
      shopPhone: ((document.getElementById('bs-shop-phone') || {}).value || '').trim(),
      shopAddress: ((document.getElementById('bs-shop-address') || {}).value || '').trim(),
      gstin: ((document.getElementById('bs-shop-gstin') || {}).value || '').trim(),
      logoPath: ((document.getElementById('bs-shop-logo') || {}).value || '').trim() || DEFAULT_SETTINGS.logoPath,
      taxEnabled: ((document.getElementById('bs-tax-enabled') || {}).value === 'true'),
      taxRate: Math.max(0, Math.min(100, Number((document.getElementById('bs-tax-rate') || {}).value) || 0))
    };
    billingSettings = Object.assign({}, DEFAULT_SETTINGS, payload);
    window.db.collection('billing_settings').doc(SETTINGS_DOC_ID).set(payload, { merge: true })
      .then(function () {
        showAdminToast('Billing settings saved.', 'success');
        recalcBillTotals();
      })
      .catch(function (err) {
        console.error('[Billing] settings save failed', err);
        showAdminToast('Could not save settings: ' + ((err && err.message) ? err.message : 'error'), 'error');
      });
  }

  /* ---------------------- Amount in words (Indian) ---------------------- */
  function numberToWordsINR(rupees) {
    var ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten',
      'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
    var tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
    function two(n) { return n < 20 ? ones[n] : (tens[Math.floor(n / 10)] + (n % 10 ? ' ' + ones[n % 10] : '')); }
    function three(n) {
      var h = Math.floor(n / 100), r = n % 100, out = [];
      if (h) out.push(ones[h] + ' Hundred');
      if (r) out.push(two(r));
      return out.join(' ');
    }
    function words(num) {
      if (num === 0) return 'Zero';
      var parts = [];
      var crore = Math.floor(num / 10000000); num %= 10000000;
      var lakh = Math.floor(num / 100000); num %= 100000;
      var thousand = Math.floor(num / 1000); num %= 1000;
      var hundred = Math.floor(num / 100); var rest = num % 100;
      if (crore) parts.push(two(crore) + ' Crore');
      if (lakh) parts.push(two(lakh) + ' Lakh');
      if (thousand) parts.push(two(thousand) + ' Thousand');
      if (hundred) parts.push(ones[hundred] + ' Hundred');
      if (rest) parts.push(two(rest));
      return parts.join(' ');
    }
    var total = Number(rupees) || 0;
    var whole = Math.floor(Math.abs(total));
    var paise = Math.round((Math.abs(total) - whole) * 100);
    var out = words(whole) + ' Rupees';
    if (paise) out += ' and ' + words(paise) + ' Paise';
    return out + ' only';
  }

  /* ---------------------- Small utilities ---------------------- */
  function setText(id, val) { var el = document.getElementById(id); if (el) el.textContent = val; }
  function setInputValue(id, val) { var el = document.getElementById(id); if (el) el.value = (val == null ? '' : val); }
  function escapeHtml(str) {
    return String(str == null ? '' : str)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  /* ---------------------- Expose globals for inline handlers / admin.js ---------------------- */
  window.renderBillingSection = renderBillingSection;
  window.switchBillingView = switchBillingView;
  window.resetBill = resetBill;
  window.saveBill = saveBill;
  window.previewDraftInvoice = previewDraftInvoice;
  window.downloadDraftPDF = downloadDraftPDF;
  window.printInvoice = printInvoice;
  window.closeInvoicePreview = closeInvoicePreview;
  window.downloadInvoicePDF = downloadInvoicePDF;
  window.recalcBillTotals = recalcBillTotals;
  window.saveBillingSettings = saveBillingSettings;
  window.historyPrevPage = historyPrevPage;
  window.historyNextPage = historyNextPage;

  // Wire the history filter controls once the section is present in the DOM.
  function bindHistoryFilterListeners() {
    var ids = ['history-search', 'history-from', 'history-to', 'history-payfilter'];
    ids.forEach(function (id) {
      var el = document.getElementById(id);
      if (el && !el.dataset.billingBound) {
        el.dataset.billingBound = '1';
        el.addEventListener('input', applyHistoryFiltersFromUI);
        el.addEventListener('change', applyHistoryFiltersFromUI);
      }
    });
  }

  function boot() {
    initBillingPage();
    bindHistoryFilterListeners();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();

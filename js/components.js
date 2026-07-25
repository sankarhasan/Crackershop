/* ==========================================================================
   KPR Crackers - Shared UI Components (Single Source of Truth)
   ---------------------------------------------------------------------------
   Injects the shared chrome (preloader, top ticker + header/nav, footer, cart
   drawer, WhatsApp widget, global modals, and the enquiry form) into placeholder
   <div>s on every page. Loaded as a CLASSIC script BEFORE js/app.js so that all
   shared DOM exists before app.js binds its event handlers.

   Placeholders each page may provide:
     #site-preloader, #site-header, #site-footer, #cart-drawer-mount,
     #whatsapp-mount, #site-modals, and (enquiry/contact only) #enquiry-form-mount
   ========================================================================== */
(function () {
  'use strict';

  /* ---------- Preloader ---------- */
  function preloaderHTML() {
    return `
    <div id="preloader">
      <div class="preloader-content">
        <dotlottie-player
          src="https://lottie.host/c74663fd-84b7-4d55-889d-d2068a8e0717/rcI97zck5M.json"
          background="transparent"
          speed="1"
          style="width: 280px; height: 280px;"
          loop
          autoplay>
        </dotlottie-player>
        <div class="brand-text-wrapper">
          <h1 class="unique-brand-title">KPR CRACKERS</h1>
          <p class="brand-subtitle">Your Joy is our Pride</p>
          <div class="loading-indicator">
            <span>LOADING</span>
            <div class="loading-dots">
              <span class="dot">.</span><span class="dot">.</span><span class="dot">.</span>
            </div>
          </div>
        </div>
      </div>
    </div>`;
  }

  /* ---------- Header ----------
     The top ticker + header/nav is now STATIC HTML inlined directly inside the
     #site-header container on every page, so the browser paints it during HTML
     parsing with ZERO white flash / FOUC on navigation. It is intentionally no
     longer injected here. Active-tab highlighting is still applied by
     setActiveNav() (below), based on window.location.pathname. */

  /* ---------- Cart Drawer ---------- */
  function cartDrawerHTML() {
    return `
    <div class="cart-drawer-overlay" id="cart-drawer-overlay" onclick="toggleCartDrawer()"></div>
    <div class="cart-drawer" id="cart-drawer">
      <div class="cart-drawer-header">
        <h3>Shopping Cart</h3>
        <button class="close-drawer-btn" onclick="toggleCartDrawer()">✕</button>
      </div>

      <div class="cart-drawer-body" id="cart-items-container">
        <div class="empty-cart-message">
          <span class="empty-cart-icon">🛒</span>
          <p>Your cart is empty!</p>
          <p class="sub-text">Add items to your cart to place an enquiry.</p>
          <button class="btn btn-primary" onclick="toggleCartDrawer()">Continue Shopping</button>
        </div>
      </div>

      <div class="cart-drawer-footer">
        <div class="minimum-order-warning error-text" id="min-order-alert">
          <img src="./assets/img/icons/warning.png" alt="Warning" class="warning-icon-img">
          <span>Minimum order required: <strong id="min-order-value">₹3,000</strong>. Add <strong id="min-order-remaining">₹3,000</strong> more.</span>
        </div>
        <div class="cart-subtotal-row">
          <span>Cart Subtotal:</span>
          <strong id="drawer-subtotal">₹0</strong>
        </div>
        <div class="cart-coupon-row" id="cart-coupon-row" style="display: none;">
          <span>Coupon Applied:</span>
          <strong id="drawer-coupon-discount">-₹0</strong>
        </div>
        <div class="cart-grand-total-row" id="cart-grand-total-row" style="display: none;">
          <span>Grand Total:</span>
          <strong id="drawer-grand-total">₹0</strong>
        </div>
        <button class="btn btn-secondary btn-block btn-lg" id="checkout-btn" disabled onclick="checkoutCart()">Place Order Enquiry</button>
      </div>
    </div>`;
  }

  /* ---------- Footer ---------- */
  function footerHTML() {
    return `
    <footer class="main-footer">
      <div class="container footer-grid">
        <div class="footer-col brand-col">
          <a href="index.html" class="footer-logo">
            <img src="Images/KPR-LOGO.png" alt="KPR Crackers Logo" class="logo-image footer-logo-image">
            <span class="logo-text">KPR CRACKERS</span>
          </a>
          <p class="footer-about">Authorized dealer of Sivakasi Supreme Fireworks. Bringing joy, colors, and premium safe fireworks to homes since 2005. Trustworthy quality checked firecrackers delivered securely to your door.</p>
          <div class="social-links">
            <a href="#" class="social-icon fb" aria-label="Facebook">FB</a>
            <a href="#" class="social-icon insta" aria-label="Instagram">IG</a>
            <a href="#" class="social-icon wa" aria-label="WhatsApp">WA</a>
            <a href="#" class="social-icon mail" aria-label="Email">✉️</a>
            <a href="#" class="social-icon jd" aria-label="JustDial">JD</a>
          </div>
        </div>

        <div class="footer-col">
          <h3>Quick Links</h3>
          <ul class="footer-links">
            <li><a href="index.html">Home</a></li>
            <li><a href="about.html">About Us</a></li>
            <li><a href="index.html#categories">Product Categories</a></li>
            <li><a href="products.html">Premium Shop</a></li>
            <li><a href="enquiry.html">Quick Enquiry</a></li>
          </ul>
        </div>

        <div class="footer-col">
          <h3>Our Policies</h3>
          <ul class="footer-links">
            <li><a href="safety-tips.html">Safety Guidelines</a></li>
            <li><a href="#">Terms &amp; Conditions</a></li>
            <li><a href="#">Shipping &amp; Delivery Policy</a></li>
            <li><a href="#">Privacy Policy</a></li>
          </ul>
        </div>

        <div class="footer-col">
          <h3>Reach Us</h3>
          <ul class="footer-contact">
            <li>
              <span class="contact-icon">📍</span>
              <span class="contact-details">Bypass Road, Sivakasi, Tamil Nadu, 626123</span>
            </li>
            <li>
              <span class="contact-icon">📞</span>
              <span class="contact-details">
                <a href="tel:+919789432373">+91 97894 32373</a><br>
                <a href="tel:+916385651757">+91 63856 51757</a>
              </span>
            </li>
            <li>
              <span class="contact-icon">✉️</span>
              <span class="contact-details"><a href="mailto:info@kprcrackers.com">info@kprcrackers.com</a></span>
            </li>
            <li>
              <span class="contact-icon">🕒</span>
              <span class="contact-details">Open Everyday: 8:00 AM - 10:00 PM</span>
            </li>
          </ul>
        </div>
      </div>

      <div class="footer-bottom">
        <div class="container footer-bottom-content">
          <div class="footer-bottom-left">
            <p>&copy; 2026 KPR Crackers. All Rights Reserved. Sivakasi, India.</p>
          </div>
          <div class="footer-bottom-right">
            <p>Designed by Maryan Prasanna</p>
          </div>
        </div>
      </div>
    </footer>`;
  }

  /* ---------- Floating WhatsApp Widget ---------- */
  function whatsappHTML() {
    return `
    <div class="whatsapp-widget" id="whatsapp-widget">
      <div class="whatsapp-btn" onclick="toggleWhatsAppPopup()" id="wa-btn" aria-label="Quick Enquiry Popup">
        <span class="wa-icon">💬</span>
        <span class="wa-badge">1</span>
      </div>

      <div class="whatsapp-popup" id="whatsapp-popup">
        <div class="wa-popup-header">
          <div class="wa-agent-avatar">👤</div>
          <div class="wa-agent-info">
            <h4>KPR Support Assistant</h4>
            <p class="status-online">● Online | Replies in 5 mins</p>
          </div>
          <button class="wa-close-btn" onclick="toggleWhatsAppPopup()">✕</button>
        </div>

        <div class="wa-popup-body">
          <p class="wa-message-bubble">Hello there! Happy Diwali! How can I help you order your firecrackers today? 🎇</p>

          <form id="whatsapp-quick-form" class="wa-quick-form">
            <input type="text" id="wa-name" placeholder="Your Name" required class="wa-input">
            <input type="tel" id="wa-phone" placeholder="WhatsApp Number" pattern="[6789][0-9]{9}" required class="wa-input">
            <textarea id="wa-msg" placeholder="What products are you looking for? (e.g. Ground Chakkars, Sparklers)" rows="2" required class="wa-input wa-textarea"></textarea>
            <button type="submit" class="wa-submit-btn">Start WhatsApp Chat 🚀</button>
          </form>
        </div>
      </div>
    </div>`;
  }

  /* ---------- Global Modals (Notice + Toast + Success) ---------- */
  function modalsHTML() {
    return `
    <div id="notice-modal-overlay" class="notice-modal-overlay" aria-hidden="true" role="dialog" aria-modal="true">
      <div class="notice-modal-card">
        <div class="notice-modal-header">
          <div class="notice-header-content flex items-center justify-center gap-2">
            <span class="notice-modal-icon">📢</span>
            <h2 class="notice-modal-title" id="notice-modal-title">Important Notice</h2>
          </div>
        </div>

        <div class="notice-lang-tabs">
          <button type="button" class="notice-lang-tab active" data-lang="en" id="notice-lang-en" onclick="switchNoticeLanguage('en')">English</button>
          <button type="button" class="notice-lang-tab" data-lang="ta" id="notice-lang-ta" onclick="switchNoticeLanguage('ta')">தமிழ்</button>
        </div>

        <div class="notice-slide-wrapper">
          <div class="notice-slide-track" id="notice-slide-track">
            <div class="notice-slide-panel" data-lang="en">
              <div class="notice-modal-body">
                <p>
                  As per the Hon'ble High Court order, direct online sale of crackers is strictly prohibited and punishable by law. This website is provided primarily for enquiry purposes. Customers may check product details, availability and price range. Customers may submit an enquiry form through this website. If the customer agrees, the enquiry can be converted into an order as per their interest, subject to applicable laws and regulations. This website does not provide an instant online purchase or checkout system, any payment or order process will be handled only after customer confirmation. Our KPR Crackers strictly follows all protocols and is 100% compliant with legal and statutory requirements as per the Explosives Act. All parcels are dispatched only through registered and legally authorized transport service providers.
                </p>
              </div>
            </div>
            <div class="notice-slide-panel" data-lang="ta">
              <div class="notice-modal-body">
                <p>
                  கௌரவ உயர் நீதிமன்ற உத்தரவின்படி, பட்டாசுகளை நேரடியாக ஆன்லைனில் விற்பனை செய்வது சட்டப்படி கண்டிப்பாக தடைசெய்யப்பட்டுள்ளது மற்றும் தண்டனைக்குரிய குற்றமாகும். இந்த இணையதளம் முதன்மையாக விசாரிக்கும் (Enquiry) நோக்கத்திற்காக மட்டுமே வழங்கப்படுகிறது. வாடிக்கையாளர்கள் தயாரிப்பு விவரங்கள், இருப்பு மற்றும் விலை வரம்புகளைச் சரிபார்த்துக் கொள்ளலாம். வாடிக்கையாளர்கள் இந்த இணையதளம் மூலம் விசாரிப்பு படிவத்தை (Enquiry form) சமர்ப்பிக்கலாம். வாடிக்கையாளர் ஒப்புக்கொண்டால், அவர்களின் விருப்பத்திற்கு ஏற்ப, பொருந்தக்கூடிய சட்டங்கள் மற்றும் விதிகளுக்கு உட்பட்டு, விசாரிப்பு ஒரு ஆர்டராக மாற்றப்படும். இந்த இணையதளம் உடனடி ஆன்லைன் கொள்முதல் அல்லது செக்அவுட் சிஸ்டத்தை வழங்காது, வாடிக்கையாளர் உறுதிப்படுத்திய பின்னரே எந்தவொரு கட்டணமும் அல்லது ஆர்டர் செயல்முறையும் கையாளப்படும். எங்களது KPR Crackers அனைத்து விதிகளையும் கண்டிப்பாக பின்பற்றுகிறது மற்றும் வெடிபொருட்கள் சட்டத்தின்படி சட்டபூர்வமான மற்றும் தகுதிவாய்ந்த தேவைகளுக்கு 100% இணங்குகிறது. அனைத்து பார்சல்களும் பதிவுசெய்யப்பட்ட மற்றும் சட்டப்பூர்வமாக அங்கீகரிக்கப்பட்ட போக்குவரத்து சேவை வழங்குநர்கள் மூலம் மட்டுமே அனுப்பப்படும்.
                </p>
              </div>
            </div>
          </div>
        </div>

        <div class="notice-modal-footer">
          <label class="notice-modal-checkbox">
            <input type="checkbox" id="notice-agree-checkbox">
            <span id="notice-checkbox-label">By clicking "I Understand", you acknowledge and agree to these terms before proceeding to make an enquiry.</span>
          </label>
          <button type="button" id="notice-understand-btn" class="notice-understand-btn" disabled>I Understand</button>
        </div>
      </div>
    </div>

    <div class="toast-container" id="toast-container"></div>

    <div id="success-modal-overlay" class="success-modal-overlay" aria-hidden="true" role="dialog" aria-modal="true">
      <div class="success-modal">
        <div class="success-modal-icon" aria-hidden="true">🎉</div>
        <h2 class="success-modal-title">Thank you!</h2>
        <p class="success-modal-message">
          Your enquiry has been submitted successfully. Our team will contact you shortly.
        </p>
        <button id="success-modal-ok" class="success-modal-ok-btn" type="button">
          OK
        </button>
      </div>
    </div>`;
  }

  /* ---------- Quick Enquiry Form (enquiry.html + contact.html) ---------- */
  function enquiryFormHTML() {
    return `
    <section id="quick-enquiry" class="enquiry-section fade-in-up">
      <div class="container">
        <div class="enquiry-card">
          <!-- Empty cart notice: shown by updateCartUI() only when the cart has 0 items -->
          <div id="empty-cart-notice" class="empty-cart-notice" style="display: none;">
            <p class="empty-cart-notice-text"><img src="Icons/warning.png" alt="Warning" class="empty-cart-notice-warning-icon"> <span><strong>Please Note:</strong> You haven't added any crackers to your cart yet. Please add products to your cart before sending an enquiry!</span></p>
            <a href="products.html" class="empty-cart-notice-btn">
              <img src="Icons/Right arrow.png" alt="" class="empty-cart-notice-arrow">
              <span>Add to Cart</span>
            </a>
          </div>
          <div class="section-header">
            <h4 class="section-subtitle text-center">GET A FREE QUOTE</h4>
            <h2 class="section-title">Send a Quick Enquiry</h2>
            <p class="section-desc">Interested in bulk orders, dealer pricing, or custom packages? Submit this form and our agent will call you in 1 hour.</p>
          </div>

          <form id="enquiry-form" class="enquiry-form">
            <div class="form-row-2">
              <div class="form-group">
                <label for="enquiry-name">Your Full Name <span class="required">*</span></label>
                <input type="text" id="enquiry-name" name="name" class="form-control" placeholder="e.g. Rajesh Kumar" required>
              </div>
              <div class="form-group">
                <label for="enquiry-phone">WhatsApp Number <span class="required">*</span></label>
                <input type="tel" id="enquiry-phone" name="phone" class="form-control" placeholder="e.g. 9876543210" pattern="[6789][0-9]{9}" required>
              </div>
            </div>

            <div class="form-grid-container">
              <div class="form-grid-left">
                <div class="form-group">
                  <label for="enquiry-delivery-address">DELIVERY ADDRESS <span class="required">*</span></label>
                  <textarea id="enquiry-delivery-address" name="address" class="form-control" placeholder="Enter your full delivery address" rows="3" required></textarea>
                </div>
                <div class="form-group">
                  <label for="enquiry-state"><span class="label-text">SELECT YOUR STATE <span class="required">*</span></span> <span class="state-label-subtext">(Minimum Order amount)</span></label>
                  <select id="enquiry-state" name="state" class="form-control" onchange="onStateChange(this.value)" required>
                    <option value="" disabled>Loading states...</option>
                  </select>
                </div>
              </div>
              <div class="form-grid-right">
                <div class="form-group">
                  <label for="enquiry-pincode">PINCODE / POSTAL CODE <span class="required">*</span></label>
                  <input type="text" id="enquiry-pincode" name="pincode" class="form-control" placeholder="e.g. 626123" pattern="[0-9]{6}" maxlength="6" required>
                </div>
                <div class="form-group">
                  <label for="enquiry-message"><span class="label-text">ENQUIRY MESSAGE</span> <span class="message-label-subtext">(Optional)</span></label>
                  <textarea id="enquiry-message" name="enquiryMessage" class="form-control" placeholder="e.g. Any special requests or questions about products..." rows="3"></textarea>
                </div>
              </div>
            </div>

            <div class="order-summary-card">
              <div class="order-summary-header">ORDER SUMMARY</div>

              <div class="coupon-box">
                <div class="coupon-row">
                  <input type="text" id="coupon-input" class="coupon-input" placeholder="COUPON CODE" />
                  <span id="coupon-apply-btn" class="coupon-apply">APPLY</span>
                </div>
                <div id="coupon-stacked-container" class="coupon-stacked-container"></div>
              </div>

              <div class="summary-row">
                <span class="summary-label">Total</span>
                <span class="summary-value" id="summary-total">₹0</span>
              </div>
              <div class="summary-row">
                <span class="summary-label">You Saved <span class="discount-badge">55% OFF</span></span>
                <span class="summary-value summary-discount" id="summary-discount">-₹0</span>
              </div>
              <div class="summary-row">
                <span class="summary-label">Non Discounted Items</span>
                <span class="summary-value" id="summary-non-discounted">₹0</span>
              </div>
              <div class="summary-row">
                <span class="summary-label">Spin Wheel</span>
                <span class="summary-value" id="summary-spin-wheel">—</span>
              </div>
              <div class="summary-row">
                <span class="summary-label">Coupon Applied <span id="coupon-discount-badge" class="discount-badge coupon-badge" style="display: none;"></span></span>
                <span class="summary-value" id="summary-coupon-discount">—</span>
              </div>

              <div class="summary-divider"></div>

              <div class="summary-row summary-grand-total-row">
                <span class="summary-label summary-grand-label">Grand Total (C)</span>
                <span class="summary-value summary-grand-value" id="summary-grand-total">₹0</span>
              </div>
            </div>

            <div id="order-summary-warning" class="order-summary-warning" style="display: none;">
              <img src="./assets/img/icons/warning.png" alt="Warning" class="warning-icon-img">
              <span class="warning-text">Minimum order required: calculating...</span>
            </div>
            <button type="submit" id="enquiry-submit-btn" class="btn btn-primary btn-block btn-lg" onclick="triggerMinimumOrderShake()">Submit Quick Enquiry</button>
          </form>
        </div>
      </div>
    </section>`;
  }

  /* ---------- Injection helpers ---------- */
  function inject(id, html) {
    const el = document.getElementById(id);
    if (el) el.innerHTML = html;
  }

  function currentPageFile() {
    let path = (window.location.pathname || '').toLowerCase();
    let file = path.substring(path.lastIndexOf('/') + 1);
    if (!file) file = 'index.html';
    return file;
  }

  // Highlight the nav tab that matches the current page (desktop + mobile).
  function setActiveNav() {
    const current = currentPageFile();
    document.querySelectorAll('.nav-link').forEach(function (link) {
      const href = (link.getAttribute('href') || '').toLowerCase();
      let linkFile = href.substring(href.lastIndexOf('/') + 1);
      if (!linkFile) linkFile = 'index.html';
      if (linkFile === current) {
        link.classList.add('active');
      } else {
        link.classList.remove('active');
      }
    });
  }

  // Decide whether to show the full-screen preloader for THIS page load.
  //   • Show on a genuine browser reload/refresh (F5 / reload button) of ANY page.
  //   • Show once on the very first entry to the site in a tab session.
  //   • Skip for internal link navigation and back/forward, so page-to-page
  //     transitions are instant with no flash (the element is never injected).
  function shouldShowPreloader() {
    try {
      const isFirstSiteVisit = !sessionStorage.getItem('site_session_active');

      let isReload = false;
      const navEntries = (typeof performance !== 'undefined' && performance.getEntriesByType)
        ? performance.getEntriesByType('navigation')
        : [];
      if (navEntries && navEntries.length > 0) {
        isReload = navEntries[0].type === 'reload';
      } else if (typeof performance !== 'undefined' && performance.navigation) {
        // Legacy fallback (deprecated API): 1 === TYPE_RELOAD
        isReload = performance.navigation.type === 1;
      }

      return isFirstSiteVisit || isReload;
    } catch (e) {
      // If detection fails for any reason, err toward showing the loader.
      return true;
    }
  }

  function renderSharedComponents() {
    // Gate the preloader BEFORE injecting so internal navigation shows no flash
    // of the loading screen.
    if (shouldShowPreloader()) {
      inject('site-preloader', preloaderHTML());
    }
    // Mark this tab session as active so the first-visit branch only fires once;
    // reloads are still detected independently via the Navigation Timing API.
    try { sessionStorage.setItem('site_session_active', 'true'); } catch (e) {}

    inject('site-footer', footerHTML());
    inject('cart-drawer-mount', cartDrawerHTML());
    inject('whatsapp-mount', whatsappHTML());
    inject('site-modals', modalsHTML());
    inject('enquiry-form-mount', enquiryFormHTML());
    setActiveNav();
  }

  // Inject synchronously as soon as this script executes. It is placed at the
  // end of <body> (after the placeholders) and BEFORE app.js, so all shared DOM
  // is present before app.js's immediate block and DOMContentLoaded handlers run.
  if (document.body) {
    renderSharedComponents();
  } else {
    document.addEventListener('DOMContentLoaded', renderSharedComponents);
  }

  // Expose for debugging / manual re-render.
  window.renderSharedComponents = renderSharedComponents;
})();

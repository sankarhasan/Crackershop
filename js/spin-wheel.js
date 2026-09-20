/* ==========================================================================
   LUCKY SPIN WHEEL — Storefront Module (loaded AFTER app.js on every page)
   ==========================================================================
   Sequence: the Info modal auto-shows on EVERY page load/refresh of the HOME
   PAGE only (inner pages never show it); when the Notice modal is still
   pending on that load it chains in right after the
   Notice closes instead. "Spin Now" is the single validation point (sign-in
   gate + 24h lock) -> Canvas Wheel modal -> segment outcome:
     • try_again  — spin again immediately (no 24h lock written)
     • better_luck — 24h lock set immediately for this user
     • product:<id> — item pushed into the cart as a ₹0 FREE GIFT + 24h lock

   Data contract (see js/data.js for the config sync layer):
     • spin_wheel_config/'config'   → { segments: [10 × slot] } (admin-managed)
     • spin_wheel_results/{uid}     → { uid, email, last_spun_at, last_result,
                                        prize } (one doc per signed-in client)
   A localStorage mirror (kpr_spin_lock) keeps the 24h lock honest offline /
   while Firestore settles, mirroring the site's Firestore + cache hybrid.

   Styling lives in css/spin-wheel.css (plain CSS — no Tailwind).
   ========================================================================== */
(function () {
  'use strict';

  const SPIN_LOCK_STORAGE_KEY = 'kpr_spin_lock';
  const NOTICE_ACK_STORAGE_KEY = 'noticeAcknowledged'; // app.js writes this
  const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000;
  const SPIN_ANIM_MS = 4000; // must match the canvas CSS transition duration

  let spinWheelConfig = null;       // { segments: [10] } resolved slot strings
  let currentRotation = 0;          // cumulative clockwise degrees on the canvas
  let isSpinning = false;
  let pendingSpinAfterAuth = false; // "Spin Now" pressed while signed out
  let scrollLockCount = 0;

  /* ---------- Tiny helpers (defensive; app.js owns the real ones) ---------- */
  function authUser() {
    try {
      return typeof getKprAuthUser === 'function' ? getKprAuthUser() : null;
    } catch (e) {
      return null;
    }
  }

  function productsList() {
    try {
      return typeof getProducts === 'function' ? (getProducts() || []) : [];
    } catch (e) {
      return [];
    }
  }

  function toast(message, type) {
    try {
      if (typeof showToast === 'function') showToast(message, type || 'success');
    } catch (e) { /* toast container absent on this page — silent */ }
  }

  // Lock/unlock body scroll with a counter so stacked modals never leave the
  // page frozen (notice modal uses the same overflow tricks; we layer on top).
  function lockScroll() {
    scrollLockCount += 1;
    document.documentElement.style.overflow = 'hidden';
    document.body.style.overflow = 'hidden';
  }
  function unlockScroll() {
    scrollLockCount = Math.max(0, scrollLockCount - 1);
    if (scrollLockCount === 0) {
      document.documentElement.style.overflow = '';
      document.body.style.overflow = '';
    }
  }

  /* ==========================================================================
     1. Modal markup — injected once at script load (script sits at </body>,
        so every placeholder element below is guaranteed to exist in the DOM).
     ========================================================================== */
  function injectSpinWheelModals() {
    if (document.getElementById('spin-info-modal')) return;

    document.body.insertAdjacentHTML('beforeend', `
      <!-- SPIN WHEEL INFO MODAL (WINDOW 1) -->
      <div id="spin-info-modal" class="spin-modal-overlay" aria-hidden="true" role="dialog" aria-modal="true">
        <div class="spin-info-card">
          <button type="button" class="spin-close-btn" onclick="closeSpinInfoModal()" aria-label="Close">&times;</button>

          <div class="spin-brand-head">
            <h3 class="spin-brand-title">KPR Crackers</h3>
            <p class="spin-brand-tagline">Your Joy is our Pride</p>
          </div>

          <div class="spin-info-box">
            <div class="spin-info-gift-icon">🎁</div>
            <h4 class="spin-info-heading">Spin Wheel Info</h4>
            <p class="spin-info-text">
              Win a prize? It will be automatically added below non-discount items in your address box and bill.
              An estimate will be sent after your order is placed.
            </p>
            <p class="spin-info-note">
              Spin Wheel works once per user every 24 hours. Use your lucky spin wisely!
            </p>
          </div>

          <div class="spin-info-actions">
            <button type="button" id="spin-open-wheel-btn" class="spin-btn-primary" onclick="handleSpinNowClick()">
              Spin Now 🎡
            </button>
            <p id="spin-lock-hint" class="spin-lock-hint hidden"></p>
            <button type="button" class="spin-btn-secondary" onclick="closeSpinInfoModal()">
              Skip Spin &amp; Go to Products Catalogue →
            </button>
          </div>
        </div>
      </div>

      <!-- SPIN WHEEL CANVAS MODAL (WINDOW 2) -->
      <div id="spin-wheel-modal" class="spin-modal-overlay spin-wheel-backdrop" aria-hidden="true" role="dialog" aria-modal="true">
        <div class="spin-wheel-card">
          <button type="button" class="spin-close-btn" onclick="closeSpinWheelModal()" aria-label="Close">&times;</button>

          <span class="spin-wheel-eyebrow">Lucky Spin Wheel</span>
          <h2 class="spin-wheel-title">Spin the Wheel &amp; Win Crackers!</h2>
          <p class="spin-wheel-subtitle">Tap start and test your luck. Exciting gifts await you!</p>

          <div class="spin-wheel-holder">
            <div class="spin-wheel-pointer" aria-hidden="true"></div>
            <canvas id="wheel-canvas" width="280" height="280"></canvas>
            <button type="button" id="spin-start-btn" class="spin-start-btn" onclick="executeWheelSpin()">
              <span id="spin-start-label">START</span>
              <span class="spin-start-sub">SPIN</span>
            </button>
          </div>

          <p id="spin-result-msg" class="spin-result-msg"></p>
        </div>
      </div>
    `);
  }

  /* ==========================================================================
     2. Config + lock state
     ========================================================================== */
  function resolveSegmentLabel(slot) {
    if (slot === 'try_again') return 'Try Again';
    if (slot === 'better_luck') return 'Better Luck';
    if (typeof slot === 'string' && slot.indexOf('product:') === 0) {
      const pid = slot.substring('product:'.length);
      const prod = productsList().find(p => String(p.id) === String(pid));
      return prod ? prod.name : 'Try Again'; // stale/removed product → safe fallback
    }
    return 'Try Again';
  }

  function segments() {
    const raw = (spinWheelConfig && Array.isArray(spinWheelConfig.segments))
      ? spinWheelConfig.segments : [];
    // Always render exactly 10 slices; pad/trim defensively so a corrupt
    // admin write can never produce a broken wheel geometry. Coerce to
    // strings so downstream .indexOf() checks are exception-proof.
    const out = raw.slice(0, 10).map(s => String(s == null ? 'try_again' : s));
    while (out.length < 10) out.push('try_again');
    return out;
  }

  function readLocalLock() {
    try {
      const raw = localStorage.getItem(SPIN_LOCK_STORAGE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      return null;
    }
  }

  function writeLocalLock(entry) {
    try { localStorage.setItem(SPIN_LOCK_STORAGE_KEY, JSON.stringify(entry)); } catch (e) {}
  }

  function isLockActive(entry) {
    if (!entry || !entry.last_spun_at) return false;
    if (entry.last_result === 'try_again') return false; // re-spin stays allowed
    const ts = new Date(entry.last_spun_at).getTime();
    return Number.isFinite(ts) && (Date.now() - ts) < TWENTY_FOUR_HOURS_MS;
  }

  // Local mirror first (instant + offline-safe), then the Firestore record.
  function isUserLockedOut() {
    if (isLockActive(readLocalLock())) return true;
    return false; // refreshed async by syncLockFromFirestore() once signed in
  }

  function syncLockFromFirestore() {
    const user = authUser();
    if (!user || !window.db) return Promise.resolve();

    return window.db.collection('spin_wheel_results').doc(user.uid).get()
      .then(doc => {
        if (doc && doc.exists) {
          const server = doc.data();
          const local = readLocalLock();
          // Trust whichever record is newer for the SAME user; a local lock
          // from a different account must not leak across logins.
          if (local && local.uid === user.uid && local.last_spun_at > server.last_spun_at) return;
          if (server.uid !== user.uid) return;
          writeLocalLock(server);
        }
      })
      .catch(err => {
        console.error('[SpinWheel] ✗ Failed to read spin lock from Firestore:', err && err.code, err && err.message, err);
      });
  }

  function lockRemainingHoursText() {
    const entry = readLocalLock();
    if (!entry || !entry.last_spun_at) return '';
    const elapsed = Date.now() - new Date(entry.last_spun_at).getTime();
    const remaining = Math.max(0, TWENTY_FOUR_HOURS_MS - elapsed);
    const hours = Math.ceil(remaining / (60 * 60 * 1000));
    return hours > 1 ? `Next spin available in about ${hours} hours.` : 'Next spin available in about an hour.';
  }

  /* ==========================================================================
     3. Info modal (Window 1) — shows on EVERY page load/refresh, chained
        after the Notice modal whenever the Notice is still pending.
     ========================================================================== */
  function showLockHint(message) {
    const hint = document.getElementById('spin-lock-hint');
    if (!hint) return;
    hint.textContent = message || '';
    hint.classList.toggle('hidden', !message);
  }

  function openSpinInfoModal() {
    const modal = document.getElementById('spin-info-modal');
    if (!modal || modal.classList.contains('open')) return;
    modal.classList.add('open');
    modal.setAttribute('aria-hidden', 'false');
    lockScroll();
    // No pre-emptive gating here: the 24h lock and sign-in validation run
    // ONLY when "Spin Now" is clicked (see handleSpinNowClick).
    showLockHint('');
  }

  function closeSpinInfoModal() {
    const modal = document.getElementById('spin-info-modal');
    if (!modal || !modal.classList.contains('open')) return;
    modal.classList.remove('open');
    modal.setAttribute('aria-hidden', 'true');
    unlockScroll();
  }

  // app.js calls this from closeNoticeModal() — every time the notice closes.
  function openSpinInfoModalAfterNotice() {
    // Home-only restriction: the notice exists site-wide, but the spin
    // pop-up is a homepage experience — never chain it on inner pages.
    if (!isHomePage()) return;
    // Small beat so the notice modal's scroll-unlock paints first.
    setTimeout(openSpinInfoModal, 250);
  }

  // The Spin Wheel Info modal is a HOME PAGE feature only — inner pages
  // (products, enquiry, contact, dashboard/profile, …) never auto-show it.
  function isHomePage() {
    const path = (window.location.pathname || '').toLowerCase();
    return path === '/' || path === '' || path.endsWith('/index.html');
  }

  // True when the Notice modal is still pending on THIS page load (its
  // #categories scroll trigger exists) — the closeNoticeModal chain hook
  // surfaces the info modal instead of the auto-show path, so it never
  // pops out from behind the notice.
  function deferToPendingNotice() {
    let acknowledged = false;
    try {
      acknowledged = sessionStorage.getItem(NOTICE_ACK_STORAGE_KEY) === 'true';
    } catch (e) {
      // No sessionStorage → app.js always shows the notice: treat as pending.
    }
    if (acknowledged) return false;
    return !!document.getElementById('notice-modal-overlay')
      && !!document.getElementById('categories');
  }

  // Wait for the full-screen preloader (body.preloader-active) to clear so
  // the info modal is never buried under the loading animation on a refresh.
  function openSpinInfoModalWhenVisible() {
    let attempts = 0;
    const tryOpen = () => {
      const loaderActive = document.body && document.body.classList.contains('preloader-active');
      if (!loaderActive || attempts > 40) { // ~8s safety cap, then show anyway
        openSpinInfoModal();
        return;
      }
      attempts += 1;
      setTimeout(tryOpen, 200);
    };
    tryOpen();
  }

  // REQUIREMENT 1: auto-show on every page load / refresh — but ONLY on the
  // Home Page; inner pages never surface the Info modal.
  function autoShowInfoModalOnLoad() {
    if (!isHomePage()) return;          // strict inner-page guard
    if (deferToPendingNotice()) return; // requirement 2 handles this visit
    openSpinInfoModalWhenVisible();
  }

  /* ==========================================================================
     4. "Spin Now" — auth gate + wheel modal (Window 2)
     ========================================================================== */
  function handleSpinNowClick() {
    if (!authUser()) {
      // Signed out: raise the existing KPR Client Portal modal on top and
      // auto-continue into the wheel once the user signs in.
      pendingSpinAfterAuth = true;
      try {
        if (typeof openAuthModal === 'function') {
          openAuthModal();
        } else {
          toast('Sign-in is unavailable on this page.', 'error');
        }
      } catch (e) {
        console.error('[SpinWheel] ✗ Could not open the sign-in modal:', e);
      }
      return;
    }

    // REQUIREMENT 3: the 24h restriction is enforced HERE, at click time —
    // refresh from the cloud first, then block only if a conclusive spin
    // (better_luck / product prize) landed within 24 hours.
    syncLockFromFirestore().then(() => {
      if (isUserLockedOut()) {
        showLockHint('⏳ ' + lockRemainingHoursText() + ' Come back then for another lucky shot!');
        return;
      }
      showLockHint('');
      closeSpinInfoModal();
      openSpinWheelModal();
    });
  }

  function openSpinWheelModal() {
    const modal = document.getElementById('spin-wheel-modal');
    if (!modal) return;
    modal.classList.add('open');
    modal.setAttribute('aria-hidden', 'false');
    lockScroll();
    drawWheel();
    const msg = document.getElementById('spin-result-msg');
    if (msg) msg.textContent = '';
  }

  function closeSpinWheelModal() {
    if (isSpinning) return; // never interrupt a live spin
    const modal = document.getElementById('spin-wheel-modal');
    if (!modal || !modal.classList.contains('open')) return;
    modal.classList.remove('open');
    modal.setAttribute('aria-hidden', 'true');
    unlockScroll();
  }

  /* ==========================================================================
     5. Canvas wheel rendering + spin animation
     ========================================================================== */
  const SEGMENT_COLORS = ['#fde68a', '#fecaca', '#bbf7d0', '#bfdbfe', '#fbcfe8',
                          '#ddd6fe', '#fed7aa', '#a5f3fc', '#d9f99d', '#f5d0fe'];

  function slotColor(slot, index) {
    if (slot === 'better_luck') return '#64748b';   // muted slate — losing feel
    if (slot === 'try_again') return '#cbd5e1';     // light slate — neutral
    return SEGMENT_COLORS[index % SEGMENT_COLORS.length]; // prizes pop
  }

  function drawWheel() {
    const canvas = document.getElementById('wheel-canvas');
    if (!canvas || !canvas.getContext) return;
    const ctx = canvas.getContext('2d');
    const cssSize = 280;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = cssSize * dpr;
    canvas.height = cssSize * dpr;

    const segs = segments();
    const count = segs.length; // always 10 (segments() pads)
    const cx = cssSize / 2, cy = cssSize / 2, r = cssSize / 2 - 4;
    const slice = (2 * Math.PI) / count;

    ctx.save();
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, cssSize, cssSize);

    for (let i = 0; i < count; i++) {
      const start = -Math.PI / 2 + i * slice; // slice 0 begins at 12 o'clock
      const mid = start + slice / 2;

      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.arc(cx, cy, r, start, start + slice);
      ctx.closePath();
      ctx.fillStyle = slotColor(segs[i], i);
      ctx.fill();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      ctx.stroke();

      // Radial label, truncated for the narrow slice
      let label = resolveSegmentLabel(segs[i]).toUpperCase();
      if (label.length > 12) label = label.substring(0, 11) + '…';
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(mid);
      ctx.textAlign = 'right';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = '#0f172a';
      ctx.font = '700 10px Poppins, sans-serif';
      ctx.fillText(label, r - 10, 0);
      ctx.restore();
    }

    // Outer rim + hub
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, 2 * Math.PI);
    ctx.strokeStyle = '#fbbf24';
    ctx.lineWidth = 5;
    ctx.stroke();
    ctx.restore();

    // Re-apply the current rotation after a redraw (admin changed slots etc.)
    canvas.style.transform = `rotate(${currentRotation}deg)`;
  }

  function setSpinButtonEnabled(enabled, label) {
    const btn = document.getElementById('spin-start-btn');
    const lbl = document.getElementById('spin-start-label');
    if (lbl && label) lbl.textContent = label;
    if (btn) btn.disabled = !enabled;
  }

  function executeWheelSpin() {
    if (isSpinning) return;
    const canvas = document.getElementById('wheel-canvas');
    const msg = document.getElementById('spin-result-msg');
    if (!canvas || !msg) return;

    // Hard re-check: lock may have landed from the cloud since the modal opened.
    if (isUserLockedOut()) {
      msg.textContent = '⏳ ' + lockRemainingHoursText();
      return;
    }

    isSpinning = true;
    setSpinButtonEnabled(false, 'SPINNING');
    msg.textContent = '';

    const count = segments().length;
    const winnerIndex = Math.floor(Math.random() * count);
    const sliceDeg = 360 / count;
    // Jitter keeps the pointer off the segment borders (±35 % of the slice).
    const jitter = (Math.random() - 0.5) * sliceDeg * 0.7;
    const targetMod = ((360 - (winnerIndex * sliceDeg + sliceDeg / 2) + jitter) % 360 + 360) % 360;
    const currentMod = ((currentRotation % 360) + 360) % 360;
    const travel = ((targetMod - currentMod) % 360 + 360) % 360;
    currentRotation = currentRotation + travel + 360 * 6; // six extra full turns

    canvas.style.transition = `transform ${SPIN_ANIM_MS}ms cubic-bezier(0.15, 0.9, 0.15, 1)`;
    // Force a style recalc so the transition always fires from the old angle.
    void canvas.offsetWidth;
    canvas.style.transform = `rotate(${currentRotation}deg)`;

    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      isSpinning = false;
      applySpinResult(segments()[winnerIndex]);
    };
    const onEnd = (e) => {
      if (e && e.propertyName && e.propertyName !== 'transform') return;
      canvas.removeEventListener('transitionend', onEnd);
      finish();
    };
    canvas.addEventListener('transitionend', onEnd);
    // Safety net: transitionend can be skipped on background-tab throttling.
    setTimeout(finish, SPIN_ANIM_MS + 700);
  }

  /* ==========================================================================
     6. Result handling — lock writes, gift carting
     ========================================================================== */
  function persistSpinResult(slot) {
    const user = authUser();
    const entry = {
      uid: user ? user.uid : 'anonymous',
      email: user ? (user.email || '') : '',
      last_spun_at: new Date().toISOString(),
      last_result: slot,
      prize: slot.indexOf('product:') === 0 ? slot.substring('product:'.length) : ''
    };
    writeLocalLock(entry);

    if (!user || !window.db) return Promise.resolve();
    return window.db.collection('spin_wheel_results').doc(user.uid).set(entry, { merge: true })
      .then(() => console.log('[SpinWheel] ✓ Spin result saved to Firestore for', user.uid))
      .catch(err => {
        // The local mirror already holds the lock — a failed cloud write must
        // not silently hand the user another free spin on THIS device, and
        // cross-device enforcement self-heals on the next successful read.
        console.error('[SpinWheel] ✗ Failed to save spin result. Code:', err && err.code, 'Message:', err && err.message, err);
      });
  }

  function addGiftToCart(slot) {
    const pid = slot.substring('product:'.length);
    const prod = productsList().find(p => String(p.id) === String(pid));
    if (!prod) {
      toast('Prize product is unavailable right now — please contact the store.', 'error');
      return null;
    }

    // The cart globals live in app.js (classic scripts share global scope).
    try {
      const giftId = `GIFT-${prod.id}`;
      const existing = cart.find(item => String(item.id) === giftId);
      if (existing) {
        existing.quantity += 1;
      } else {
        cart.push({
          id: giftId,
          name: `${prod.name} (FREE GIFT 🎁)`,
          price: 0,                 // gift line contributes ₹0 to every total
          quantity: 1,
          categoryId: prod.categoryId,
          image: prod.image,
          isGift: true
        });
      }
      saveCartToStorage();
      updateCartUI();
      return prod;
    } catch (e) {
      console.error('[SpinWheel] ✗ Failed to add the gift to the cart:', e);
      return null;
    }
  }

  function fireConfetti() {
    try {
      if (typeof confetti === 'function') {
        confetti({ particleCount: 140, spread: 75, origin: { y: 0.6 }, colors: ['#fbbf24', '#16a34a', '#dc2626', '#ffffff'] });
      }
    } catch (e) { /* confetti CDN blocked — cosmetic only */ }
  }

  function applySpinResult(slot) {
    const msg = document.getElementById('spin-result-msg');
    if (!msg) return;

    const settle = () => {
      if (slot === 'try_again') {
        // No lock written — the user may immediately spin again.
        setSpinButtonEnabled(true, 'SPIN');
        syncLockFromFirestore(); // keep the local mirror fresh for next load
        return;
      }

      persistSpinResult(slot).then(() => {
        if (slot.indexOf('product:') === 0) {
          const won = addGiftToCart(slot);
          fireConfetti();
          msg.textContent = won ? `🎉 You won ${won.name}! It's in your cart.` : '🎉 Prize recorded — please contact the store.';
          toast(won ? `🎁 ${won.name} added to your cart as a FREE GIFT!` : 'Spin prize saved.', 'success');
          setTimeout(closeSpinWheelModal, 3200);
        } else {
          msg.textContent = '😅 Better luck next time! Come back in 24 hours.';
          setSpinButtonEnabled(false, 'LOCKED');
          setTimeout(closeSpinWheelModal, 2400);
        }
      });
    };

    if (slot === 'try_again') {
      msg.textContent = '🍀 So close! You can spin again right now.';
      setTimeout(settle, 900);
    } else {
      settle();
    }
  }

  /* ==========================================================================
     7. Auth chaining + bootstrap
     ========================================================================== */
  function wireAuthContinuation() {
    // After a sign-in completed through the pending "Spin Now", drop straight
    // into the wheel; after a sign-out, the lock state refreshes everywhere.
    try {
      if (typeof firebase === 'undefined' || !firebase.auth) return;
      firebase.auth().onAuthStateChanged((user) => {
        if (user && pendingSpinAfterAuth) {
          pendingSpinAfterAuth = false;
          syncLockFromFirestore().then(() => {
            if (isUserLockedOut()) {
              openSpinInfoModal();
              showLockHint('⏳ ' + lockRemainingHoursText() + ' Come back then for another lucky shot!');
              return;
            }
            closeSpinInfoModal();
            openSpinWheelModal();
          });
        } else if (user) {
          syncLockFromFirestore(); // keep the local mirror fresh for click checks
        }
      });
    } catch (e) {
      console.error('[SpinWheel] ✗ Auth listener failed to wire:', e);
    }
  }

  function initSpinWheel() {
    injectSpinWheelModals();
    wireAuthContinuation();

    // Hydrate the admin-configured segments (localStorage paints instantly via
    // getSpinConfig fallback inside data.js; server copy then re-draws).
    try {
      if (typeof loadSpinConfigFromFirestore === 'function') {
        loadSpinConfigFromFirestore().then(config => {
          spinWheelConfig = config;
          const wheelOpen = document.getElementById('spin-wheel-modal');
          if (wheelOpen && wheelOpen.classList.contains('open')) drawWheel();
        }).catch(err => {
          console.error('[SpinWheel] ✗ Config load failed, using cache/defaults:', err);
          spinWheelConfig = (typeof getSpinConfig === 'function') ? getSpinConfig() : null;
        });
      } else {
        spinWheelConfig = (typeof getSpinConfig === 'function') ? getSpinConfig() : null;
      }
    } catch (e) {
      console.error('[SpinWheel] ✗ Config bootstrap error:', e);
    }

    // REQUIREMENT 1: auto-show the Info Modal on EVERY page load/refresh
    // (deferred to the closeNoticeModal chain while the Notice is pending).
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', autoShowInfoModalOnLoad);
    } else {
      autoShowInfoModalOnLoad();
    }
  }

  // Script tag lives at </body>: DOM is ready, run immediately (zero-flicker).
  initSpinWheel();

  /* ---------- Expose for the inline onclick handlers / app.js hook ---------- */
  window.openSpinInfoModal = openSpinInfoModal;
  window.closeSpinInfoModal = closeSpinInfoModal;
  window.openSpinInfoModalAfterNotice = openSpinInfoModalAfterNotice;
  window.handleSpinNowClick = handleSpinNowClick;
  window.closeSpinWheelModal = closeSpinWheelModal;
  window.executeWheelSpin = executeWheelSpin;
  window.openSpinWheelModal = openSpinWheelModal;
})();

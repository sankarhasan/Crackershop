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
     • spin_wheel_config/'config' → { segments: [10 × slot] } (admin-managed)
     • users/{uid}                → { email, last_spun_at (serverTimestamp),
                                       last_result, last_prize_won }
   The 24-hour cooldown is EMAIL/ACCOUNT-based: it lives ONLY in the signed-in
   user's Firestore user document — never in localStorage — so logging out and
   spinning with a different account on the same browser is never blocked by
   the previous account's cooldown, and the lock follows the user across
   devices.

   Styling lives in css/spin-wheel.css (plain CSS — no Tailwind).
   ========================================================================== */
(function () {
  'use strict';

  const NOTICE_ACK_STORAGE_KEY = 'noticeAcknowledged'; // app.js writes this
  const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000;
  const SPIN_ANIM_MS = 4000; // must match the canvas CSS transition duration

  let spinWheelConfig = null;       // { segments: [10] } resolved slot strings
  let currentRotation = 0;          // cumulative clockwise degrees on the canvas
  let isSpinning = false;
  let pendingSpinAfterAuth = false; // "Spin Now" pressed while signed out
  let spinCheck = null;             // { uid, record } verified at Spin-Now click
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

  /* ---------- Firestore-only spin cooldown (users/{uid} document) ----------
     No localStorage anywhere in this path: eligibility always reflects the
     CURRENT signed-in account's own database record. */

  /** Firestore Timestamp | ISO string | Date → epoch millis (null if absent). */
  function toMillis(value) {
    if (!value) return null;
    if (typeof value.toMillis === 'function') return value.toMillis();
    if (typeof value.toDate === 'function') return value.toDate().getTime();
    const ms = new Date(value).getTime();
    return Number.isFinite(ms) ? ms : null;
  }

  function isLockActive(entry) {
    if (!entry) return false;
    // A "Try Again" outcome never locks — the user may re-spin immediately.
    if (entry.last_result === 'try_again') return false;
    const ts = toMillis(entry.last_spun_at);
    // null last_spun_at = serverTimestamp() write still pending → treat as
    // locked (a spin DID just happen; fail closed, never grant a bonus spin).
    if (ts === null) return entry.last_spun_at === null && !!entry.last_result;
    return (Date.now() - ts) < TWENTY_FOUR_HOURS_MS;
  }

  function lockHoursRemaining(entry) {
    const ts = toMillis(entry && entry.last_spun_at);
    if (ts === null) return 24;
    const remaining = Math.max(0, TWENTY_FOUR_HOURS_MS - (Date.now() - ts));
    return Math.max(1, Math.ceil(remaining / (60 * 60 * 1000)));
  }

  /**
   * Live-query the signed-in user's spin record: users/{uid}.
   * Resolves { ok, record } — ok=false means the DB could not be reached,
   * and the caller must NOT allow a spin on an unverified account.
   */
  function fetchUserSpinRecord() {
    const user = authUser();
    if (!user) return Promise.resolve({ ok: false, record: null });
    if (!window.db) {
      console.error('[SpinWheel] ✗ Firestore (window.db) not initialized — cannot verify spin status.');
      return Promise.resolve({ ok: false, record: null });
    }

    return window.db.collection('users').doc(user.uid).get({ source: 'server' })
      .then(docSnap => {
        const record = (docSnap && docSnap.exists) ? docSnap.data() : null;
        return { ok: true, record: record };
      })
      .catch(err => {
        console.error('[SpinWheel] ✗ Failed to read spin cooldown from Firestore. Code:', err && err.code, 'Message:', err && err.message, err);
        return { ok: false, record: null };
      });
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
  function buildCooldownMessage(user, record) {
    const hoursLeft = lockHoursRemaining(record);
    return `⏳ This account (${user && user.email ? user.email : 'this user'}) has already spun today! Please try again in ${hoursLeft} hour${hoursLeft === 1 ? '' : 's'}.`;
  }

  /**
   * Single validation point for a spin attempt:
   *   1. Force login check (KPR Client Portal modal — no native alert).
   *   2. Live Firestore query of users/{uid} for THIS account's last_spun_at.
   *   3. Block when a conclusive spin happened < 24h ago; otherwise run
   *      onEligible(). DB read failures fail closed (no unverified spins).
   */
  function evaluateSpinEligibility(onEligible) {
    const user = authUser();
    if (!user || !user.email) {
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

    fetchUserSpinRecord().then(result => {
      if (!result.ok) {
        spinCheck = null;
        showLockHint('⚠️ Unable to verify your spin status right now. Please try again.');
        toast('Unable to verify spin status. Please try again.', 'error');
        return;
      }

      spinCheck = { uid: user.uid, record: result.record };

      if (isLockActive(result.record)) {
        // Cooldown message stays INSIDE the info modal (custom UI, no alert()).
        showLockHint(buildCooldownMessage(user, result.record));
        return;
      }

      showLockHint('');
      if (typeof onEligible === 'function') onEligible();
    });
  }

  function handleSpinNowClick() {
    evaluateSpinEligibility(() => {
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
        Palette gradients, depth shadows and multi-line white labels. Slice 0
        MUST keep starting at 12 o'clock (-90°): executeWheelSpin's pointer
        math resolves winners against that exact geometry.
     ========================================================================== */
  const SEGMENT_PALETTE = [
    { start: '#FF3B00', end: '#991B00' }, // 1. Red-Orange Gradient
    { start: '#FF6A00', end: '#993D00' }, // 2. Bright Orange Gradient
    { start: '#FFAA00', end: '#996600' }, // 3. Warm Yellow-Orange Gradient
    { start: '#FFD600', end: '#806B00' }, // 4. Vivid Yellow Gradient
    { start: '#FFF59D', end: '#7A7538' }, // 5. Soft Light Yellow Gradient
    { start: '#CE93D8', end: '#6A1B9A' }, // 6. Light Orchid Purple Gradient
    { start: '#8E24AA', end: '#4A148C' }, // 7. Rich Deep Purple Gradient
    { start: '#673AB7', end: '#311B92' }, // 8. Royal Indigo-Purple Gradient
    { start: '#512DA8', end: '#1A237E' }, // 9. Dark Violet Gradient
    { start: '#311B92', end: '#0D47A1' }  // 10. Deep Navy-Purple Gradient
  ];

  /** Greedy word-wrap for the radial slice labels (≈11 chars per line). */
  function wrapWheelText(text, maxLen) {
    const words = text.split(' ');
    const lines = [];
    let currentLine = words[0];

    for (let w = 1; w < words.length; w++) {
      if ((currentLine + ' ' + words[w]).length <= maxLen) {
        currentLine += ' ' + words[w];
      } else {
        lines.push(currentLine);
        currentLine = words[w];
      }
    }
    lines.push(currentLine);

    // Limit to max 2-3 lines so it never overlaps edges
    if (lines.length > 3) {
      lines.splice(2);
      lines[1] += '...';
    }
    // A single un-breakable long word must not bleed past the rim
    return lines.map(line => (line.length > maxLen + 3 ? line.substring(0, maxLen + 2) + '…' : line));
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
    const centerX = cssSize / 2, centerY = cssSize / 2;
    const outerRadius = cssSize / 2 - 4;
    const innerRadius = 35; // Center Start Button Gap
    const arcSize = (2 * Math.PI) / count;

    ctx.save();
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, cssSize, cssSize);

    for (let i = 0; i < count; i++) {
      const angle = -Math.PI / 2 + i * arcSize; // slice 0 begins at 12 o'clock
      const colorTheme = SEGMENT_PALETTE[i % SEGMENT_PALETTE.length];

      // --- A. DRAW SEGMENT WITH RADIAL GRADIENT (depth effect) ---
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(centerX, centerY);
      ctx.arc(centerX, centerY, outerRadius, angle, angle + arcSize);
      ctx.closePath();

      const gradient = ctx.createRadialGradient(
        centerX, centerY, innerRadius,
        centerX, centerY, outerRadius
      );
      gradient.addColorStop(0, colorTheme.start);
      gradient.addColorStop(1, colorTheme.end);
      ctx.fillStyle = gradient;
      ctx.fill();

      // --- B. SUBTLE INNER SHADOW + WHITE SEGMENT SEPARATOR ---
      ctx.beginPath();
      ctx.arc(centerX, centerY, outerRadius, angle, angle + arcSize);
      ctx.strokeStyle = 'rgba(0, 0, 0, 0.25)';
      ctx.lineWidth = 4;
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(centerX, centerY);
      ctx.lineTo(
        centerX + outerRadius * Math.cos(angle),
        centerY + outerRadius * Math.sin(angle)
      );
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.35)';
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.restore();

      // --- C. MULTI-LINE WHITE TEXT RENDERING (along the radius) ---
      ctx.save();
      ctx.translate(centerX, centerY);
      ctx.rotate(angle + arcSize / 2);

      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = '#FFFFFF'; // Pure White Text
      ctx.font = '900 10px sans-serif'; // Compact Bold Font
      // Faint dark glow keeps white labels legible on the light-yellow slices
      ctx.shadowColor = 'rgba(0, 0, 0, 0.55)';
      ctx.shadowBlur = 3;

      const lines = wrapWheelText(resolveSegmentLabel(segs[i]).toUpperCase(), 11);
      const radiusPos = outerRadius * 0.62;
      const lineHeight = 11;
      const startY = -((lines.length - 1) * lineHeight) / 2;

      lines.forEach((line, index) => {
        ctx.fillText(line, radiusPos, startY + (index * lineHeight));
      });
      ctx.restore();
    }

    // Outer amber rim (brand frame around the gradient pie)
    ctx.beginPath();
    ctx.arc(centerX, centerY, outerRadius, 0, 2 * Math.PI);
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

    // Hard re-check against the record verified at Spin-Now time: the wheel
    // can sit open across a sign-out, so validate uid + cooldown synchronously.
    const user = authUser();
    if (!user || !user.email) {
      msg.textContent = '🔒 Please sign in to spin the lucky wheel.';
      pendingSpinAfterAuth = true;
      try { if (typeof openAuthModal === 'function') openAuthModal(); } catch (e) {}
      return;
    }
    if (!spinCheck || spinCheck.uid !== user.uid) {
      // Account switched or never verified through the button — re-run the
      // full eligibility gate before allowing this spin.
      evaluateSpinEligibility(() => {});
      msg.textContent = '⏳ Verifying your account…';
      return;
    }
    if (isLockActive(spinCheck.record)) {
      msg.textContent = buildCooldownMessage(user, spinCheck.record);
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
     6. Result handling — cooldown writes, gift carting
     ========================================================================== */
  function persistSpinResult(slot) {
    const user = authUser();
    if (!user) return Promise.resolve();

    const isTryAgain = slot === 'try_again';
    const payload = {
      email: user.email || '',
      last_result: slot,
      last_prize_won: slot.indexOf('product:') === 0 ? slot.substring('product:'.length) : ''
    };
    // Only a CONCLUSIVE outcome starts the 24h cooldown; "Try Again" leaves
    // last_spun_at untouched so the immediate re-spin stays free.
    if (!isTryAgain) {
      payload.last_spun_at = (typeof firebase !== 'undefined' && firebase.firestore && firebase.firestore.FieldValue)
        ? firebase.firestore.FieldValue.serverTimestamp()
        : new Date().toISOString();
    }

    if (!window.db) {
      console.error('[SpinWheel] ✗ window.db is NULL — spin result could not be persisted.');
      return Promise.resolve();
    }

    return window.db.collection('users').doc(user.uid).set(payload, { merge: true })
      .then(() => {
        console.log('[SpinWheel] ✓ Spin result saved to users/' + user.uid);
        // Mirror the write into the local verification snapshot with a plain
        // Date (the serverTimestamp resolves null until the round-trip lands).
        const localRecord = Object.assign({}, payload);
        if (!isTryAgain) localRecord.last_spun_at = new Date().toISOString();
        spinCheck = { uid: user.uid, record: localRecord };
      })
      .catch(err => {
        console.error('[SpinWheel] ✗ Failed to save spin result. Code:', err && err.code, 'Message:', err && err.message, err);
        toast('Could not save your spin result. Please contact the store.', 'error');
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
        // No cooldown written — the user may immediately spin again.
        setSpinButtonEnabled(true, 'SPIN');
        persistSpinResult(slot); // records last_result/last_prize_won only
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
        spinCheck = null; // account changed/signed out — stale verification
        if (user && pendingSpinAfterAuth) {
          // Same click-time validation path: cooldown/notif messages land in
          // the info modal's hint line, which is still open behind the portal.
          pendingSpinAfterAuth = false;
          evaluateSpinEligibility(() => {
            closeSpinInfoModal();
            openSpinWheelModal();
          });
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

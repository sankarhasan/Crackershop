/* ==========================================================================
   KPR Crackers - Firebase Configuration & Initialization (compat SDK)
   Loaded on BOTH the public storefront (index.html) and the admin portal
   (admin.html). Initializes the Firebase App + Firestore once and exposes a
   shared `window.db` handle. Auth is initialized separately in admin.js
   (the auth SDK is only loaded on the admin page).
   ========================================================================== */

const firebaseConfig = {
  apiKey: "AIzaSyCVLMH1mJscu5ulEHnq7RrocSiorVMqslM",
  authDomain: "kpr-crackers.firebaseapp.com",
  projectId: "kpr-crackers",
  storageBucket: "kpr-crackers.firebasestorage.app",
  messagingSenderId: "328227866235",
  appId: "1:328227866235:web:9af1a97ecf9487794384de",
  measurementId: "G-7SZ2EV9YXD"
};

// Guard against double initialization if the script is included more than once.
if (typeof firebase !== 'undefined') {
  if (!firebase.apps || !firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
  }

  // Shared Firestore handle used by both the enquiry form and the admin panel.
  window.db = firebase.firestore();
} else {
  console.error('[Firebase] SDK not loaded. Check that the firebase-*-compat.js CDN scripts are included before firebase-config.js.');
  window.db = null;
}

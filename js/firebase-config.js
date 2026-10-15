/* ==========================================================================
   KPR Crackers - Firebase Configuration & Initialization (compat SDK)
   Loaded on BOTH the public storefront (index.html and friends) and the
   admin portal (admin.html). Initializes the DEFAULT Firebase App (customer
   sessions: storefront Auth + Firestore via window.db) and exposes
   window.firebaseConfig so admin.js can boot its OWN named app
   ("kpr-admin") with an independent Auth + Firestore session on the same
   project — admin and customer logins never sign each other out.

   Auth: the Auth SDK (firebase-auth-compat.js) is loaded on EVERY storefront
   page too, because the KPR Client Portal (mandatory sign-in before checkout,
   see js/app.js -> requireAuthForOrder) needs it. app.js uses the DEFAULT
   app's firebase.auth(); admin.js uses firebase.auth(adminApp) instead.
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

  // Shared config object for the admin page's named app (js/admin.js).
  window.firebaseConfig = firebaseConfig;

  // Shared Firestore handle used by the storefront (default app). On the
  // ADMIN page js/admin.js rebinds window.db to the separate "kpr-admin"
  // app instance so admin Firestore calls carry the admin token.
  window.db = firebase.firestore();
} else {
  console.error('[Firebase] SDK not loaded. Check that the firebase-*-compat.js CDN scripts are included before firebase-config.js.');
  window.db = null;
}

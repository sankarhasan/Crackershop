/* ==========================================================================
   KPR Crackers — ONE-TIME admin role authorization helper (local only)
   --------------------------------------------------------------------------
   Grants / revokes the `admin: true` custom claim that firebase_auth +
   firestore.rules use as the single source of truth for admin rights.

   WHY THIS IS SAFE (and works on the Spark plan):
   • The Firebase Admin SDK runs HERE on your laptop — nothing is hosted.
     Custom claims are then stamped onto the account's ID tokens by
     Firebase's own auth servers; they are cryptographically signed and
     cannot be forged or self-assigned from any browser.
   • Customer registration code paths never touch this script, so no
     customer can ever receive the claim.
   • The claim lives on the immutable UID, so changing the admin email in
     the Settings page keeps admin access intact.

   ONE-TIME SETUP (≈5 minutes):
   1. Firebase Console → Project settings → Service accounts →
      "Generate new private key" → save the JSON as
         d:\KPR Crackers\scripts\serviceAccountKey.json
      (it is git-ignored — NEVER commit or share it, and rotate it later
       if you do).
   2. npm --prefix scripts install
   3. Find the intended admin account's UID:
         node scripts/set-admin-claim.js list
      (look for the existing admin login email; if several accounts look
       like admins, authorize ONE uid now and demote the rest with `clear`
       only AFTER you have confirmed the keeper — avoids lockout.)
   4. Grant the claim:
         node scripts/set-admin-claim.js set <UID>
   5. The admin must sign OUT and sign IN again at admin.html (fresh ID
      token carries the claim). Then deploy the rules:
         firebase deploy --only firestore:rules

   Revoke at any time:  node scripts/set-admin-claim.js clear <UID>
   ========================================================================== */

const fs = require("fs");
const path = require("path");
const { initializeCert, getAuth } = require("./lib/adminBoot");

function usage() {
  console.log("Usage:");
  console.log("  node set-admin-claim.js list [pageSize]   (pageSize 1-1000, default 1000)");
  console.log("  node set-admin-claim.js check  [email]    (read-only diagnostics; no email = project config only)");
  console.log("  node set-admin-claim.js set   <uid>");
  console.log("  node set-admin-claim.js clear <uid>");
  process.exit(1);
}

/* Validate the optional page-size CLI argument BEFORE it reaches the SDK:
   integer, 1-1000 inclusive. Rejects undefined/NaN/0/negatives/>1000
   instead of silently sending a bad maxResults. */
function parsePageSize(raw) {
  if (raw === undefined) return 1000; // SDK-supported default page size
  const n = Number(raw);
  if (!Number.isInteger(n) || n < 1 || n > 1000) {
    console.error(`Invalid pageSize "${raw}" — must be an integer between 1 and 1000.`);
    process.exit(1);
  }
  return n;
}

/* Pre-flight safety: the key's project must be the SAME project the live
   web app uses (js/firebase-config.js). Granting claims in the wrong
   project is the classic "admin still can't log in" trap. Aborts on
   mismatch with a clear explanation instead of touching any user. */
function assertProjectMatches(keyProjectId) {
  const configPath = path.resolve(__dirname, "..", "js", "firebase-config.js");
  if (!fs.existsSync(configPath)) return; // no web config to compare against
  const src = fs.readFileSync(configPath, "utf8");
  const m = src.match(/projectId:\s*"([^"]+)"/);
  if (!m) return;
  if (m[1] !== keyProjectId) {
    console.error("✖ Project mismatch — aborting before touching any account.");
    console.error(`   Service-account key project : ${keyProjectId}`);
    console.error(`   Live web app project        : ${m[1]}  (js/firebase-config.js)`);
    console.error("   Download the service-account key from the " + m[1] + " Firebase project");
    console.error("   (Console → Project settings → Service accounts) and retry.");
    process.exit(4);
  }
  console.log(`[pre-flight] ✔ key project "${keyProjectId}" matches the live web app.\n`);
}

(async () => {
  const [cmd, arg] = process.argv.slice(2);
  if (!cmd) usage();
  const boot = initializeCert();
  assertProjectMatches(boot.projectId);
  const auth = getAuth();

  if (cmd === "list") {
    const pageSize = parsePageSize(arg);
    // NOTE on the original bug: this SDK build (firebase-admin 12.7.0) only
    // accepts POSITIONAL args here — listUsers({maxResults: n}) throws a
    // misleading auth/argument-error for the options object. Positional
    // (maxResults, pageToken) works and is what we use.
    let pageToken;
    let total = 0;
    let pages = 0;
    do {
      const resp = await auth.listUsers(pageSize, pageToken);
      pages++;
      resp.users.forEach((u) => {
        const claim = u.customClaims && u.customClaims.admin === true ? "  [ADMIN]" : "";
        console.log(`${u.uid}  ${u.email || "(no email)"}${claim}`);
      });
      total += resp.users.length;
      pageToken = resp.pageToken; // follow cursor so accounts past page 1 aren't skipped
    } while (pageToken);
    console.log(`\n(${total} user${total === 1 ? "" : "s"} across ${pages} page${pages === 1 ? "" : "s"})`);
    if (total === 0) console.log("(no users)");
    return;
  }

  if (cmd === "check") {
    // READ-ONLY diagnostics. Never prints passwords/tokens, never mutates.
    try {
      const cfg = await auth.projectConfigManager().getProjectConfig();
      const emailPwd = (cfg.signIn && cfg.signIn.email) || {};
      console.log("--- Project sign-in configuration ---");
      console.log("Email/Password provider :", emailPwd.enabled ? "ENABLED \u2714" : "DISABLED \u2716  <-- password logins fail with auth/invalid-credential when disabled");
      console.log("Password signup allowed :", cfg.signIn && cfg.signIn.allowPasswordSignup ? "yes" : "no");
      console.log("Anonymous provider      :", cfg.signIn && cfg.signIn.anonymous && cfg.signIn.anonymous.enabled ? "enabled" : "disabled");
    } catch (e) {
      console.log("--- Project sign-in configuration ---");
      console.log("(not readable with service-account credentials:", e.code || e.message.split("\n")[0], ")");
      console.log("Verify manually in Firebase Console \u2192 Authentication \u2192 Sign-in method that Email/Password is ENABLED.\n");
    }

    if (arg) {
      console.log(`\n--- Account: ${arg} ---`);
      const u = await auth.getUserByEmail(arg).catch(() => null);
      if (!u) {
        console.log("RESULT: NO SUCH ACCOUNT in Firebase Authentication for project", boot.projectId);
        console.log("        -> password login returns auth/invalid-credential (enumeration protection masks user-not-found).");
        return;
      }
      const hasPw = (u.providerData || []).some(p => p.providerId === "password");
      console.log("uid                :", u.uid);
      console.log("password provider  :", hasPw ? "yes \u2714 (password login possible)" : "NO \u2716 (created without a password -> sign-in can never succeed)");
      console.log("disabled           :", u.disabled ? "YES \u2716 account disabled" : "no");
      console.log("emailVerified      :", u.emailVerified ? "yes" : "no");
      console.log("customClaims       :", JSON.stringify(u.customClaims || {}));
      console.log("admin claim        :", u.customClaims && u.customClaims.admin === true ? "ADMIN \u2714" : "not admin \u2014 run: node set-admin-claim.js set " + u.uid);
    } else {
      console.log("\n--- All accounts (provider / claim overview) ---");
      let pageToken;
      do {
        const resp = await auth.listUsers(1000, pageToken);
        resp.users.forEach((u) => {
          const hasPw = (u.providerData || []).some(p => p.providerId === "password");
          const admin = u.customClaims && u.customClaims.admin === true;
          console.log(
            `${u.uid}  ${u.email || "(no email)"}  password:${hasPw ? "yes" : "NO " + (u.providerData.map(p=>p.providerId).join(",") || "none")}  disabled:${u.disabled ? "YES" : "no"}  claim:${admin ? "[ADMIN]" : "-"}`
          );
        });
        pageToken = resp.pageToken;
      } while (pageToken);
      console.log("\nPass an email (node set-admin-claim.js check someone@example.com) for a deep-dive on one account.");
    }
    return;
  }

  if (!arg) usage();
  const user = await auth.getUser(arg).catch(() => null);
  if (!user) { console.error(`No user with uid "${arg}". Run: node set-admin-claim.js list`); process.exit(2); }

  if (cmd === "set") {
    await auth.setCustomUserClaims(arg, { admin: true });
    console.log(`✔ Granted admin claim to ${user.email || arg} (${arg}).`);
    console.log("  → They must sign out and sign in again at admin.html.");
    return;
  }
  if (cmd === "clear") {
    await auth.setCustomUserClaims(arg, {});
    console.log(`✘ Revoked admin claim from ${user.email || arg} (${arg}).`);
    return;
  }
  usage();
})().catch((err) => {
  const msg = err && err.message ? err.message : String(err);
  console.error("Failed:", msg);
  // Credential/network resolution guards — never happens with a valid key
  // now, but if it ever does, point at the actual cause instead of a stack.
  if (/metadata\.google\.internal|ENOTFOUND|Failed to determine project ID/.test(msg)) {
    console.error("\nThis looks like a credentials issue: place a valid service-account");
    console.error("key at scripts\\serviceAccountKey.json (see instructions at the top");
    console.error("of set-admin-claim.js). Application Default Credentials are NOT used.");
  }
  process.exit(1);
});

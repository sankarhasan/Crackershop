/* ==========================================================================
   Credentials bootstrap for the local admin-claim helper (Windows-safe).

   EXACTLY ONE supported credential source — an explicit service-account
   JSON file. NO Application Default Credentials, NO metadata-server
   probing (metadata.google.internal only exists on Google Cloud VMs; on a
   Windows PC it fails with ENOTFOUND — the bug this file used to have),
   NO silent fallbacks. If the key is missing or malformed we abort with
   clear instructions BEFORE any API call is attempted.

   Key file resolution (absolute, anchored to THIS file — never depends on
   the terminal's current working directory):
     1. GOOGLE_APPLICATION_CREDENTIALS env var (if set AND the file exists)
     2. <project>\scripts\serviceAccountKey.json

   The service account JSON grants FULL project privileges: treat it like a
   password. It is git-ignored; never commit, paste, or print its contents.
   ========================================================================== */

const path = require("path");
const fs = require("fs");
const admin = require("firebase-admin");

// Anchored: __dirname = ...\scripts\lib  ->  ...\scripts\serviceAccountKey.json
const DEFAULT_KEY_PATH = path.resolve(__dirname, "..", "serviceAccountKey.json");

function resolveKeyPath() {
  const envPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  if (envPath) {
    const abs = path.resolve(envPath);
    if (fs.existsSync(abs)) return abs;
    // Env var set but pointing nowhere: fail loudly instead of guessing.
    fail(`GOOGLE_APPLICATION_CREDENTIALS is set to "${abs}" but that file does not exist.`, null);
  }
  return DEFAULT_KEY_PATH; // may not exist — handled by loadAndValidate()
}

// Never print key material; only field NAMES are ever referenced.
function fail(why, keyPath) {
  console.error("✖ Service account configuration problem: " + why + "\n");
  console.error("How to fix (one-time, ~2 minutes):");
  console.error("  1. Firebase Console → Project settings → Service accounts");
  console.error('     → "Create new key" → JSON → download, then rename the');
  if (keyPath) {
    console.error(`     downloaded file to exactly:\n       ${keyPath}`);
  } else {
    console.error("     downloaded file to scripts\\serviceAccountKey.json");
  }
  console.error("  2. Re-run the command. The file is git-ignored — NEVER commit it.");
  process.exit(3);
}

/* Structural validation BEFORE any claim modification (requirement 9).
   Returns { sa, projectId } or aborts. private_key content is never logged. */
function loadAndValidate(keyPath) {
  if (!fs.existsSync(keyPath)) {
    fail(
      `No service-account key found at:\n       ${keyPath}\n     (and GOOGLE_APPLICATION_CREDENTIALS is not set.)`,
      keyPath
    );
  }

  let raw;
  try {
    raw = fs.readFileSync(keyPath, "utf8");
  } catch (e) {
    fail(`The key file exists but could not be read: ${e.code || e.message}`, keyPath);
  }

  let sa;
  try {
    sa = JSON.parse(raw);
  } catch (e) {
    fail(
      `"${path.basename(keyPath)}" is not valid JSON (truncated download or an edit mishap?). ` +
      `Re-download a fresh key: ${e.message.split("in JSON")[0]}`,
      keyPath
    );
  }

  const problems = [];
  if (sa.type !== "service_account") {
    problems.push(`expected a "service_account" key JSON, got type "${sa.type || "(missing)"}" — did you download the right file?`);
  }
  if (typeof sa.project_id !== "string" || !/^[a-z][a-z0-9-]{4,29}$/.test(sa.project_id)) {
    problems.push(`"project_id" is missing or malformed`);
  }
  if (typeof sa.client_email !== "string" || sa.client_email.indexOf("@") < 0) {
    problems.push(`"client_email" is missing or malformed`);
  }
  if (typeof sa.private_key !== "string" ||
      sa.private_key.indexOf("-----BEGIN PRIVATE KEY-----") === -1 ||
      sa.private_key.indexOf("-----END PRIVATE KEY-----") === -1) {
    problems.push(`"private_key" is missing or looks truncated — re-download the key (never hand-edit it)`);
  }
  if (problems.length) {
    fail("File: " + keyPath + "\n     - " + problems.join("\n     - "), keyPath);
  }
  return sa;
}

function initializeCert() {
  if (admin.apps.length) return { projectId: admin.apps[0] && admin.apps[0].options.projectId };

  const keyPath = resolveKeyPath();
  const sa = loadAndValidate(keyPath);

  // Project ID comes FROM the key JSON itself — never guessed, never
  // discovered via the metadata server.
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: sa.project_id,
      clientEmail: sa.client_email,
      privateKey: sa.private_key,
    }),
    projectId: sa.project_id,
  });

  // Non-secret identity line so you can eyeball the right project/account
  // before any user record is touched.
  console.log(`[adminBoot] Service account: ${sa.client_email}`);
  console.log(`[adminBoot] Project:         ${sa.project_id}\n`);
  return { projectId: sa.project_id, clientEmail: sa.client_email };
}

module.exports = { initializeCert, getAuth: () => admin.auth() };

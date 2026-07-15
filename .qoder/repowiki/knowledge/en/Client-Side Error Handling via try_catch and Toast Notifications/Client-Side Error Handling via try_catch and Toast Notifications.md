---
kind: error_handling
name: Client-Side Error Handling via try/catch and Toast Notifications
category: error_handling
scope:
    - '**'
source_files:
    - js/admin.js
    - js/app.js
    - admin.html
---

This single-page static site uses a minimal, in-process error-handling approach with no centralized framework or middleware. Errors are handled locally at the call site using JavaScript `try`/`catch` blocks and user-facing feedback is delivered through a small inline toast helper.

**What system/approach is used**
- No dedicated error types, sentinel values, or error-code registry exist.
- Unrecoverable data-corruption cases (e.g. localStorage containing non-array JSON) are caught with `try { ... } catch (e) { ... }`, the corrupted key is removed, and a safe default dataset is returned.
- User-facing validation failures (missing banner image, invalid credentials) are surfaced to the user via a local `showAdminToast(message, type)` function that injects DOM-based toast notifications; login errors toggle the visibility of an existing `#login-error-msg` element.
- There is no global `window.onerror` / unhandled-rejection handler, no `panic`/`recover` equivalent, and no server-side or middleware layer — all handling is synchronous and co-located with the UI logic.

**Key files and packages**
- `js/admin.js` — contains the `showAdminToast` helper (line ~886), the banner-data normalization `try`/`catch` block (lines 998–1015), and all admin-side user-facing error messages.
- `js/app.js` — mirrors the same banner-data normalization pattern on the storefront side (lines 100–116).
- `admin.html` — hosts the `#login-error-msg` container toggled during authentication failure.

**Architecture and conventions**
- Data-loading functions follow a consistent shape: attempt to parse from `localStorage`, validate structure (`Array.isArray`), normalize fields, persist normalized data, and fall back to defaults inside the `catch` branch.
- Validation errors do not throw; they return early after calling `showAdminToast(..., 'error')` so the caller can continue rendering.
- Success and informational outcomes use `showAdminToast(..., 'success' | 'info')` rather than throwing or returning special values.
- There is no cross-cutting error propagation mechanism — each feature owns its own error path.

**Rules developers should follow**
- Wrap any `JSON.parse` / `localStorage` read in a `try`/`catch`; if parsing fails, remove the stale key and return the built-in defaults.
- Prefer `showAdminToast(message, 'error')` for user-visible problems instead of `alert()` or bare `console.error`.
- Do not throw domain-level errors up the stack; handle them where the user action occurs and return early.
- Avoid introducing global error handlers unless there is a clear need — keep error paths close to the triggering UI code.
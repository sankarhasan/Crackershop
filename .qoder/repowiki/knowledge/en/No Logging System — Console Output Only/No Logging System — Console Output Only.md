---
kind: logging_system
name: No Logging System — Console Output Only
category: logging_system
scope:
    - '**'
---

This repository does not implement a logging system. The codebase is a pure client-side static site (HTML + CSS + vanilla JS) that persists data in `localStorage`/`sessionStorage` and renders UI directly from DOM manipulation. There are no logging frameworks, no structured loggers, no log-level configuration, and no dedicated logging modules or files.

Evidence:
- Zero occurrences of `console.log`, `console.error`, `console.warn`, `console.info`, or any third-party logger import across all JavaScript files (`js/app.js`, `js/admin.js`, `js/data.js`, `js/banners.js`).
- No `log/`, `logging/`, or similar directories exist.
- Error handling uses inline `try/catch` with silent fallbacks (e.g., banner JSON parsing falls back to defaults by removing the key and re-invoking the initializer), rather than emitting logs.
- User-facing feedback is delivered exclusively through on-screen toast notifications (`showToast` in `app.js`, `showAdminToast` in `admin.js`) and inline DOM messages — not via console output.

As a result, there are no conventions, levels, sinks, or structured fields to document for this category.
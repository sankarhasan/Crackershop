---
kind: dependency_management
name: No Dependency Management — Pure Static Site with No Package Manager
category: dependency_management
scope:
    - '**'
source_files:
    - index.html
    - admin.html
---

This repository is a pure client-side static site (HTML + CSS + vanilla JavaScript) with no dependency management system in place. There are no package manager manifests (no `package.json`, `go.mod`, `Gemfile`, `requirements.txt`, etc.), no lockfiles, no vendored third-party libraries, and no build tooling. All external dependencies are loaded directly via CDN links at runtime: Google Fonts (`fonts.googleapis.com` / `fonts.gstatic.com`) are referenced through `<link rel="stylesheet">` tags in both `index.html` and `admin.html`. The application's own code lives entirely in local files under `js/` (`data.js`, `app.js`, `admin.js`, `banners.js`) and `css/` (`styles.css`, `admin.css`), which are included via relative `<script>` and `<link>` tags. There is no bundler, transpiler, or asset pipeline — the site runs as-is from any static file server. As a result, there are no version pins, no update strategy, and no mechanism to audit or replace the Google Fonts dependency.
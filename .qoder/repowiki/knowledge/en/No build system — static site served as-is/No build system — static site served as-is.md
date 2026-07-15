---
kind: build_system
name: No build system — static site served as-is
category: build_system
scope:
    - '**'
---

This repository is a pure client-side static site (HTML + CSS + vanilla JS) with no build tooling, dependency manifests, containerization, or CI configuration. There are no Makefiles, Dockerfiles, package.json, webpack/vite/rollup configs, CI pipelines, or any other build-system artifacts. The project is intended to be deployed by simply copying the root files (`index.html`, `admin.html`, `css/`, `js/`) onto any static web server or CDN; all data persistence is handled via browser localStorage at runtime.
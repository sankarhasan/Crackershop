Two sibling HTML entry points share one data layer:
- `index.html` loads `js/data.js` then `js/app.js` and renders the public storefront (hero carousel, category grid, product catalog with search/filter, testimonials slider, enquiry form, WhatsApp widget, sticky cart drawer).
- `admin.html` loads `js/data.js` then `js/admin.js` and renders a gated SPA dashboard with sidebar navigation between Dashboard, Products, Categories, Enquiries, and Banners sections.

Data persistence is centralized in `js/data.js`, which seeds default categories, products, testimonials, and enquiries into `localStorage` keys (`jcs_categories`, `jcs_products`, `jcs_testimonials`, `jcs_enquiries`) on first load and exposes `get*`/`save*` accessor functions plus a `generateId` helper. Both pages mutate these same keys so admin edits are immediately visible on the storefront.

Banners use a separate `localStorage` key `bannersData`; both `app.js` and `admin.js` seed identical defaults when the key is absent, and banner images are stored as inline Base64 data URLs via `<input type="file">` + `FileReader.readAsDataURL`. The cart lives in `sessionStorage` under `kpr_cart` and is scoped to the storefront only.

Authentication is a simple `localStorage` session flag (`jcs_admin_session = 'active_session'`) checked by `checkAuth()` on `admin.html` load; credentials are hard-coded (`admin` / `admin123`).

Styling is split: `css/styles.css` for the storefront and `css/admin.css` for the dashboard; `js/banners.js` exists as a shared placeholder but is currently empty. There is no build step — files are served directly from disk or any static host.
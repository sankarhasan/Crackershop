# TODO

- [ ] Implement local image upload for Category modals (Add/Edit)
- [x] Update `admin.html`: replace CATEGORY IMAGE URL/PATH input with hidden file input + Upload button + preview container
- [x] Update `js/admin.js`: add FileReader base64 conversion + preview + save logic (keep existing image if no new file)

  - [x] Ensure edit modal initializes preview from existing `categoryImageUrl`/legacy `image`
- [x] Verify storefront rendering uses base64 src for category cards (`js/app.js`)
- [ ] Smoke test manually in browser: add category with image, edit category w/out image, edit category w/ new image




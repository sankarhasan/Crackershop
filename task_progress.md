# State-wise Minimum Order Rules Implementation Plan

## Task Progress

### Phase 1: Static Top Announcement Ticker Update
- [ ] Update index.html ticker from "MINIMUM ORDER ₹2,000" to "MINIMUM ORDER ₹3,000" (4 locations)

### Phase 2: Admin Dashboard - State Minimum Rules Section
- [ ] Add sidebar navigation link for State Minimum Rules
- [ ] Create State Minimum Rules management section in admin.html
- [ ] Add Firestore sync functions in js/data.js for state rules
- [ ] Add admin management functions in js/admin.js
- [ ] Update Firestore security rules

### Phase 3: Frontend - Dynamic State Selection & Validation
- [ ] Add state dropdown to Shopping Cart sidebar in index.html
- [ ] Add state dropdown to Quick Enquiry form in index.html
- [ ] Refactor js/app.js to use dynamic state-based minimum order validation
- [ ] Update cart drawer warning messages for dynamic state limits

### Phase 4: Data Layer Integration
- [ ] Add state minimum rules data layer in js/data.js
- [ ] Implement get/set functions for state rules
- [ ] Add Firestore sync for state rules
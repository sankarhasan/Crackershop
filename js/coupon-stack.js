// KPR Crackers - Multiple Coupon Stacking System
// This module handles the successive discount compounding logic

/**
 * Get applied coupons array from localStorage
 */
function getAppliedCouponsList() {
  try {
    const stored = localStorage.getItem('applied_coupons_list');
    return stored ? JSON.parse(stored) : [];
  } catch (e) {
    return [];
  }
}

/**
 * Save applied coupons array to localStorage
 */
function saveAppliedCouponsList(couponsList) {
  localStorage.setItem('applied_coupons_list', JSON.stringify(couponsList));
}

/**
 * Calculate coupon discounts with successive compounding math.
 * Uses the Successive Discount Formula where each discount is calculated
 * on the newly reduced subtotal from the previous coupon.
 * 
 * Single coupon: Returns the coupon's configured percentage directly
 * Multiple coupons: Returns the compound effective rate of stacked coupons
 */
function calculateCouponDiscounts(totalOriginal, totalSavings) {
  const appliedCoupons = getAppliedCouponsList();
  const coupons = getCoupons ? getCoupons() : [];
  
  // Baseline subtotal after product discounts
  let subtotalAfterProductDiscounts = totalOriginal - totalSavings;
  let totalCouponCashDiscount = 0;
  
  // Collect valid coupon percentages for effective calculation
  const validCouponPercents = [];
  
  // Loop through applied coupons chronologically
  appliedCoupons.forEach(appliedCoupon => {
    const coupon = coupons.find(c => c.code === appliedCoupon.code && c.active === true);
    if (coupon && subtotalAfterProductDiscounts > 0) {
      // Collect the coupon's configured percentage
      validCouponPercents.push(coupon.discountPercent);
      
      // Calculate discount on CURRENT intermediate subtotal (successive/compound)
      const thisCouponDiscount = Math.round(subtotalAfterProductDiscounts * (coupon.discountPercent / 100));
      totalCouponCashDiscount += thisCouponDiscount;
      // Reduce the intermediate subtotal for next coupon
      subtotalAfterProductDiscounts -= thisCouponDiscount;
    }
  });
  
  // Calculate effective discount percentage for the coupon badge
  let effectiveCouponPercent = 0;
  
  if (validCouponPercents.length === 1) {
    // Single coupon: use its configured percentage directly
    effectiveCouponPercent = validCouponPercents[0];
  } else if (validCouponPercents.length > 1) {
    // Multiple coupons: calculate compound effective rate using successive formula
    // Formula: (1 - (1 - p1/100) * (1 - p2/100) * ...) * 100
    let compoundMultiplier = 1;
    validCouponPercents.forEach(percent => {
      compoundMultiplier = compoundMultiplier * (1 - percent / 100);
    });
    effectiveCouponPercent = Math.round((1 - compoundMultiplier) * 100);
  }
  
  return {
    totalCouponCashDiscount,
    effectiveCouponPercent,
    appliedCoupons
  };
}

/**
 * Apply a new coupon code to the stack
 */
function applyCouponToStack(code, discountPercent) {
  const appliedCoupons = getAppliedCouponsList();
  
  // Check if coupon already applied (prevent duplicates)
  if (appliedCoupons.find(c => c.code === code)) {
    return false;
  }
  
  // Add new coupon to the stack
  appliedCoupons.push({ code, discountPercent, appliedAt: Date.now() });
  saveAppliedCouponsList(appliedCoupons);
  return true;
}

/**
 * Clear all applied coupons
 */
function clearCouponStack() {
  localStorage.removeItem('applied_coupons_list');
  localStorage.removeItem('applied_coupon_code'); // Legacy cleanup
}

// Export functions to global scope for use in app.js
window.getAppliedCouponsList = getAppliedCouponsList;
window.saveAppliedCouponsList = saveAppliedCouponsList;
window.calculateCouponDiscounts = calculateCouponDiscounts;
window.applyCouponToStack = applyCouponToStack;
window.clearCouponStack = clearCouponStack;
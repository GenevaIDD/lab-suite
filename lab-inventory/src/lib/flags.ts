// Feature flags. Flip to false and redeploy to hide the feature.

// Admin "Add lot" button on lot-tracked items — lets an admin enter existing
// stock (manufacturer, expiry, quantity) directly, without recording a fake
// delivery. Intended for the initial inventory; set to false afterwards.
export const ENABLE_MANUAL_LOT_ENTRY = true

/**
 * TOBY Brand Kit – CDN URLs for external brand assets
 * All design tokens, fonts, and brand assets come from:
 * https://github.com/tobywsharotslicha/toby-brand-assets
 */

// Version ref from environment or fallback
// IMPORTANT: fallback must be "stable"
const TOBY_BRAND_VERSION =
  (import.meta as any).env?.VITE_TOBY_BRAND_REF || "stable";

// Optional cache-bust
const TOBY_BRAND_BUST =
  (import.meta as any).env?.VITE_TOBY_BRAND_BUST || "";

// CDN base URL
const TOBY_BRAND_CDN_BASE =
  `https://cdn.jsdelivr.net/gh/tobywsharotslicha/toby-brand-assets@${TOBY_BRAND_VERSION}`;

/**
 * Build CDN URL with proper encoding for paths with spaces
 */
export function cdn(path: string): string {
  const encodedPath = path
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");

  const url = `${TOBY_BRAND_CDN_BASE}/${encodedPath}`;
  return TOBY_BRAND_BUST ? `${url}?v=${TOBY_BRAND_BUST}` : url;
}

// ===============================
// Brand CSS URLs
// ===============================
export const TOBY_THEME_CSS_URL = cdn("themes/toby.css");
export const TOBY_SPRITES_CSS_URL = cdn("themes/sprites.css");

// ===============================
// Brand Image URLs
// ===============================
export const TOBY_LOGO_3D_URL = cdn("brand/logo/logo 3d.png");
export const TOBY_BG_RED_URL = cdn("brand/images/background/red.png");

// ===============================
// Brand version info (debug)
// ===============================
export const TOBY_BRAND_VERSION_INFO = {
  ref: TOBY_BRAND_VERSION,   // "stable" | "v1.0.x" | "main"
  bust: TOBY_BRAND_BUST || null,
  cdnBase: TOBY_BRAND_CDN_BASE,
};

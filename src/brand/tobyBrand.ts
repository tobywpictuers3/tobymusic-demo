// src/brand/tobyBrand.ts

/** version comes from ENV (recommended), fallback to pinned tag */
export const TOBY_BRAND_VERSION =
  import.meta.env.VITE_TOBY_BRAND_VERSION || "v1.0.3";

/** optional cache bust for dev */
const cacheBust = import.meta.env.VITE_TOBY_BRAND_BUST
  ? `?bust=${encodeURIComponent(import.meta.env.VITE_TOBY_BRAND_BUST)}`
  : "";

/** jsDelivr base pinned by tag */
export const TOBY_BRAND_CDN_BASE = `https://cdn.jsdelivr.net/gh/tobywsharotslicha/toby-brand-assets@${TOBY_BRAND_VERSION}`;

/** safe URL builder (handles spaces like "logo 3d.png") */
const cdn = (path: string) =>
  `${TOBY_BRAND_CDN_BASE}/${path
    .split("/")
    .map((p) => encodeURIComponent(p))
    .join("/")}${cacheBust}`;

/** CSS */
export const TOBY_THEME_CSS_URL = cdn("themes/toby.css");
export const TOBY_SPRITES_CSS_URL = cdn("themes/sprites.css");

/** Assets you asked to use on login */
export const TOBY_LOGO_3D_URL = cdn("brand/logo/logo 3d.png");
export const TOBY_BG_RED_URL = cdn("brand/images/background/red.png");

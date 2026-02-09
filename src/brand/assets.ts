/**
 * TOBY Brand Assets — Public URL Registry (Source of Links)
 * Repo: tobywsharotslicha/toby-brand-assets (main)
 *
 * IMPORTANT:
 * - Use RAW urls for CSS background-image/url()
 * - This file is a registry only: pages/components choose what to use.
 * - "Iron rule": components never hardcode urls — they import from here.
 */

const RAW_BASE =
  "https://raw.githubusercontent.com/tobywsharotslicha/toby-brand-assets/main/";

const raw = (path: string) => `${RAW_BASE}${path}`;

/** Typed names for clarity */
export const BrandAssets = {
  repo: "https://github.com/tobywsharotslicha/toby-brand-assets",

  logos: {
    noBackground: raw("brand/logo/logonoreka.png"),
    // logo2d: raw("brand/logo/<FILE>.png"),
    // logo3d: raw("brand/logo/<FILE>.png"),
  },

  backgrounds: {
    // from /brand/images/background/
    ard: raw("brand/images/background/ard.png"),
    black: raw("brand/images/background/black.png"),
    gold: raw("brand/images/background/gold.png"),
    lightGold: raw("brand/images/background/lightgold.png"),
    red: raw("brand/images/background/red.png"),
    redBrown: raw("brand/images/background/redbrown.png"),
  },

  hero: {
    // from /brand/images/hero/
    pianoFlute: raw("brand/images/hero/pianoflute.png"),
    stageBlack: raw("brand/images/hero/stageblack.png"),
    stageBrown: raw("brand/images/hero/stagebrown.png"),
    stageDark: raw("brand/images/hero/stagedark.png"),
    stageGold: raw("brand/images/hero/stagegold.png"),
    stagePiano: raw("brand/images/hero/stagepiano.png"),
    stageVilon: raw("brand/images/hero/stagevilon.png"),
    stageVilon2: raw("brand/images/hero/stagevilon2.png"),
  },

  instruments: {
    // raw("brand/images/instruments/violin.png"),
  },

  characters: {
    // char1: raw("brand/characters/<FILE>.png"),
    // char2: raw("brand/characters/<FILE>.png"),
  },

  icons: {
    // raw("brand/icons/<FILE>.png"),
  },
} as const;

/**
 * Optional: export a "default selection" (slots) for the app to use globally.
 * Keep these minimal: just the assets that are "fixed defaults".
 */
export const BrandSlots = {
  logoHeader: BrandAssets.logos.noBackground,
  cardBgLight: BrandAssets.backgrounds.lightGold,
  cardBgDark: BrandAssets.backgrounds.redBrown,
  dashboardTop: BrandAssets.hero.stageVilon,
} as const;

/* ===== Aliases (the “iron rule” import API) ===== */
export const ASSETS = BrandAssets;
export const SLOTS = BrandSlots;

/* Optional convenience types */
export type BrandAssetsType = typeof BrandAssets;
export type BrandSlotsType = typeof BrandSlots;

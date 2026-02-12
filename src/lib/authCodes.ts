import SHA256 from "crypto-js/sha256";

/**
 * Auth verification using SHA-256 hashed comparisons.
 * Passwords are never stored in plaintext in source code.
 * 
 * To rotate credentials:
 * 1. Open browser console in dev mode
 * 2. Run: import("crypto-js/sha256").then(m => console.log(m.default("yourNewPassword").toString()))
 * 3. Replace the hash constant below
 * 4. Update the Cloudflare Worker manager code accordingly
 */

// Pre-computed SHA-256 hashes
const ADMIN_HASH = "daf366d028c871e9dc320bd77e3bd65136e42e241fc18f8c207417073dda6e93";
const DEV_HASH = "a98dbbbe594c536dbc48f1b6f0a818a7491bcefc36dce1485b91a67c529ab3b3";
const PUBLIC_VIEW_HASH = "2b8d8405272f5520078079d8db41304661f8dcf504cea64a9d8de607f84f0b48";

export const verifyAdminCode = (input: string): boolean =>
  SHA256(input).toString() === ADMIN_HASH;

export const verifyDevCode = (input: string): boolean =>
  SHA256(input).toString() === DEV_HASH;

export const verifyPublicCode = (input: string): boolean =>
  SHA256(input.toUpperCase()).toString() === PUBLIC_VIEW_HASH;

/**
 * Shared constants used across routes, jobs, and utilities.
 * Single source of truth — change once, applies everywhere.
 */

// ─── Shopify ──────────────────────────────────────────────────────────────────
/** Shopify Admin API version. Update quarterly per Shopify's release schedule. */
export const SHOPIFY_API_VERSION = "2024-04";

/** Valid myshopify.com domain pattern. */
export const SHOPIFY_DOMAIN_RE = /^[a-zA-Z0-9][a-zA-Z0-9-]*\.myshopify\.com$/;

// ─── Timezone ─────────────────────────────────────────────────────────────────
/**
 * Fallback IANA timezone when a store has none configured.
 * UTC is the neutral global default (avoids implicit server-OS timezone pollution).
 */
export const DEFAULT_TIMEZONE = "UTC";

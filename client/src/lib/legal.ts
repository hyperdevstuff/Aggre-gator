/**
 * Single source of truth for the legal pages.
 *
 * Every fact the legal pages assert lives here, because these documents go stale
 * the moment a price, an email address or a refund window changes somewhere else
 * in the app. If you edit `pricing-teaser.tsx`, check `proPrice` and
 * `freePublicCollections` below before you push.
 *
 * ⚠️ `operator` and `jurisdiction` are placeholders. Both are facts only the
 * person running the service can supply — do not invent them. Replace them
 * before submitting the payment-provider application, and keep the values
 * consistent with whatever name and address you register with Dodo.
 */
export const LEGAL = {
  productName: "Aggregator",
  siteUrl: "https://aggeregate.tech",
  supportEmail: "support@aggeregate.tech",
  /** Shown as "Last updated" on every page. ISO date, rendered by date-fns. */
  effectiveDate: "2026-10-29",

  /**
   * PLACEHOLDERS — replace both before going live.
   * `operator` is the name that appears as the contracting party. If you trade
   * as a sole proprietor, use your own name; if you have a company, the
   * registered name. `jurisdiction` is the country whose law governs.
   */
  operator: "Harsh Chauhan",
  jurisdiction: "India",

  /** Refund window, in days, from the initial charge. */
  refundDays: 14,
  /** Price shown on the pricing page, per month, USD. */
  proPrice: "$5",
  /** Public collections allowed on the free tier. */
  freePublicCollections: 5,
} as const;

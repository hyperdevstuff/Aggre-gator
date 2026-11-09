export const PLANS = {
  free: { publishedCollections: 5, analytics: false, passwords: false, expiry: false, multiCollectionPages: false, branding: false },
  pro:  { publishedCollections: Infinity, analytics: true, passwords: true, expiry: true, multiCollectionPages: true, branding: true },
} as const;
export type Plan = keyof typeof PLANS;
export function planOf(plan: string | null | undefined): Plan { return plan === "pro" ? "pro" : "free"; }
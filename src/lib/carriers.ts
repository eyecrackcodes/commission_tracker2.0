export interface CarrierProduct {
  name: string;
  products: string[];
}

export type CommissionTier = "standard" | "reduced";

export const COMMISSION_RATES = {
  standard: 0.30,
  reduced: 0.15,
} as const;

export const REDUCED_TIER_CAP = 200;
export const MONTHLY_THRESHOLD = 4333.33;

export const carriers: CarrierProduct[] = [
  {
    name: "AIG",
    products: ["Guaranteed Issue", "Term", "Whole Life", "Universal Life"],
  },
  {
    name: "GTL",
    products: ["Preferred", "Standard", "Graded", "Guaranteed Issue"],
  },
  {
    name: "Mutual of Omaha",
    products: ["Graded", "Standard", "Preferred", "Term", "Whole Life"],
  },
  {
    name: "Royal Neighbors of America",
    products: ["Graded", "Guaranteed Issue", "Standard", "Preferred", "Term"],
  },
  {
    name: "American Amicable",
    products: ["Immediate", "Graded", "ROP"],
  },
  {
    name: "SBLI",
    products: ["Preferred", "Standard", "Modified"],
  },
  {
    name: "Other",
    products: ["Other"],
  },
];

const REDUCED_RATE_RULES: Array<{
  carrier: string;
  productPatterns: RegExp[];
}> = [
  { carrier: "AIG", productPatterns: [/guaranteed\s*issue/i, /\bgi\b/i] },
  { carrier: "Mutual of Omaha", productPatterns: [/graded/i] },
];

export function getCommissionTier(
  carrier: string,
  product: string
): CommissionTier {
  const normalizedCarrier = carrier.trim().toLowerCase();
  const normalizedProduct = product.trim().toLowerCase();

  for (const rule of REDUCED_RATE_RULES) {
    if (normalizedCarrier.includes(rule.carrier.toLowerCase())) {
      if (rule.productPatterns.some((p) => p.test(normalizedProduct))) {
        return "reduced";
      }
    }
  }

  return "standard";
}

export function getCommissionRate(tier: CommissionTier): number {
  return COMMISSION_RATES[tier];
}

export function calculatePolicyCommission(
  annualPremium: number,
  carrier: string,
  product: string
): { tier: CommissionTier; rate: number; commission: number } {
  const tier = getCommissionTier(carrier, product);
  const rate = getCommissionRate(tier);
  let commission = annualPremium * rate;

  if (tier === "reduced") {
    commission = Math.min(commission, REDUCED_TIER_CAP);
  }

  return { tier, rate, commission };
}

export function getProductOptions(carrier: string): string[] {
  const carrierData = carriers.find(
    (c) => c.name.toLowerCase() === carrier.toLowerCase()
  );
  return carrierData?.products || ["Other"];
}

export function getCarrierOptions(): string[] {
  return carriers.map((c) => c.name);
}

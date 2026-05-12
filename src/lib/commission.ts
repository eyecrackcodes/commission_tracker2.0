import {
  type CommissionTier,
  COMMISSION_RATES,
  REDUCED_TIER_CAP,
  MONTHLY_THRESHOLD,
  getCommissionTier,
} from "./carriers";

export interface MonthlyCommissionSummary {
  month: string;
  totalEligiblePremium: number;
  thresholdMet: boolean;
  premiumAboveThreshold: number;
  standardCommission: number;
  reducedCommission: number;
  totalAdvancedCommissionWage: number;
  policyCount: number;
  chargebackAmount: number;
  netCommission: number;
}

export interface PolicyCommissionDetail {
  policyId: number;
  annualPremium: number;
  tier: CommissionTier;
  rate: number;
  rawCommission: number;
  cappedCommission: number;
}

export function getCommissionRateForPolicy(
  carrier: string,
  product: string
): { tier: CommissionTier; rate: number } {
  const tier = getCommissionTier(carrier, product);
  return { tier, rate: COMMISSION_RATES[tier] };
}

export function calculatePolicyCommissionAmount(
  annualPremium: number,
  tier: CommissionTier
): number {
  const rate = COMMISSION_RATES[tier];
  const raw = annualPremium * rate;
  if (tier === "reduced") {
    return Math.min(raw, REDUCED_TIER_CAP);
  }
  return raw;
}

export function calculateMonthlyCommission(
  policies: Array<{
    id: number;
    commissionable_annual_premium: number;
    carrier: string;
    product: string;
    commission_tier?: CommissionTier;
  }>,
  chargebackTotal: number = 0
): MonthlyCommissionSummary & { details: PolicyCommissionDetail[] } {
  const details: PolicyCommissionDetail[] = [];

  let totalEligiblePremium = 0;

  for (const policy of policies) {
    const tier = (policy.commission_tier as CommissionTier) ||
      getCommissionTier(policy.carrier, policy.product);
    const rate = COMMISSION_RATES[tier];
    const raw = policy.commissionable_annual_premium * rate;
    const capped = tier === "reduced" ? Math.min(raw, REDUCED_TIER_CAP) : raw;

    totalEligiblePremium += policy.commissionable_annual_premium;

    details.push({
      policyId: policy.id,
      annualPremium: policy.commissionable_annual_premium,
      tier,
      rate,
      rawCommission: raw,
      cappedCommission: capped,
    });
  }

  const thresholdMet = totalEligiblePremium > MONTHLY_THRESHOLD;
  const premiumAboveThreshold = thresholdMet
    ? totalEligiblePremium - MONTHLY_THRESHOLD
    : 0;

  let standardCommission = 0;
  let reducedCommission = 0;

  if (thresholdMet) {
    for (const detail of details) {
      if (detail.tier === "standard") {
        standardCommission += detail.cappedCommission;
      } else {
        reducedCommission += detail.cappedCommission;
      }
    }
  }

  const totalAdvancedCommissionWage = standardCommission + reducedCommission;
  const netCommission = Math.max(
    0,
    totalAdvancedCommissionWage - chargebackTotal
  );

  return {
    month: "",
    totalEligiblePremium,
    thresholdMet,
    premiumAboveThreshold,
    standardCommission,
    reducedCommission,
    totalAdvancedCommissionWage,
    policyCount: policies.length,
    chargebackAmount: chargebackTotal,
    netCommission,
    details,
  };
}

export function getThresholdProgress(totalPremium: number): {
  current: number;
  threshold: number;
  percentage: number;
  remaining: number;
  met: boolean;
} {
  const percentage = Math.min((totalPremium / MONTHLY_THRESHOLD) * 100, 100);
  return {
    current: totalPremium,
    threshold: MONTHLY_THRESHOLD,
    percentage,
    remaining: Math.max(0, MONTHLY_THRESHOLD - totalPremium),
    met: totalPremium > MONTHLY_THRESHOLD,
  };
}

export function getAdvancedWagePaymentDate(activityMonth: Date): Date {
  const paymentMonth = new Date(activityMonth);
  paymentMonth.setMonth(paymentMonth.getMonth() + 1);
  paymentMonth.setDate(20);
  return paymentMonth;
}

export function getHourlyWagePaymentDates(month: Date): {
  firstHalf: Date;
  secondHalf: Date;
} {
  const year = month.getFullYear();
  const mo = month.getMonth();

  return {
    firstHalf: new Date(year, mo, 20),
    secondHalf: new Date(year, mo + 1, 5),
  };
}

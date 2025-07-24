import { differenceInDays, parseISO } from 'date-fns';
import { Policy } from './supabase';

export interface ChargebackInfo {
  isChargeback: boolean;
  daysToCancel: number;
  chargebackAmount: number;
}

/**
 * Determines if a policy is considered a chargeback (cancelled within 30 days)
 */
export function detectChargeback(policy: Policy): ChargebackInfo {
  if (policy.policy_status !== 'Cancelled' || !policy.cancelled_date || !policy.created_at) {
    return {
      isChargeback: false,
      daysToCancel: 0,
      chargebackAmount: 0
    };
  }

  const policyDate = parseISO(policy.created_at);
  const cancelledDate = parseISO(policy.cancelled_date);
  const daysToCancel = differenceInDays(cancelledDate, policyDate);
  
  const isChargeback = daysToCancel <= 30;
  
  return {
    isChargeback,
    daysToCancel,
    chargebackAmount: isChargeback ? policy.commission_due : 0
  };
}

/**
 * Calculate total chargebacks for a given set of policies
 */
export function calculateChargebacks(policies: Policy[]): {
  totalChargebacks: number;
  chargebackAmount: number;
  chargebackPolicies: Policy[];
} {
  const chargebackPolicies = policies.filter(policy => {
    const { isChargeback } = detectChargeback(policy);
    return isChargeback;
  });

  const chargebackAmount = chargebackPolicies.reduce((sum, policy) => sum + policy.commission_due, 0);

  return {
    totalChargebacks: chargebackPolicies.length,
    chargebackAmount,
    chargebackPolicies
  };
}

/**
 * Get chargeback alert level based on frequency
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function getChargebackAlertLevel(policies: Policy[], _timeframeMonths: number = 3): {
  level: 'low' | 'medium' | 'high';
  message: string;
  chargebackRate: number;
} {
  const totalPolicies = policies.length;
  const { totalChargebacks } = calculateChargebacks(policies);
  
  if (totalPolicies === 0) {
    return {
      level: 'low',
      message: 'No policies to analyze',
      chargebackRate: 0
    };
  }

  const chargebackRate = (totalChargebacks / totalPolicies) * 100;

  if (chargebackRate >= 15) {
    return {
      level: 'high',
      message: `High chargeback rate (${chargebackRate.toFixed(1)}%). Consider improving client screening process.`,
      chargebackRate
    };
  } else if (chargebackRate >= 8) {
    return {
      level: 'medium',
      message: `Moderate chargeback rate (${chargebackRate.toFixed(1)}%). Monitor client follow-up process.`,
      chargebackRate
    };
  } else {
    return {
      level: 'low',
      message: `Low chargeback rate (${chargebackRate.toFixed(1)}%). Good client retention.`,
      chargebackRate
    };
  }
} 
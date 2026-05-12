import { differenceInDays, differenceInMonths, parseISO } from "date-fns";
import { Policy } from "./supabase";

export interface ChargebackInfo {
  isChargeback: boolean;
  daysToCancel: number;
  monthsToCancel: number;
  chargebackAmount: number;
  persistenceStatus: "pending" | "met" | "failed";
}

const PERSISTENCE_MONTHS = 3;

export function detectChargeback(policy: Policy): ChargebackInfo {
  const placementDate = policy.inforce_date || policy.created_at;

  if (
    policy.policy_status !== "Cancelled" ||
    !policy.cancelled_date ||
    !placementDate
  ) {
    const monthsSincePlacement = placementDate
      ? differenceInMonths(new Date(), parseISO(placementDate))
      : 0;

    return {
      isChargeback: false,
      daysToCancel: 0,
      monthsToCancel: 0,
      chargebackAmount: 0,
      persistenceStatus:
        monthsSincePlacement >= PERSISTENCE_MONTHS ? "met" : "pending",
    };
  }

  const policyDate = parseISO(placementDate);
  const cancelledDate = parseISO(policy.cancelled_date);
  const daysToCancel = differenceInDays(cancelledDate, policyDate);
  const monthsToCancel = differenceInMonths(cancelledDate, policyDate);

  const isChargeback = monthsToCancel < PERSISTENCE_MONTHS;

  return {
    isChargeback,
    daysToCancel,
    monthsToCancel,
    chargebackAmount: isChargeback ? policy.commission_due : 0,
    persistenceStatus: isChargeback ? "failed" : "met",
  };
}

export function calculateChargebacks(policies: Policy[]): {
  totalChargebacks: number;
  chargebackAmount: number;
  chargebackPolicies: Policy[];
  pendingPersistencePolicies: Policy[];
} {
  const chargebackPolicies = policies.filter((policy) => {
    const { isChargeback } = detectChargeback(policy);
    return isChargeback;
  });

  const pendingPersistencePolicies = policies.filter((policy) => {
    const { persistenceStatus } = detectChargeback(policy);
    return persistenceStatus === "pending";
  });

  const chargebackAmount = chargebackPolicies.reduce(
    (sum, policy) => sum + policy.commission_due,
    0
  );

  return {
    totalChargebacks: chargebackPolicies.length,
    chargebackAmount,
    chargebackPolicies,
    pendingPersistencePolicies,
  };
}

export function getChargebackAlertLevel(
  policies: Policy[],
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _timeframeMonths: number = 3
): {
  level: "low" | "medium" | "high";
  message: string;
  chargebackRate: number;
} {
  const totalPolicies = policies.length;
  const { totalChargebacks } = calculateChargebacks(policies);

  if (totalPolicies === 0) {
    return {
      level: "low",
      message: "No policies to analyze",
      chargebackRate: 0,
    };
  }

  const chargebackRate = (totalChargebacks / totalPolicies) * 100;

  if (chargebackRate >= 15) {
    return {
      level: "high",
      message: `High chargeback rate (${chargebackRate.toFixed(1)}%). Review client screening and policy persistence.`,
      chargebackRate,
    };
  } else if (chargebackRate >= 8) {
    return {
      level: "medium",
      message: `Moderate chargeback rate (${chargebackRate.toFixed(1)}%). Monitor 3-month persistence windows.`,
      chargebackRate,
    };
  } else {
    return {
      level: "low",
      message: `Low chargeback rate (${chargebackRate.toFixed(1)}%). Good policy retention.`,
      chargebackRate,
    };
  }
}

export function getPersistenceProgress(policy: Policy): {
  monthsElapsed: number;
  monthsRequired: number;
  percentComplete: number;
  status: "pending" | "met" | "failed";
  daysRemaining: number;
} {
  const placementDate = policy.inforce_date || policy.created_at;
  if (!placementDate) {
    return {
      monthsElapsed: 0,
      monthsRequired: PERSISTENCE_MONTHS,
      percentComplete: 0,
      status: "pending",
      daysRemaining: PERSISTENCE_MONTHS * 30,
    };
  }

  if (policy.policy_status === "Cancelled" && policy.cancelled_date) {
    const monthsToCancel = differenceInMonths(
      parseISO(policy.cancelled_date),
      parseISO(placementDate)
    );
    return {
      monthsElapsed: monthsToCancel,
      monthsRequired: PERSISTENCE_MONTHS,
      percentComplete: Math.min(
        (monthsToCancel / PERSISTENCE_MONTHS) * 100,
        100
      ),
      status: monthsToCancel >= PERSISTENCE_MONTHS ? "met" : "failed",
      daysRemaining: 0,
    };
  }

  const monthsElapsed = differenceInMonths(
    new Date(),
    parseISO(placementDate)
  );
  const daysElapsed = differenceInDays(new Date(), parseISO(placementDate));
  const totalDaysRequired = PERSISTENCE_MONTHS * 30;
  const daysRemaining = Math.max(0, totalDaysRequired - daysElapsed);

  return {
    monthsElapsed,
    monthsRequired: PERSISTENCE_MONTHS,
    percentComplete: Math.min(
      (monthsElapsed / PERSISTENCE_MONTHS) * 100,
      100
    ),
    status: monthsElapsed >= PERSISTENCE_MONTHS ? "met" : "pending",
    daysRemaining,
  };
}

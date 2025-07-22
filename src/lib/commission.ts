import { differenceInMonths } from "date-fns";

export function calculateCommissionRate(startDate: string | null): number {
  if (!startDate) {
    // Default to 5% if no start date is provided
    return 0.05;
  }

  const monthsSinceStart = differenceInMonths(new Date(), new Date(startDate));

  // After 6 months, increase to 20%
  if (monthsSinceStart >= 6) {
    return 0.2;
  }

  // First 6 months at 5%
  return 0.05;
}

export function shouldUpdateCommissionRate(startDate: string | null): boolean {
  if (!startDate) {
    return false;
  }

  const monthsSinceStart = differenceInMonths(new Date(), new Date(startDate));

  // Check if the agent has just completed 6 months
  return monthsSinceStart === 6;
}

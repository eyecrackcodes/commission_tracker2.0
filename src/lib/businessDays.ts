import { addDays, isWeekend, startOfDay } from "date-fns";

/**
 * Add business days to a date (excluding weekends)
 * @param date Starting date
 * @param businessDaysToAdd Number of business days to add
 * @returns New date with business days added
 */
export function addBusinessDays(date: Date, businessDaysToAdd: number): Date {
  let result = new Date(date);
  let daysAdded = 0;
  
  while (daysAdded < businessDaysToAdd) {
    result = addDays(result, 1);
    if (!isWeekend(result)) {
      daysAdded++;
    }
  }
  
  return result;
}

/**
 * Calculate the number of business days between two dates
 * @param startDate Start date
 * @param endDate End date
 * @returns Number of business days between the dates
 */
export function getBusinessDaysBetween(startDate: Date, endDate: Date): number {
  let count = 0;
  let current = startOfDay(new Date(startDate));
  const end = startOfDay(new Date(endDate));
  
  while (current < end) {
    current = addDays(current, 1);
    if (!isWeekend(current)) {
      count++;
    }
  }
  
  return count;
}

/**
 * Get the date when bank confirmation should be available
 * (2 business days after the first payment date)
 * @param firstPaymentDate The first payment date
 * @returns Date when bank confirmation should be available
 */
export function getBankConfirmationDate(firstPaymentDate: Date): Date {
  return addBusinessDays(firstPaymentDate, 2);
}

/**
 * Check if bank confirmation period has passed
 * @param firstPaymentDate The first payment date
 * @param currentDate Current date (defaults to today)
 * @returns True if 2+ business days have passed since first payment date
 */
export function isBankConfirmationDue(firstPaymentDate: Date, currentDate: Date = new Date()): boolean {
  const confirmationDate = getBankConfirmationDate(firstPaymentDate);
  return startOfDay(currentDate) >= startOfDay(confirmationDate);
}

/**
 * Get the number of business days since the confirmation became due
 * @param firstPaymentDate The first payment date
 * @param currentDate Current date (defaults to today)
 * @returns Number of business days overdue (0 if not yet due)
 */
export function getBusinessDaysOverdue(firstPaymentDate: Date, currentDate: Date = new Date()): number {
  const confirmationDate = getBankConfirmationDate(firstPaymentDate);
  
  if (!isBankConfirmationDue(firstPaymentDate, currentDate)) {
    return 0;
  }
  
  return getBusinessDaysBetween(confirmationDate, currentDate);
}

/**
 * Get user-friendly text for when bank confirmation is due
 * @param firstPaymentDate The first payment date
 * @param currentDate Current date (defaults to today)
 * @returns Descriptive text about confirmation timing
 */
export function getBankConfirmationText(firstPaymentDate: Date, currentDate: Date = new Date()): string {
  const confirmationDate = getBankConfirmationDate(firstPaymentDate);
  const today = startOfDay(currentDate);
  const confirmationDay = startOfDay(confirmationDate);
  
  if (today < confirmationDay) {
    const businessDaysUntil = getBusinessDaysBetween(today, confirmationDay);
    if (businessDaysUntil === 1) {
      return "Bank confirmation due tomorrow";
    } else {
      return `Bank confirmation due in ${businessDaysUntil} business days`;
    }
  } else if (today.getTime() === confirmationDay.getTime()) {
    return "Bank confirmation due today";
  } else {
    const businessDaysOverdue = getBusinessDaysOverdue(firstPaymentDate, currentDate);
    if (businessDaysOverdue === 1) {
      return "Bank confirmation overdue by 1 business day";
    } else {
      return `Bank confirmation overdue by ${businessDaysOverdue} business days`;
    }
  }
} 
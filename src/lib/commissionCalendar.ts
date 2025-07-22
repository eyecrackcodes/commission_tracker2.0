import { format, isAfter, isBefore, isEqual, parseISO, startOfDay, endOfDay } from "date-fns";

export interface CommissionPaymentDate {
  date: string;
  dayOfWeek: string;
  paymentType: string;
  periodEnd: string;
}

export interface CommissionCalendar {
  [month: string]: CommissionPaymentDate[];
}

// DigitalBGA Commission Calendar for 2025
const commissionCalendar2025: CommissionCalendar = {
  january: [
    { date: "2025-01-10", dayOfWeek: "Friday", paymentType: "Commissions Pay Date", periodEnd: "2025-01-03" },
    { date: "2025-01-24", dayOfWeek: "Friday", paymentType: "Commissions Pay Date", periodEnd: "2025-01-17" },
    { date: "2025-01-31", dayOfWeek: "Friday", paymentType: "Commissions Pay Date", periodEnd: "2025-01-31" }
  ],
  february: [
    { date: "2025-02-14", dayOfWeek: "Friday", paymentType: "Commissions Pay Date", periodEnd: "2025-02-07" },
    { date: "2025-02-28", dayOfWeek: "Friday", paymentType: "Commissions Pay Date", periodEnd: "2025-02-21" }
  ],
  march: [
    { date: "2025-03-14", dayOfWeek: "Friday", paymentType: "Commissions Pay Date", periodEnd: "2025-03-07" },
    { date: "2025-03-28", dayOfWeek: "Friday", paymentType: "Commissions Pay Date", periodEnd: "2025-03-21" }
  ],
  april: [
    { date: "2025-04-11", dayOfWeek: "Friday", paymentType: "Commissions Pay Date", periodEnd: "2025-04-04" },
    { date: "2025-04-25", dayOfWeek: "Friday", paymentType: "Commissions Pay Date", periodEnd: "2025-04-18" }
  ],
  may: [
    { date: "2025-05-09", dayOfWeek: "Friday", paymentType: "Commissions Pay Date", periodEnd: "2025-05-02" },
    { date: "2025-05-23", dayOfWeek: "Friday", paymentType: "Commissions Pay Date", periodEnd: "2025-05-16" },
    { date: "2025-05-30", dayOfWeek: "Friday", paymentType: "Commissions Pay Date", periodEnd: "2025-05-30" }
  ],
  june: [
    { date: "2025-06-13", dayOfWeek: "Friday", paymentType: "Commissions Pay Date", periodEnd: "2025-06-06" },
    { date: "2025-06-27", dayOfWeek: "Friday", paymentType: "Commissions Pay Date", periodEnd: "2025-06-20" }
  ],
  july: [
    { date: "2025-07-11", dayOfWeek: "Friday", paymentType: "Commissions Pay Date", periodEnd: "2025-07-04" },
    { date: "2025-07-25", dayOfWeek: "Friday", paymentType: "Commissions Pay Date", periodEnd: "2025-07-18" }
  ],
  august: [
    { date: "2025-08-08", dayOfWeek: "Friday", paymentType: "Commissions Pay Date", periodEnd: "2025-08-01" },
    { date: "2025-08-22", dayOfWeek: "Friday", paymentType: "Commissions Pay Date", periodEnd: "2025-08-15" },
    { date: "2025-08-29", dayOfWeek: "Friday", paymentType: "Commissions Pay Date", periodEnd: "2025-08-29" }
  ],
  september: [
    { date: "2025-09-12", dayOfWeek: "Friday", paymentType: "Commissions Pay Date", periodEnd: "2025-09-05" },
    { date: "2025-09-26", dayOfWeek: "Friday", paymentType: "Commissions Pay Date", periodEnd: "2025-09-19" }
  ],
  october: [
    { date: "2025-10-10", dayOfWeek: "Friday", paymentType: "Commissions Pay Date", periodEnd: "2025-10-03" },
    { date: "2025-10-24", dayOfWeek: "Friday", paymentType: "Commissions Pay Date", periodEnd: "2025-10-17" },
    { date: "2025-10-31", dayOfWeek: "Friday", paymentType: "Commissions Pay Date", periodEnd: "2025-10-31" }
  ],
  november: [
    { date: "2025-11-14", dayOfWeek: "Friday", paymentType: "Commissions Pay Date", periodEnd: "2025-11-07" },
    { date: "2025-11-28", dayOfWeek: "Friday", paymentType: "Commissions Pay Date", periodEnd: "2025-11-21" }
  ],
  december: [
    { date: "2025-12-12", dayOfWeek: "Friday", paymentType: "Commissions Pay Date", periodEnd: "2025-12-05" },
    { date: "2025-12-26", dayOfWeek: "Friday", paymentType: "Commissions Pay Date", periodEnd: "2025-12-19" }
  ]
};

// Get all payment dates as a flat array
export function getAllPaymentDates(year: number = 2025): CommissionPaymentDate[] {
  const calendar = year === 2025 ? commissionCalendar2025 : commissionCalendar2025; // Add more years as needed
  const allDates: CommissionPaymentDate[] = [];
  
  Object.values(calendar).forEach(monthDates => {
    allDates.push(...monthDates);
  });
  
  return allDates.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
}

// Get the next payment date from today
export function getNextPaymentDate(fromDate: Date = new Date()): CommissionPaymentDate | null {
  const allDates = getAllPaymentDates();
  const today = startOfDay(fromDate);
  
  for (const paymentDate of allDates) {
    const payDate = startOfDay(parseISO(paymentDate.date));
    if (isAfter(payDate, today) || isEqual(payDate, today)) {
      return paymentDate;
    }
  }
  
  return null;
}

// Get the previous payment date from today
export function getPreviousPaymentDate(fromDate: Date = new Date()): CommissionPaymentDate | null {
  const allDates = getAllPaymentDates();
  const today = startOfDay(fromDate);
  
  for (let i = allDates.length - 1; i >= 0; i--) {
    const payDate = startOfDay(parseISO(allDates[i].date));
    if (isBefore(payDate, today)) {
      return allDates[i];
    }
  }
  
  return null;
}

// Get payment dates for a specific month
export function getPaymentDatesForMonth(month: number, year: number = 2025): CommissionPaymentDate[] {
  const monthNames = [
    'january', 'february', 'march', 'april', 'may', 'june',
    'july', 'august', 'september', 'october', 'november', 'december'
  ];
  
  const monthName = monthNames[month - 1];
  const calendar = year === 2025 ? commissionCalendar2025 : commissionCalendar2025;
  
  return calendar[monthName] || [];
}

// Determine which payment period a policy falls into
export function getPaymentPeriodForPolicy(policyDate: Date | string): {
  paymentDate: CommissionPaymentDate | null;
  isInCurrentPeriod: boolean;
  daysUntilPayment: number;
} {
  const date = typeof policyDate === 'string' ? parseISO(policyDate) : policyDate;
  const allDates = getAllPaymentDates();
  const today = new Date();
  
  // Find which period this policy falls into
  for (let i = 0; i < allDates.length; i++) {
    const periodEnd = endOfDay(parseISO(allDates[i].periodEnd));
    
    // Check if policy date is before or on the period end date
    if (isBefore(date, periodEnd) || isEqual(startOfDay(date), startOfDay(periodEnd))) {
      const paymentDate = parseISO(allDates[i].date);
      const daysUntilPayment = Math.ceil((paymentDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
      
      return {
        paymentDate: allDates[i],
        isInCurrentPeriod: daysUntilPayment >= 0,
        daysUntilPayment: Math.max(0, daysUntilPayment)
      };
    }
  }
  
  // If no period found, return the next payment date
  const nextPayment = getNextPaymentDate(date);
  if (nextPayment) {
    const paymentDate = parseISO(nextPayment.date);
    const daysUntilPayment = Math.ceil((paymentDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    
    return {
      paymentDate: nextPayment,
      isInCurrentPeriod: false,
      daysUntilPayment: Math.max(0, daysUntilPayment)
    };
  }
  
  return {
    paymentDate: null,
    isInCurrentPeriod: false,
    daysUntilPayment: 0
  };
}

// Get upcoming payment periods (next 3 payment dates)
export function getUpcomingPaymentPeriods(count: number = 3): CommissionPaymentDate[] {
  const allDates = getAllPaymentDates();
  const today = startOfDay(new Date());
  const upcoming: CommissionPaymentDate[] = [];
  
  for (const paymentDate of allDates) {
    const payDate = startOfDay(parseISO(paymentDate.date));
    if (isAfter(payDate, today) || isEqual(payDate, today)) {
      upcoming.push(paymentDate);
      if (upcoming.length >= count) break;
    }
  }
  
  return upcoming;
}

// Calculate expected commission for a payment period
export function calculateExpectedCommissionForPeriod(
  policies: Array<{ created_at: string; commission_due: number; date_commission_paid: string | null }>,
  periodEndDate: string
): {
  expectedAmount: number;
  policyCount: number;
  policies: Array<{ created_at: string; commission_due: number; date_commission_paid: string | null }>;
} {
  const periodEnd = endOfDay(parseISO(periodEndDate));
  
  // Find the previous period end to determine the start of this period
  const allDates = getAllPaymentDates();
  let periodStart = startOfDay(new Date(2025, 0, 1)); // Default to start of year
  
  for (let i = 0; i < allDates.length; i++) {
    if (allDates[i].periodEnd === periodEndDate && i > 0) {
      periodStart = endOfDay(parseISO(allDates[i - 1].periodEnd));
      break;
    }
  }
  
  // Filter policies that fall within this period and haven't been paid yet
  const periodPolicies = policies.filter(policy => {
    const policyDate = parseISO(policy.created_at);
    const isInPeriod = isAfter(policyDate, periodStart) && (isBefore(policyDate, periodEnd) || isEqual(startOfDay(policyDate), startOfDay(periodEnd)));
    const isUnpaid = !policy.date_commission_paid;
    
    return isInPeriod && isUnpaid;
  });
  
  const expectedAmount = periodPolicies.reduce((sum, policy) => sum + policy.commission_due, 0);
  
  return {
    expectedAmount,
    policyCount: periodPolicies.length,
    policies: periodPolicies
  };
} 
import {
  isAfter,
  isBefore,
  isEqual,
  parseISO,
  startOfDay,
  endOfDay,
  lastDayOfMonth,
  addMonths,
} from "date-fns";

export interface CommissionPaymentDate {
  date: string;
  dayOfWeek: string;
  paymentType: "hourly_first_half" | "hourly_second_half" | "advanced_commission";
  periodStart: string;
  periodEnd: string;
}

export interface CommissionCalendar {
  [month: string]: CommissionPaymentDate[];
}

function generateMonthlySchedule(
  year: number,
  month: number
): CommissionPaymentDate[] {
  const dates: CommissionPaymentDate[] = [];
  const monthStr = String(month).padStart(2, "0");
  const lastDay = lastDayOfMonth(new Date(year, month - 1)).getDate();

  const hourlyFirstHalf = new Date(year, month - 1, 20);
  dates.push({
    date: `${year}-${monthStr}-20`,
    dayOfWeek: hourlyFirstHalf.toLocaleDateString("en-US", { weekday: "long" }),
    paymentType: "hourly_first_half",
    periodStart: `${year}-${monthStr}-01`,
    periodEnd: `${year}-${monthStr}-15`,
  });

  const nextMonth = addMonths(new Date(year, month - 1, 1), 1);
  const nextYear = nextMonth.getFullYear();
  const nextMonthStr = String(nextMonth.getMonth() + 1).padStart(2, "0");
  const hourlySecondHalf = new Date(nextYear, nextMonth.getMonth(), 5);
  dates.push({
    date: `${nextYear}-${nextMonthStr}-05`,
    dayOfWeek: hourlySecondHalf.toLocaleDateString("en-US", {
      weekday: "long",
    }),
    paymentType: "hourly_second_half",
    periodStart: `${year}-${monthStr}-16`,
    periodEnd: `${year}-${monthStr}-${lastDay}`,
  });

  const prevMonth = new Date(year, month - 2, 1);
  const prevYear = prevMonth.getFullYear();
  const prevMonthStr = String(prevMonth.getMonth() + 1).padStart(2, "0");
  const prevLastDay = lastDayOfMonth(prevMonth).getDate();
  const commissionPayDate = new Date(year, month - 1, 20);
  dates.push({
    date: `${year}-${monthStr}-20`,
    dayOfWeek: commissionPayDate.toLocaleDateString("en-US", {
      weekday: "long",
    }),
    paymentType: "advanced_commission",
    periodStart: `${prevYear}-${prevMonthStr}-01`,
    periodEnd: `${prevYear}-${prevMonthStr}-${prevLastDay}`,
  });

  return dates;
}

export function getAllPaymentDates(year: number = 2026): CommissionPaymentDate[] {
  const allDates: CommissionPaymentDate[] = [];

  for (let month = 1; month <= 12; month++) {
    allDates.push(...generateMonthlySchedule(year, month));
  }

  return allDates.sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
  );
}

export function getCommissionPaymentDates(
  year: number = 2026
): CommissionPaymentDate[] {
  return getAllPaymentDates(year).filter(
    (d) => d.paymentType === "advanced_commission"
  );
}

export function getHourlyPaymentDates(
  year: number = 2026
): CommissionPaymentDate[] {
  return getAllPaymentDates(year).filter(
    (d) =>
      d.paymentType === "hourly_first_half" ||
      d.paymentType === "hourly_second_half"
  );
}

export function getNextPaymentDate(
  fromDate: Date = new Date()
): CommissionPaymentDate | null {
  const allDates = getCommissionPaymentDates(fromDate.getFullYear());
  const today = startOfDay(fromDate);

  for (const paymentDate of allDates) {
    const payDate = startOfDay(parseISO(paymentDate.date));
    if (isAfter(payDate, today) || isEqual(payDate, today)) {
      return paymentDate;
    }
  }

  const nextYearDates = getCommissionPaymentDates(fromDate.getFullYear() + 1);
  return nextYearDates[0] || null;
}

export function getPreviousPaymentDate(
  fromDate: Date = new Date()
): CommissionPaymentDate | null {
  const allDates = getCommissionPaymentDates(fromDate.getFullYear());
  const today = startOfDay(fromDate);

  for (let i = allDates.length - 1; i >= 0; i--) {
    const payDate = startOfDay(parseISO(allDates[i].date));
    if (isBefore(payDate, today)) {
      return allDates[i];
    }
  }

  return null;
}

export function getPaymentDatesForMonth(
  month: number,
  year: number = 2026
): CommissionPaymentDate[] {
  return getAllPaymentDates(year).filter((d) => {
    const payDate = parseISO(d.date);
    return payDate.getMonth() + 1 === month;
  });
}

export function getPaymentPeriodForPolicy(
  inforceDate: Date | string | null,
  fallbackDate?: Date | string
): {
  paymentDate: CommissionPaymentDate | null;
  isInCurrentPeriod: boolean;
  daysUntilPayment: number;
} {
  const effectiveDate = inforceDate || fallbackDate;
  if (!effectiveDate) {
    return {
      paymentDate: null,
      isInCurrentPeriod: false,
      daysUntilPayment: 0,
    };
  }

  const date =
    typeof effectiveDate === "string" ? parseISO(effectiveDate) : effectiveDate;
  const today = new Date();

  const nextPayment = getNextPaymentDate(date);
  if (nextPayment) {
    const paymentDate = parseISO(nextPayment.date);
    const daysUntilPayment = Math.ceil(
      (paymentDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
    );

    return {
      paymentDate: nextPayment,
      isInCurrentPeriod: daysUntilPayment >= 0,
      daysUntilPayment: Math.max(0, daysUntilPayment),
    };
  }

  return {
    paymentDate: null,
    isInCurrentPeriod: false,
    daysUntilPayment: 0,
  };
}

export function getUpcomingPaymentPeriods(
  count: number = 3
): CommissionPaymentDate[] {
  const allDates = getCommissionPaymentDates();
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

export function calculateExpectedCommissionForPeriod(
  policies: Array<{
    created_at: string;
    inforce_date: string | null;
    commission_due: number;
    date_policy_verified: string | null;
  }>,
  periodEndDate: string
): {
  expectedAmount: number;
  totalAmount: number;
  verifiedAmount: number;
  policyCount: number;
  verifiedCount: number;
  unverifiedCount: number;
  policies: Array<{
    created_at: string;
    inforce_date: string | null;
    commission_due: number;
    date_policy_verified: string | null;
  }>;
} {
  const periodEnd = endOfDay(parseISO(periodEndDate));
  const periodStart = startOfDay(
    new Date(parseISO(periodEndDate).getFullYear(), parseISO(periodEndDate).getMonth(), 1)
  );

  const periodPolicies = policies.filter((policy) => {
    const commissionDate = policy.inforce_date
      ? parseISO(policy.inforce_date)
      : parseISO(policy.created_at);
    return (
      (isAfter(commissionDate, periodStart) ||
        isEqual(startOfDay(commissionDate), periodStart)) &&
      (isBefore(commissionDate, periodEnd) ||
        isEqual(startOfDay(commissionDate), startOfDay(periodEnd)))
    );
  });

  const unverifiedPolicies = periodPolicies.filter(
    (policy) => !policy.date_policy_verified
  );
  const verifiedPolicies = periodPolicies.filter(
    (policy) => policy.date_policy_verified
  );

  const expectedAmount = unverifiedPolicies.reduce(
    (sum, policy) => sum + policy.commission_due,
    0
  );
  const verifiedAmount = verifiedPolicies.reduce(
    (sum, policy) => sum + policy.commission_due,
    0
  );
  const totalAmount = expectedAmount + verifiedAmount;

  return {
    expectedAmount,
    totalAmount,
    verifiedAmount,
    policyCount: periodPolicies.length,
    verifiedCount: verifiedPolicies.length,
    unverifiedCount: unverifiedPolicies.length,
    policies: periodPolicies,
  };
}

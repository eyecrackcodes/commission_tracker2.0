"use client";

import { useState, useEffect, useCallback } from "react";
import { useUser } from "@clerk/nextjs";
import { supabase, Policy } from "@/lib/supabase";
import { getNextPaymentDate, calculateExpectedCommissionForPeriod } from "@/lib/commissionCalendar";
import {
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Area,
  AreaChart,
} from "recharts";
import { format, startOfMonth, subMonths, parseISO } from "date-fns";
import { calculateChargebacks, getChargebackAlertLevel } from "@/lib/chargeback";
import { generateReconciliationSummary, formatAlertMessage } from "@/lib/reconciliation";
import { normalizeProductName } from "@/lib/productNormalization";

interface InsightsData {
  monthlyCommissions: Array<{
    month: string;
    actual: number;
    projected: number;
  }>;
  productMix: Array<{
    name: string;
    value: number;
    count: number;
  }>;
  carrierBreakdown: Array<{
    carrier: string;
    premium: number;
    commission: number;
    policies: number;
  }>;
  statusDistribution: Array<{
    status: string;
    count: number;
    value: number;
  }>;
     commissionPayments: {
     verified: number;
     unverified: number;
     verifiedCount: number;
     unverifiedCount: number;
    avgDaysToPayment: number;
    monthlyPayments: Array<{
      month: string;
      amount: number;
      count: number;
    }>;
  };
}

const COLORS = [
  "#3B82F6",
  "#10B981",
  "#F59E0B",
  "#EF4444",
  "#8B5CF6",
  "#EC4899",
];

export default function InsightsDashboard() {
  const [policies, setPolicies] = useState<Policy[]>([]);
  const [filteredPolicies, setFilteredPolicies] = useState<Policy[]>([]);
  const [insights, setInsights] = useState<InsightsData>({
    monthlyCommissions: [],
    productMix: [],
    carrierBreakdown: [],
    statusDistribution: [],
         commissionPayments: {
       verified: 0,
       unverified: 0,
       verifiedCount: 0,
       unverifiedCount: 0,
      avgDaysToPayment: 0,
      monthlyPayments: [],
    },
  });
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState(6); // months for forecast
  const [dateFilter, setDateFilter] = useState("all"); // Date filter
  const [customStartDate, setCustomStartDate] = useState("");
  const [customEndDate, setCustomEndDate] = useState("");
  const { user } = useUser();

  const fetchPolicies = useCallback(async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from("policies")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (error) throw error;

      setPolicies(data || []);
    } catch (err) {
      console.error("Error fetching policies:", err);
    } finally {
      setLoading(false);
    }
  }, [user]);

  // Apply date filtering whenever policies or filter criteria change
  useEffect(() => {
    let filtered = [...policies];
    const now = new Date();
    let startDate: Date | null = null;
    let endDate: Date | null = null;

    if (process.env.NODE_ENV === 'development') {
      console.log('InsightsDashboard: Applying filter', { 
        dateFilter, 
        customStartDate, 
        customEndDate, 
        totalPolicies: policies.length 
      });
    }

    switch (dateFilter) {
      case "month":
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        startDate.setHours(0, 0, 0, 0);
        endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
        break;
      case "quarter":
        const currentQuarter = Math.floor(now.getMonth() / 3);
        const quarterStartMonth = currentQuarter * 3;
        startDate = new Date(now.getFullYear(), quarterStartMonth, 1);
        startDate.setHours(0, 0, 0, 0);
        endDate = new Date(now.getFullYear(), quarterStartMonth + 3, 0, 23, 59, 59, 999);
        break;
      case "year":
        startDate = new Date(now.getFullYear(), 0, 1);
        startDate.setHours(0, 0, 0, 0);
        endDate = new Date(now.getFullYear(), 11, 31, 23, 59, 59, 999);
        break;
      case "ytd":
        startDate = new Date(now.getFullYear(), 0, 1);
        startDate.setHours(0, 0, 0, 0);
        endDate = new Date(now);
        endDate.setHours(23, 59, 59, 999);
        break;
      case "custom":
        if (customStartDate && customEndDate) {
          startDate = new Date(customStartDate);
          endDate = new Date(customEndDate);
          endDate.setHours(23, 59, 59, 999);
        }
        break;
      default:
        // "all" - no filtering
        break;
    }

    if (startDate && endDate) {
      filtered = policies.filter((policy) => {
        const policyDate = new Date(policy.created_at);
        return policyDate >= startDate && policyDate <= endDate;
      });
    }

    if (process.env.NODE_ENV === 'development') {
      console.log('InsightsDashboard: Filter applied', { 
        startDate: startDate?.toISOString(), 
        endDate: endDate?.toISOString(), 
        filteredCount: filtered.length 
      });
    }

    setFilteredPolicies(filtered);
    generateInsights(filtered);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [policies, dateFilter, customStartDate, customEndDate]);

  useEffect(() => {
    if (user) {
      fetchPolicies();
    }
  }, [user, fetchPolicies]);

  const generateInsights = useCallback((policies: Policy[]) => {
    // Generate monthly commission data
    const monthlyData = generateMonthlyCommissions(policies);

    // Generate product mix data
    const productData = generateProductMix(policies);

    // Generate carrier breakdown
    const carrierData = generateCarrierBreakdown(policies);

    // Generate status distribution
    const statusData = generateStatusDistribution(policies);

    setInsights({
      monthlyCommissions: monthlyData,
      productMix: productData,
      carrierBreakdown: carrierData,
      statusDistribution: statusData,
      commissionPayments: generateCommissionPayments(policies),
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timeRange]);

  const generateMonthlyCommissions = (policies: Policy[]) => {
    const months = [];
    const today = new Date();

    for (let i = timeRange - 1; i >= 0; i--) {
      const monthDate = startOfMonth(subMonths(today, i));
      const monthStr = format(monthDate, "MMM yyyy");

      // Calculate actual commissions for this month
      const monthPolicies = policies.filter((policy) => {
        const policyDate = new Date(policy.created_at);
        return (
          policyDate.getMonth() === monthDate.getMonth() &&
          policyDate.getFullYear() === monthDate.getFullYear()
        );
      });

      const actual = monthPolicies.reduce(
        (sum, p) => sum + p.commission_due,
        0
      );

      // Simple projection based on average growth
      const avgMonthly =
        policies.reduce((sum, p) => sum + p.commission_due, 0) / timeRange;
      const growthRate = 1.05; // 5% monthly growth projection
      const projected = avgMonthly * Math.pow(growthRate, timeRange - i);

      months.push({
        month: monthStr,
        actual: Math.round(actual),
        projected: Math.round(projected),
      });
    }

    // Add future projections
    for (let i = 1; i <= 3; i++) {
      const monthDate = startOfMonth(subMonths(today, -i));
      const monthStr = format(monthDate, "MMM yyyy");
      const avgMonthly =
        policies.reduce((sum, p) => sum + p.commission_due, 0) / timeRange;
      const projected = avgMonthly * Math.pow(1.05, timeRange + i);

      months.push({
        month: monthStr,
        actual: 0,
        projected: Math.round(projected),
      });
    }

    return months;
  };

  const generateProductMix = (policies: Policy[]) => {
    const productMap = new Map<string, { value: number; count: number }>();

    policies.forEach((policy) => {
      // Apply product normalization logic to ensure consistent naming
      const normalizedProduct = normalizeProductName(policy.carrier, policy.product);
      const existing = productMap.get(normalizedProduct) || { value: 0, count: 0 };
      productMap.set(normalizedProduct, {
        value: existing.value + policy.commission_due,
        count: existing.count + 1,
      });
    });

    return Array.from(productMap.entries())
      .map(([name, data]) => ({
        name,
        value: data.value,
        count: data.count,
      }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 6); // Top 6 products
  };

  const generateCarrierBreakdown = (policies: Policy[]) => {
    const carrierMap = new Map<
      string,
      { premium: number; commission: number; policies: number }
    >();

    policies.forEach((policy) => {
      const existing = carrierMap.get(policy.carrier) || {
        premium: 0,
        commission: 0,
        policies: 0,
      };
      carrierMap.set(policy.carrier, {
        premium: existing.premium + policy.commissionable_annual_premium,
        commission: existing.commission + policy.commission_due,
        policies: existing.policies + 1,
      });
    });

    return Array.from(carrierMap.entries())
      .map(([carrier, data]) => ({
        carrier,
        premium: data.premium,
        commission: data.commission,
        policies: data.policies,
      }))
      .sort((a, b) => b.commission - a.commission);
  };

  const generateStatusDistribution = (policies: Policy[]) => {
    const statusMap = new Map<string, { count: number; value: number }>();

    policies.forEach((policy) => {
      const existing = statusMap.get(policy.policy_status) || {
        count: 0,
        value: 0,
      };
      statusMap.set(policy.policy_status, {
        count: existing.count + 1,
        value: existing.value + policy.commission_due,
      });
    });

    return Array.from(statusMap.entries()).map(([status, data]) => ({
      status,
      count: data.count,
      value: Math.round(data.value),
    }));
  };

  const generateCommissionPayments = (policies: Policy[]) => {
    // Filter out cancelled policies first, then separate paid and unpaid
    const activePolicies = policies.filter(p => p.policy_status !== 'Cancelled');
    
    const verifiedPolicies = activePolicies.filter(
      (p) => p.date_policy_verified && p.date_policy_verified !== null
    );
    const unverifiedPolicies = activePolicies.filter(
      (p) => !p.date_policy_verified || p.date_policy_verified === null
    );

    const verifiedCount = verifiedPolicies.length;
    const unverifiedCount = unverifiedPolicies.length;

    const totalVerified = verifiedPolicies.reduce(
      (sum, p) => sum + p.commission_due,
      0
    );
    const totalUnverified = unverifiedPolicies.reduce(
      (sum, p) => sum + p.commission_due,
      0
    );

    const avgDaysToPayment = verifiedPolicies.length > 0 ? calculateAvgDaysToPayment(verifiedPolicies) : 0;

    const monthlyPayments = generateMonthlyPaymentTrends(activePolicies);

    return {
      verified: Math.round(totalVerified),
      unverified: Math.round(totalUnverified),
      verifiedCount,
      unverifiedCount,
      avgDaysToPayment,
      monthlyPayments,
    };
  };

  const calculateAvgDaysToPayment = (policies: Policy[]) => {
    const verifiedPolicies = policies.filter(
      (p) => p.date_policy_verified && p.date_policy_verified !== null
    );
    if (verifiedPolicies.length === 0) return 0;

    const totalDays = verifiedPolicies.reduce((sum, p) => {
      const verifiedDate = new Date(p.date_policy_verified!);
      const createdDate = new Date(p.created_at);
      const diffTime = verifiedDate.getTime() - createdDate.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      return sum + diffDays;
    }, 0);

    return Math.round(totalDays / verifiedPolicies.length);
  };

  const generateMonthlyPaymentTrends = (policies: Policy[]) => {
    const monthlyMap = new Map<string, { amount: number; count: number }>();
    const today = new Date();

    for (let i = 0; i < 6; i++) {
      const monthDate = startOfMonth(subMonths(today, i));
      const monthStr = format(monthDate, "MMM yyyy");

      const policiesInMonth = policies.filter((policy) => {
        const policyDate = new Date(policy.created_at);
        return (
          policyDate.getMonth() === monthDate.getMonth() &&
          policyDate.getFullYear() === monthDate.getFullYear()
        );
      });

      const verifiedPoliciesInMonth = policiesInMonth.filter(
        (p) => p.date_policy_verified && p.date_policy_verified !== null
      );

      monthlyMap.set(monthStr, {
        amount: verifiedPoliciesInMonth.reduce((sum, p) => sum + p.commission_due, 0),
        count: verifiedPoliciesInMonth.length,
      });
    }

    return Array.from(monthlyMap.entries()).map(([month, data]) => ({
      month,
      amount: data.amount,
      count: data.count,
    }));
  };

  // Calculate totals excluding cancelled policies
  const activePolicies = filteredPolicies.filter(p => p.policy_status !== 'Cancelled');
  
  const totalCommission = activePolicies.reduce(
    (sum, p) => sum + p.commission_due,
    0
  );
  const totalPremium = activePolicies.reduce(
    (sum, p) => sum + p.commissionable_annual_premium,
    0
  );

  // Calculate chargeback metrics
  const chargebackMetrics = calculateChargebacks(filteredPolicies);
  const chargebackAlert = getChargebackAlertLevel(filteredPolicies);

  // Calculate reconciliation metrics
  const reconciliationSummary = generateReconciliationSummary(filteredPolicies);

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="text-gray-600">Loading insights...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Date Range Filter */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow dark:shadow-gray-900/50 p-4">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Date Range:
            </label>
            <select
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
              className="px-3 py-1.5 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="all">All Time</option>
              <option value="month">This Month</option>
              <option value="quarter">This Quarter</option>
              <option value="year">This Year</option>
              <option value="ytd">Year to Date</option>
              <option value="custom">Custom Range</option>
            </select>
          </div>

          {dateFilter === "custom" && (
            <div className="flex items-center gap-2">
              <input
                type="date"
                value={customStartDate}
                onChange={(e) => setCustomStartDate(e.target.value)}
                className="px-3 py-1.5 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
              <span className="text-gray-500">to</span>
              <input
                type="date"
                value={customEndDate}
                onChange={(e) => setCustomEndDate(e.target.value)}
                className="px-3 py-1.5 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          )}

          <div className="ml-auto text-sm text-gray-600">
            Showing {activePolicies.length} active of {filteredPolicies.length} filtered policies
          </div>
        </div>
      </div>

      {/* Chargeback Alert */}
      {chargebackMetrics.totalChargebacks > 0 && (
        <div className={`rounded-lg p-4 mb-6 ${
          chargebackAlert.level === 'high' ? 'bg-red-50 border border-red-200' :
          chargebackAlert.level === 'medium' ? 'bg-yellow-50 border border-yellow-200' :
          'bg-blue-50 border border-blue-200'
        }`}>
          <div className="flex items-start">
            <div className="flex-shrink-0">
              <svg className={`h-6 w-6 ${
                chargebackAlert.level === 'high' ? 'text-red-600' :
                chargebackAlert.level === 'medium' ? 'text-yellow-600' :
                'text-blue-600'
              }`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.732-.833-2.5 0L4.268 19.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
            </div>
            <div className="ml-3 flex-1">
              <h3 className={`text-sm font-medium ${
                chargebackAlert.level === 'high' ? 'text-red-800' :
                chargebackAlert.level === 'medium' ? 'text-yellow-800' :
                'text-blue-800'
              }`}>
                Chargeback Alert
              </h3>
              <div className={`mt-2 text-sm ${
                chargebackAlert.level === 'high' ? 'text-red-700' :
                chargebackAlert.level === 'medium' ? 'text-yellow-700' :
                'text-blue-700'
              }`}>
                <p>{chargebackAlert.message}</p>
                <p className="mt-1">
                  <strong>{chargebackMetrics.totalChargebacks}</strong> policies cancelled within 30 days, 
                  representing <strong>${chargebackMetrics.chargebackAmount.toFixed(2)}</strong> in lost commission.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Reconciliation Alerts */}
      {reconciliationSummary.alerts.length > 0 && (
        <div className="bg-orange-50 border border-orange-200 rounded-lg p-4 mb-6">
          <div className="flex items-start">
            <div className="flex-shrink-0">
              <svg className="h-6 w-6 text-orange-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <div className="ml-3 flex-1">
              <h3 className="text-sm font-medium text-orange-800">
                Reconciliation Issues Detected
              </h3>
              <div className="mt-2 text-sm text-orange-700">
                <p className="mb-3">
                  Found <strong>{reconciliationSummary.alerts.length}</strong> policies that may need attention for commission spreadsheet reconciliation.
                </p>
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {reconciliationSummary.alerts.slice(0, 5).map((alert) => (
                    <div 
                      key={alert.id} 
                      className={`p-3 rounded border-l-4 text-xs ${
                        alert.severity === 'high' ? 'bg-red-50 border-red-400' :
                        alert.severity === 'medium' ? 'bg-yellow-50 border-yellow-400' :
                        'bg-blue-50 border-blue-400'
                      }`}
                    >
                      <p className="font-medium">{formatAlertMessage(alert)}</p>
                      <p className="text-gray-600 mt-1">{alert.suggestedAction}</p>
                    </div>
                  ))}
                  {reconciliationSummary.alerts.length > 5 && (
                    <p className="text-xs text-orange-600 italic">
                      ...and {reconciliationSummary.alerts.length - 5} more issues
                    </p>
                  )}
                </div>
                {reconciliationSummary.recommendations.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-orange-200">
                    <p className="font-medium text-orange-800 text-xs mb-2">Recommendations:</p>
                    <ul className="list-disc list-inside space-y-1">
                      {reconciliationSummary.recommendations.map((rec, index) => (
                        <li key={index} className="text-xs text-orange-700">{rec}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Header Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow dark:shadow-gray-900/50 p-6">
          <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">
            Total Commission
          </h3>
          <p className="text-2xl font-bold text-gray-900 mt-2">
            ${totalCommission.toLocaleString()}
          </p>
          <p className="text-sm text-green-600 mt-1">
            {(() => {
              const paidAmount = filteredPolicies
                .filter(p => p.date_policy_verified)
                .reduce((sum, p) => sum + p.commission_due, 0);
              const paidPercentage = totalCommission > 0 ? (paidAmount / totalCommission) * 100 : 0;
              return `${paidPercentage.toFixed(0)}% paid`;
            })()}
          </p>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-sm font-medium text-gray-500">Total Premium</h3>
          <p className="text-2xl font-bold text-gray-900 mt-2">
            ${totalPremium.toLocaleString()}
          </p>
          <p className="text-sm text-gray-500 mt-1">
            Across {filteredPolicies.length} policies
          </p>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-sm font-medium text-gray-500">
            Next Payment
          </h3>
          <p className="text-2xl font-bold text-gray-900 mt-2">
            {(() => {
              const nextPayment = getNextPaymentDate();
              if (!nextPayment) return "N/A";
              const expectedCommission = calculateExpectedCommissionForPeriod(
                filteredPolicies,
                nextPayment.periodEnd
              );
              return `$${expectedCommission.expectedAmount.toLocaleString()}`;
            })()}
          </p>
          <p className="text-sm text-gray-500 mt-1">
            {(() => {
              const nextPayment = getNextPaymentDate();
              if (!nextPayment) return "";
              return format(parseISO(nextPayment.date), "MMM d");
            })()}
          </p>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-sm font-medium text-gray-500">Active Policies</h3>
          <p className="text-2xl font-bold text-gray-900 mt-2">
            {
              filteredPolicies.filter((p) => p.policy_status === "Active")
                .length
            }
          </p>
          <p className="text-sm text-gray-500 mt-1">
            {filteredPolicies.length > 0
              ? (
                  (filteredPolicies.filter((p) => p.policy_status === "Active")
                    .length /
                    filteredPolicies.length) *
                  100
                ).toFixed(0)
              : 0}
            % of total
          </p>
        </div>
      </div>

      {/* Commission Forecast Chart */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-semibold text-gray-900">
            Commission Forecast
          </h2>
          <select
            value={timeRange}
            onChange={(e) => setTimeRange(Number(e.target.value))}
            className="px-3 py-1 border border-gray-300 rounded-md text-sm"
          >
            <option value={3}>3 months</option>
            <option value={6}>6 months</option>
            <option value={12}>12 months</option>
          </select>
        </div>
        <ResponsiveContainer width="100%" height={300}>
          <AreaChart data={insights.monthlyCommissions}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="month" />
            <YAxis />
            <Tooltip
              formatter={(value: number) => `$${value.toLocaleString()}`}
            />
            <Legend />
            <Area
              type="monotone"
              dataKey="actual"
              stackId="1"
              stroke="#3B82F6"
              fill="#3B82F6"
              fillOpacity={0.6}
              name="Actual Commission"
            />
            <Area
              type="monotone"
              dataKey="projected"
              stackId="2"
              stroke="#10B981"
              fill="#10B981"
              fillOpacity={0.3}
              name="Projected Commission"
              strokeDasharray="5 5"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Product Mix Pie Chart */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            Product Mix
          </h2>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={insights.productMix}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, percent }) =>
                  `${name} ${percent ? (percent * 100).toFixed(0) : 0}%`
                }
                outerRadius={80}
                fill="#8884d8"
                dataKey="value"
              >
                {insights.productMix.map((_, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={COLORS[index % COLORS.length]}
                  />
                ))}
              </Pie>
              <Tooltip
                formatter={(value: number) => `$${value.toLocaleString()}`}
              />
            </PieChart>
          </ResponsiveContainer>
          <div className="mt-4 space-y-2">
            {insights.productMix.map((product, index) => (
              <div
                key={product.name}
                className="flex items-center justify-between text-sm"
              >
                <div className="flex items-center">
                  <div
                    className="w-3 h-3 rounded-full mr-2"
                    style={{ backgroundColor: COLORS[index % COLORS.length] }}
                  />
                  <span>{product.name}</span>
                </div>
                <span className="text-gray-500">{product.count} policies</span>
              </div>
            ))}
          </div>
        </div>

        {/* Carrier Performance */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            Carrier Performance
          </h2>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={insights.carrierBreakdown} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis type="number" />
              <YAxis dataKey="carrier" type="category" width={100} />
              <Tooltip
                formatter={(value: number) => `$${value.toLocaleString()}`}
              />
              <Legend />
              <Bar dataKey="commission" fill="#3B82F6" name="Commission" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Status Distribution */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">
          Policy Status Distribution
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {insights.statusDistribution.map((status) => (
            <div
              key={status.status}
              className={`p-4 rounded-lg ${
                status.status === "Active"
                  ? "bg-green-50 border border-green-200"
                  : status.status === "Pending"
                  ? "bg-yellow-50 border border-yellow-200"
                  : "bg-red-50 border border-red-200"
              }`}
            >
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="font-medium text-gray-900">{status.status}</h3>
                  <p className="text-2xl font-bold mt-2">{status.count}</p>
                  <p className="text-sm text-gray-600">policies</p>
                </div>
                                 <div className="text-right">
                   <p className="text-sm text-gray-600">Commission</p>
                   <p className={`text-lg font-semibold ${
                     status.status === "Cancelled" ? "text-red-600" : ""
                   }`}>
                     {status.status === "Cancelled" ? "-" : ""}${status.value.toLocaleString()}
                   </p>
                   {status.status === "Cancelled" && status.count > 0 && (
                     <p className="text-xs text-red-600 mt-1 font-medium">Lost revenue</p>
                   )}
                 </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Pipeline Health Indicator */}
      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
          <svg className="h-5 w-5 text-blue-600 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
          Pipeline Health
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="text-center">
            <div className="text-3xl font-bold text-yellow-600">
              {filteredPolicies.filter(p => p.policy_status === 'Pending').length}
            </div>
            <div className="text-sm text-gray-600 mt-1">Pending</div>
            <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
              <div className="bg-yellow-500 h-2 rounded-full" style={{ width: `${(filteredPolicies.filter(p => p.policy_status === 'Pending').length / filteredPolicies.length) * 100}%` }}></div>
            </div>
          </div>
          <div className="text-center">
            <div className="text-3xl font-bold text-green-600">
              {filteredPolicies.filter(p => p.policy_status === 'Active').length}
            </div>
            <div className="text-sm text-gray-600 mt-1">Active</div>
            <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
              <div className="bg-green-500 h-2 rounded-full" style={{ width: `${(filteredPolicies.filter(p => p.policy_status === 'Active').length / filteredPolicies.length) * 100}%` }}></div>
            </div>
          </div>
          <div className="text-center">
            <div className="text-3xl font-bold text-blue-600">
              {filteredPolicies.filter(p => !p.date_policy_verified).length}
            </div>
            <div className="text-sm text-gray-600 mt-1">Awaiting Payment</div>
            <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
              <div className="bg-blue-500 h-2 rounded-full" style={{ width: `${(filteredPolicies.filter(p => !p.date_policy_verified).length / filteredPolicies.length) * 100}%` }}></div>
            </div>
          </div>
          <div className="text-center">
            <div className="text-3xl font-bold text-purple-600">
              {filteredPolicies.filter(p => p.date_policy_verified).length}
            </div>
                         <div className="text-sm text-gray-600 mt-1">Verified</div>
            <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
              <div className="bg-purple-500 h-2 rounded-full" style={{ width: `${(filteredPolicies.filter(p => p.date_policy_verified).length / filteredPolicies.length) * 100}%` }}></div>
            </div>
          </div>
        </div>
      </div>

      {/* Commission Payment Analytics */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">
          Commission Payment Analytics
        </h2>
        
        {/* Payment Status Overview */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="bg-gradient-to-r from-green-50 to-green-100 border border-green-200 rounded-lg p-4">
            <div className="flex items-center justify-between">
                             <div>
                 <h3 className="text-sm font-medium text-green-800">
                   Verified Policies
                 </h3>
                 <p className="text-2xl font-bold text-green-900 mt-2">
                   ${insights.commissionPayments.verified.toLocaleString()}
                 </p>
                 <p className="text-sm text-green-600 mt-1">
                   {insights.commissionPayments.verifiedCount} policies
                 </p>
               </div>
              <div className="bg-green-200 rounded-full p-3">
                <svg className="h-6 w-6 text-green-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
            </div>
          </div>
          
          <div className="bg-gradient-to-r from-orange-50 to-orange-100 border border-orange-200 rounded-lg p-4">
            <div className="flex items-center justify-between">
                             <div>
                 <h3 className="text-sm font-medium text-orange-800">
                   Unverified Policies
                 </h3>
                 <p className="text-2xl font-bold text-orange-900 mt-2">
                   ${insights.commissionPayments.unverified.toLocaleString()}
                 </p>
                 <p className="text-sm text-orange-600 mt-1">
                   {insights.commissionPayments.unverifiedCount} policies
                 </p>
               </div>
              <div className="bg-orange-200 rounded-full p-3">
                <svg className="h-6 w-6 text-orange-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
            </div>
          </div>
          
          <div className="bg-gradient-to-r from-purple-50 to-purple-100 border border-purple-200 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-medium text-purple-800">
                  Conversion Rate
                </h3>
                <p className="text-2xl font-bold text-purple-900 mt-2">
                  {(() => {
                    const pendingCount = filteredPolicies.filter(p => p.policy_status === 'Pending').length;
                    const activeCount = filteredPolicies.filter(p => p.policy_status === 'Active').length;
                    const total = pendingCount + activeCount;
                    if (total === 0) return "0%";
                    return `${((activeCount / total) * 100).toFixed(0)}%`;
                  })()}
                </p>
                <p className="text-sm text-purple-600 mt-1">
                  Pending → Active
                </p>
              </div>
              <div className="bg-purple-200 rounded-full p-3">
                <svg className="h-6 w-6 text-purple-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                </svg>
              </div>
            </div>
          </div>
        </div>

        {/* Payment Progress Bar */}
        <div className="mb-6">
                     <div className="flex justify-between text-sm text-gray-600 mb-2">
             <span>Verification Progress</span>
                         <span>{((insights.commissionPayments.verifiedCount / (insights.commissionPayments.verifiedCount + insights.commissionPayments.unverifiedCount)) * 100).toFixed(1)}% Complete</span>
           </div>
           <div className="w-full bg-gray-200 rounded-full h-3">
             <div 
               className="bg-gradient-to-r from-green-500 to-green-600 h-3 rounded-full"
               style={{ width: `${(insights.commissionPayments.verifiedCount / (insights.commissionPayments.verifiedCount + insights.commissionPayments.unverifiedCount)) * 100}%` }}
            />
          </div>
        </div>

        {/* Monthly Payment Trends Chart */}
        <div>
          <h3 className="text-md font-semibold text-gray-800 mb-3">
            Monthly Payment Trends
          </h3>
          <ResponsiveContainer width="100%" height={250}>
            <AreaChart data={[...insights.commissionPayments.monthlyPayments].reverse()}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" />
              <YAxis />
              <Tooltip
                formatter={(value: number) => `$${value.toLocaleString()}`}
              />
              <Area
                type="monotone"
                dataKey="amount"
                stroke="#10B981"
                fill="#10B981"
                fillOpacity={0.3}
                name="Commission from Verified Policies"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}

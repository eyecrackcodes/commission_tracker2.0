"use client";

import { useState, useEffect, useCallback } from "react";
import { useUser } from "@clerk/nextjs";
import { supabase, Policy } from "@/lib/supabase";
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
import { format, startOfMonth, subMonths } from "date-fns";

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
  const [insights, setInsights] = useState<InsightsData>({
    monthlyCommissions: [],
    productMix: [],
    carrierBreakdown: [],
    statusDistribution: [],
  });
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState(6); // months
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
      generateInsights(data || []);
    } catch (err) {
      console.error("Error fetching policies:", err);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (user) {
      fetchPolicies();
    }
  }, [user, fetchPolicies]);

  const generateInsights = (policies: Policy[]) => {
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
    });
  };

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
      const existing = productMap.get(policy.product) || { value: 0, count: 0 };
      productMap.set(policy.product, {
        value: existing.value + policy.commission_due,
        count: existing.count + 1,
      });
    });

    return Array.from(productMap.entries())
      .map(([name, data]) => ({
        name,
        value: Math.round(data.value),
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
        premium: Math.round(data.premium),
        commission: Math.round(data.commission),
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

  const totalCommission = policies.reduce(
    (sum, p) => sum + p.commission_due,
    0
  );
  const totalPremium = policies.reduce(
    (sum, p) => sum + p.commissionable_annual_premium,
    0
  );
  const avgCommissionRate =
    policies.length > 0
      ? policies.reduce((sum, p) => sum + p.commission_rate, 0) /
        policies.length
      : 0;

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="text-gray-600">Loading insights...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-sm font-medium text-gray-500">
            Total Commission
          </h3>
          <p className="text-2xl font-bold text-gray-900 mt-2">
            ${totalCommission.toLocaleString()}
          </p>
          <p className="text-sm text-green-600 mt-1">
            +{((avgCommissionRate - 0.05) * 100).toFixed(1)}% from base rate
          </p>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-sm font-medium text-gray-500">Total Premium</h3>
          <p className="text-2xl font-bold text-gray-900 mt-2">
            ${totalPremium.toLocaleString()}
          </p>
          <p className="text-sm text-gray-500 mt-1">
            Across {policies.length} policies
          </p>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-sm font-medium text-gray-500">
            Avg Commission Rate
          </h3>
          <p className="text-2xl font-bold text-gray-900 mt-2">
            {(avgCommissionRate * 100).toFixed(1)}%
          </p>
          <p className="text-sm text-gray-500 mt-1">Weighted average</p>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-sm font-medium text-gray-500">Active Policies</h3>
          <p className="text-2xl font-bold text-gray-900 mt-2">
            {policies.filter((p) => p.policy_status === "Active").length}
          </p>
          <p className="text-sm text-gray-500 mt-1">
            {(
              (policies.filter((p) => p.policy_status === "Active").length /
                policies.length) *
              100
            ).toFixed(0)}
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
                  `${name} ${(percent * 100).toFixed(0)}%`
                }
                outerRadius={80}
                fill="#8884d8"
                dataKey="value"
              >
                {insights.productMix.map((entry, index) => (
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
                  <p className="text-lg font-semibold">
                    ${status.value.toLocaleString()}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

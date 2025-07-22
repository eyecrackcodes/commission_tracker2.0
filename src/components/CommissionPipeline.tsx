"use client";

import { useState, useEffect, useCallback } from "react";
import { useUser } from "@clerk/nextjs";
import { supabase, Policy } from "@/lib/supabase";
import { 
  getUpcomingPaymentPeriods, 
  getNextPaymentDate,
  getPreviousPaymentDate,
  calculateExpectedCommissionForPeriod
} from "@/lib/commissionCalendar";
import { format, parseISO } from "date-fns";

interface PipelineData {
  paymentDate: string;
  periodEnd: string;
  expectedCommission: number;
  policyCount: number;
  daysUntilPayment: number;
  policies: Policy[];
}

export default function CommissionPipeline() {
  const [policies, setPolicies] = useState<Policy[]>([]);
  const [pipelineData, setPipelineData] = useState<PipelineData[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPeriod, setSelectedPeriod] = useState<PipelineData | null>(null);
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

      const policiesData = data || [];
      setPolicies(policiesData);
      generatePipelineData(policiesData);
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

  const generatePipelineData = (policies: Policy[]) => {
    const upcomingPeriods = getUpcomingPaymentPeriods(6); // Get next 6 payment periods
    const pipeline: PipelineData[] = [];

    upcomingPeriods.forEach(period => {
      const periodData = calculateExpectedCommissionForPeriod(policies, period.periodEnd);
      const today = new Date();
      const payDate = parseISO(period.date);
      const daysUntil = Math.ceil((payDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

      pipeline.push({
        paymentDate: period.date,
        periodEnd: period.periodEnd,
        expectedCommission: periodData.expectedAmount,
        policyCount: periodData.policyCount,
        daysUntilPayment: Math.max(0, daysUntil),
        policies: periodData.policies as Policy[]
      });
    });

    setPipelineData(pipeline);
  };

  const nextPayment = getNextPaymentDate();
  const previousPayment = getPreviousPaymentDate();

  // Calculate total expected commission in pipeline
  const totalPipelineCommission = pipelineData.reduce((sum, period) => sum + period.expectedCommission, 0);
  const totalPipelinePolicies = pipelineData.reduce((sum, period) => sum + period.policyCount, 0);

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="text-gray-600">Loading commission pipeline...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Pipeline Summary */}
      <div className="bg-gradient-to-r from-blue-600 to-blue-700 rounded-lg shadow-lg p-6 text-white">
        <h2 className="text-2xl font-bold mb-4">Commission Pipeline</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <p className="text-blue-100 text-sm">Total Expected</p>
            <p className="text-3xl font-bold">${totalPipelineCommission.toLocaleString()}</p>
          </div>
          <div>
            <p className="text-blue-100 text-sm">Unpaid Policies</p>
            <p className="text-3xl font-bold">{totalPipelinePolicies}</p>
          </div>
          <div>
            <p className="text-blue-100 text-sm">Next Payment</p>
            <p className="text-xl font-semibold">
              {nextPayment ? format(parseISO(nextPayment.date), 'MMM d, yyyy') : 'N/A'}
            </p>
            <p className="text-sm text-blue-200">
              {nextPayment && pipelineData[0] ? `${pipelineData[0].daysUntilPayment} days away` : ''}
            </p>
          </div>
        </div>
      </div>

      {/* Previous Payment Info */}
      {previousPayment && (
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Last Payment Date</p>
              <p className="font-semibold">{format(parseISO(previousPayment.date), 'MMMM d, yyyy')}</p>
              <p className="text-xs text-gray-500">Period ended: {format(parseISO(previousPayment.periodEnd), 'MMM d, yyyy')}</p>
            </div>
            <div className="text-right">
              <p className="text-sm text-gray-600">Status</p>
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                Completed
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Upcoming Payment Periods */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-gray-900">Upcoming Payment Periods</h3>
        {pipelineData.map((period, index) => (
          <div 
            key={period.paymentDate}
            className={`bg-white rounded-lg shadow p-6 cursor-pointer transition-all hover:shadow-lg ${
              index === 0 ? 'ring-2 ring-blue-500' : ''
            }`}
            onClick={() => setSelectedPeriod(period)}
          >
            <div className="flex items-center justify-between mb-4">
              <div>
                <h4 className="text-lg font-semibold text-gray-900">
                  {format(parseISO(period.paymentDate), 'EEEE, MMMM d, yyyy')}
                </h4>
                <p className="text-sm text-gray-600">
                  Period ends: {format(parseISO(period.periodEnd), 'MMM d, yyyy')}
                </p>
              </div>
              <div className="text-right">
                {index === 0 && (
                  <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-blue-100 text-blue-800 mb-2">
                    Next Payment
                  </span>
                )}
                <p className="text-2xl font-bold text-gray-900">
                  ${period.expectedCommission.toLocaleString()}
                </p>
                <p className="text-sm text-gray-600">
                  {period.policyCount} {period.policyCount === 1 ? 'policy' : 'policies'}
                </p>
              </div>
            </div>

            {/* Progress indicator */}
            <div className="mt-4">
              <div className="flex justify-between text-sm text-gray-600 mb-1">
                <span>Time until payment</span>
                <span>{period.daysUntilPayment} days</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div 
                  className={`h-2 rounded-full ${
                    period.daysUntilPayment <= 7 ? 'bg-green-500' : 
                    period.daysUntilPayment <= 14 ? 'bg-yellow-500' : 
                    'bg-blue-500'
                  }`}
                  style={{ 
                    width: `${Math.max(5, 100 - (period.daysUntilPayment / 30) * 100)}%` 
                  }}
                />
              </div>
            </div>

            {/* Policy breakdown preview */}
            {period.policyCount > 0 && (
              <div className="mt-4 pt-4 border-t border-gray-200">
                <p className="text-sm text-gray-600 mb-2">Recent policies in this period:</p>
                <div className="space-y-1">
                  {period.policies.slice(0, 3).map((policy, idx) => (
                    <div key={idx} className="flex justify-between text-sm">
                      <span className="text-gray-700">{policy.client} - {policy.carrier}</span>
                      <span className="font-medium">${policy.commission_due.toFixed(2)}</span>
                    </div>
                  ))}
                  {period.policies.length > 3 && (
                    <p className="text-sm text-gray-500 italic">
                      ...and {period.policies.length - 3} more
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Selected Period Details Modal */}
      {selectedPeriod && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl max-h-[80vh] overflow-hidden">
            <div className="bg-gradient-to-r from-blue-600 to-blue-700 px-6 py-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xl font-bold text-white">
                    Payment Period Details
                  </h3>
                  <p className="text-blue-100 text-sm">
                    {format(parseISO(selectedPeriod.paymentDate), 'EEEE, MMMM d, yyyy')}
                  </p>
                </div>
                <button
                  onClick={() => setSelectedPeriod(null)}
                  className="text-white/80 hover:text-white"
                >
                  <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            <div className="p-6 overflow-y-auto max-h-[calc(80vh-120px)]">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                <div className="bg-blue-50 rounded-lg p-4">
                  <p className="text-sm text-blue-700 font-medium">Expected Commission</p>
                  <p className="text-2xl font-bold text-blue-900">
                    ${selectedPeriod.expectedCommission.toLocaleString()}
                  </p>
                </div>
                <div className="bg-green-50 rounded-lg p-4">
                  <p className="text-sm text-green-700 font-medium">Policy Count</p>
                  <p className="text-2xl font-bold text-green-900">
                    {selectedPeriod.policyCount}
                  </p>
                </div>
                <div className="bg-purple-50 rounded-lg p-4">
                  <p className="text-sm text-purple-700 font-medium">Days Until Payment</p>
                  <p className="text-2xl font-bold text-purple-900">
                    {selectedPeriod.daysUntilPayment}
                  </p>
                </div>
              </div>

              <h4 className="font-semibold text-gray-900 mb-3">Policies in this period</h4>
              <div className="bg-gray-50 rounded-lg overflow-hidden">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-100">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Client</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Carrier</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Product</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Commission</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {selectedPeriod.policies.map((policy, idx) => (
                      <tr key={idx} className="hover:bg-gray-50">
                        <td className="px-4 py-3 text-sm text-gray-900">{policy.client}</td>
                        <td className="px-4 py-3 text-sm text-gray-900">{policy.carrier}</td>
                        <td className="px-4 py-3 text-sm text-gray-900">{policy.product}</td>
                        <td className="px-4 py-3 text-sm">
                          <span className={`inline-flex px-2 text-xs font-semibold rounded-full ${
                            policy.policy_status === 'Active' ? 'bg-green-100 text-green-800' :
                            policy.policy_status === 'Pending' ? 'bg-yellow-100 text-yellow-800' :
                            'bg-red-100 text-red-800'
                          }`}>
                            {policy.policy_status}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-900 text-right font-medium">
                          ${policy.commission_due.toFixed(2)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
} 
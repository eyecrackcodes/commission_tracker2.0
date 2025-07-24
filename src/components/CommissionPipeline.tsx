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
import { detectChargeback } from "@/lib/chargeback";

interface PipelineData {
  paymentDate: string;
  periodEnd: string;
  expectedCommission: number;
  totalCommission: number;
  verifiedCommission: number;
  policyCount: number;
  verifiedCount: number;
  unverifiedCount: number;
  daysUntilPayment: number;
  policies: Policy[];
}

interface CommissionPipelineProps {
  refreshKey?: number;
  onPolicyUpdate?: () => void;
}

export default function CommissionPipeline({ refreshKey, onPolicyUpdate }: CommissionPipelineProps) {
  const [pipelineData, setPipelineData] = useState<PipelineData[]>([]);
  const [allPolicies, setAllPolicies] = useState<Policy[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPeriod, setSelectedPeriod] = useState<PipelineData | null>(null);
  const [reconciliationMode, setReconciliationMode] = useState(false);
  const [reconciliationData, setReconciliationData] = useState<{[key: number]: boolean}>({});
  const [slackNotificationData, setSlackNotificationData] = useState<{[key: number]: boolean}>({});
  const [removalRequests, setRemovalRequests] = useState<{[key: number]: string}>({});
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
      setAllPolicies(policiesData);
      generatePipelineData(policiesData);
    } catch (err) {
      console.error("Error fetching policies:", err);
    } finally {
      setLoading(false);
    }
  }, [user]);

  const handleReconciliation = async () => {
    if (!user || !selectedPeriod) return;

    try {
      const updates = [];
      const discrepancies = [];
      const slackNotifications = [];
      const removals = [];
      
      for (const [policyIdStr, isPaid] of Object.entries(reconciliationData)) {
        const policyId = parseInt(policyIdStr);
        const policy = selectedPeriod.policies.find(p => p.id === policyId);
        
        if (policy) {
          if (isPaid && !policy.date_policy_verified) {
            // Policy is on spreadsheet but not verified in app - update verification
            updates.push({
              id: policyId,
              date_policy_verified: new Date().toISOString()
            });
          } else if (!isPaid && policy.date_policy_verified) {
            // Policy is verified in app but not on spreadsheet - flag discrepancy
            discrepancies.push({
              policyId: policy.id,
              client: policy.client,
              policyNumber: policy.policy_number,
              carrier: policy.carrier,
              commission: policy.commission_due,
              reason: 'verified_but_not_on_spreadsheet'
            });
          }

          // Check for Slack notification requests
          if (slackNotificationData[policyId]) {
            slackNotifications.push({
              policyId: policy.id,
              client: policy.client,
              policyNumber: policy.policy_number,
              carrier: policy.carrier,
              commission: policy.commission_due,
              status: policy.policy_status,
              reason: 'missing_commission_notification'
            });
          }

          // Check for removal requests
          if (removalRequests[policyId]?.trim()) {
            removals.push({
              policyId: policy.id,
              client: policy.client,
              policyNumber: policy.policy_number,
              carrier: policy.carrier,
              commission: policy.commission_due,
              reason: removalRequests[policyId].trim()
            });
          }
        }
      }

      // Update verified policies
      if (updates.length > 0) {
        for (const update of updates) {
          const { error } = await supabase
            .from("policies")
            .update({ date_policy_verified: update.date_policy_verified })
            .eq("id", update.id)
            .eq("user_id", user.id);

          if (error) throw error;
        }

        await fetchPolicies();
        if (onPolicyUpdate) {
          onPolicyUpdate();
        }
      }

      // Send Slack notifications for all types of issues
      const allSlackIssues = [...discrepancies, ...slackNotifications, ...removals];
      if (allSlackIssues.length > 0) {
        try {
          const response = await fetch('/api/slack-notification', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              type: 'reconciliation_alert',
              data: {
                discrepancies: allSlackIssues
              }
            }),
          });

          if (response.ok) {
            console.log('Reconciliation alert sent to Slack successfully');
          } else {
            console.error('Failed to send reconciliation alert to Slack');
          }
        } catch (slackError) {
          console.error('Error sending Slack reconciliation alert:', slackError);
        }
      }

      setReconciliationMode(false);
      setReconciliationData({});
      setSlackNotificationData({});
      setRemovalRequests({});
      
      // Show success message
      const updatedCount = updates.length;
      const issueCount = allSlackIssues.length;
      let message = "Reconciliation completed!";
      if (updatedCount > 0) {
        message += ` ${updatedCount} ${updatedCount === 1 ? 'policy' : 'policies'} verified.`;
      }
      if (issueCount > 0) {
        message += ` ${issueCount} ${issueCount === 1 ? 'issue' : 'issues'} reported to Slack.`;
      }
      
      console.log(message);
      
    } catch (err) {
      console.error("Error processing reconciliation:", err);
    }
  };

  useEffect(() => {
    if (user) {
      fetchPolicies();
    }
  }, [user, fetchPolicies]);

  useEffect(() => {
    if (user && refreshKey !== undefined) {
      fetchPolicies();
    }
  }, [refreshKey, user, fetchPolicies]);

  const generatePipelineData = (policies: Policy[]) => {
    const upcomingPeriods = getUpcomingPaymentPeriods(6);
    const pipeline: PipelineData[] = [];

    const activePolicies = policies.filter(policy => policy.policy_status !== 'Cancelled');

    upcomingPeriods.forEach(period => {
      const periodData = calculateExpectedCommissionForPeriod(activePolicies, period.periodEnd);
      const today = new Date();
      const payDate = parseISO(period.date);
      const daysUntil = Math.ceil((payDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

      pipeline.push({
        paymentDate: period.date,
        periodEnd: period.periodEnd,
        expectedCommission: periodData.expectedAmount,
        totalCommission: periodData.totalAmount,
        verifiedCommission: periodData.verifiedAmount,
        policyCount: periodData.policyCount,
        verifiedCount: periodData.verifiedCount,
        unverifiedCount: periodData.unverifiedCount,
        daysUntilPayment: Math.max(0, daysUntil),
        policies: periodData.policies as Policy[]
      });
    });

    setPipelineData(pipeline);
  };

  const nextPayment = getNextPaymentDate();
  const previousPayment = getPreviousPaymentDate();

  const totalPipelineCommission = pipelineData.reduce((sum, period) => sum + period.totalCommission, 0);
  const totalVerifiedCommission = pipelineData.reduce((sum, period) => sum + period.verifiedCommission, 0);
  const totalUnpaidCommission = pipelineData.reduce((sum, period) => sum + period.expectedCommission, 0);
  const totalPipelinePolicies = pipelineData.reduce((sum, period) => sum + period.policyCount, 0);

  const cancelledPolicies = allPolicies.filter(p => p.policy_status === 'Cancelled');
  const potentialLostCommission = cancelledPolicies.reduce((sum, policy) => sum + policy.commission_due, 0);

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
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <p className="text-blue-100 text-sm">Total Expected</p>
            <p className="text-3xl font-bold">${totalPipelineCommission.toLocaleString()}</p>
          </div>
          <div>
            <p className="text-blue-100 text-sm">Already Verified</p>
            <p className="text-2xl font-bold text-green-300">${totalVerifiedCommission.toLocaleString()}</p>
          </div>
          <div>
            <p className="text-blue-100 text-sm">Pending Payment</p>
            <p className="text-2xl font-bold text-yellow-300">${totalUnpaidCommission.toLocaleString()}</p>
          </div>
          <div>
            <p className="text-blue-100 text-sm">Total Policies</p>
            <p className="text-3xl font-bold">{totalPipelinePolicies}</p>
          </div>
        </div>
        
        {/* Next Payment Info */}
        <div className="mt-4 text-center">
          <p className="text-blue-100 text-sm">Next Payment</p>
          <p className="text-xl font-semibold">
            {nextPayment ? format(parseISO(nextPayment.date), 'MMM d, yyyy') : 'N/A'}
          </p>
          <p className="text-sm text-blue-200">
            {nextPayment && pipelineData[0] ? `${pipelineData[0].daysUntilPayment} days away` : ''}
          </p>
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

      {/* Cancelled Policies Motivation Alert */}
      {cancelledPolicies.length > 0 && (
        <div className="bg-gradient-to-r from-red-50 to-orange-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-start">
            <div className="flex-shrink-0">
              <svg className="h-6 w-6 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.732-.833-2.5 0L4.268 19.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
            </div>
            <div className="ml-3 flex-1">
              <h3 className="text-sm font-medium text-red-800">Lost Commission Opportunity</h3>
              <div className="mt-2 text-sm text-red-700">
                <p>
                  You have <strong>{cancelledPolicies.length}</strong> cancelled {cancelledPolicies.length === 1 ? 'policy' : 'policies'} representing 
                  <strong className="text-red-800"> ${potentialLostCommission.toLocaleString()}</strong> in lost commission.
                </p>
                <p className="mt-1 text-xs">
                  💡 Consider implementing a follow-up system for pending policies to reduce cancellations.
                </p>
              </div>
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
            onClick={() => {
              fetchPolicies();
              setSelectedPeriod(period);
              setReconciliationMode(false);
              setReconciliationData({});
            }}
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
                  ${period.totalCommission.toLocaleString()}
                </p>
                <div className="text-sm text-gray-600">
                  <p>{period.policyCount} {period.policyCount === 1 ? 'policy' : 'policies'}</p>
                  {period.verifiedCount > 0 && (
                    <p className="text-green-600">
                      {period.verifiedCommission.toLocaleString('en-US', {
                        style: 'currency',
                        currency: 'USD',
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2
                      })} verified ({period.verifiedCount})
                    </p>
                  )}
                  {period.unverifiedCount > 0 && (
                    <p className="text-blue-600">
                      {period.expectedCommission.toLocaleString('en-US', {
                        style: 'currency',
                        currency: 'USD',
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2
                      })} pending verification ({period.unverifiedCount})
                    </p>
                  )}
                </div>
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
                      <span className="font-medium">{policy.commission_due.toLocaleString('en-US', {
                        style: 'currency',
                        currency: 'USD',
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2
                      })}</span>
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
                <div className="flex items-center gap-2">
                  {!reconciliationMode && (
                    <button
                      onClick={() => {
                        setReconciliationMode(true);
                        const initialData: {[key: number]: boolean} = {};
                        const initialSlackData: {[key: number]: boolean} = {};
                        const initialRemovalData: {[key: number]: string} = {};
                        selectedPeriod.policies.forEach(policy => {
                          initialData[policy.id] = !!policy.date_policy_verified;
                          initialSlackData[policy.id] = false;
                          initialRemovalData[policy.id] = '';
                        });
                        setReconciliationData(initialData);
                        setSlackNotificationData(initialSlackData);
                        setRemovalRequests(initialRemovalData);
                      }}
                      className="bg-white/20 hover:bg-white/30 px-3 py-1 rounded text-sm font-medium transition-colors"
                    >
                      📊 Reconcile Spreadsheet
                    </button>
                  )}
                  <button
                    onClick={() => {
                      setSelectedPeriod(null);
                      setReconciliationMode(false);
                      setReconciliationData({});
                      setSlackNotificationData({});
                      setRemovalRequests({});
                    }}
                    className="text-white/80 hover:text-white"
                  >
                    <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>
            </div>

            <div className="p-6 overflow-y-auto max-h-[calc(80vh-120px)]">
              {reconciliationMode ? (
                <div className="space-y-6">
                  <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                    <div className="flex items-start">
                      <svg className="h-5 w-5 text-yellow-400 mt-0.5 mr-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <div>
                        <h3 className="text-sm font-medium text-yellow-800">Commission Spreadsheet Reconciliation</h3>
                        <p className="text-sm text-yellow-700 mt-1">
                          Check each policy below that appears on your commission spreadsheet for this period. 
                          Policies in red are chargebacks (cancelled within 30 days).
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-3">
                    {selectedPeriod.policies.map((policy) => {
                      const { isChargeback } = detectChargeback(policy);
                      const verificationMismatch = policy.date_policy_verified && !reconciliationData[policy.id];
                      
                      return (
                        <div 
                          key={policy.id} 
                          className={`border rounded-lg p-4 ${
                            isChargeback ? 'bg-red-50 border-red-200' : 
                            verificationMismatch ? 'bg-orange-50 border-orange-200' :
                            'bg-white border-gray-200'
                          }`}
                        >
                          <div className="space-y-3">
                            {/* Main Policy Information */}
                            <div className="flex items-start justify-between">
                              <div className="flex-1">
                                <div className="flex items-center gap-3">
                                  <div>
                                    <div className="flex items-center gap-2 mb-1">
                                      <input
                                        type="checkbox"
                                        checked={reconciliationData[policy.id] || false}
                                        onChange={(e) => setReconciliationData(prev => ({
                                          ...prev,
                                          [policy.id]: e.target.checked
                                        }))}
                                        className="h-4 w-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                                        disabled={isChargeback}
                                      />
                                      <label className="text-sm font-medium text-gray-700">
                                        On Spreadsheet
                                      </label>
                                    </div>
                                    <p className="font-medium text-gray-900">{policy.client}</p>
                                    <div className="text-sm text-gray-600 space-y-1">
                                      <p><span className="font-medium">Policy:</span> {policy.policy_number}</p>
                                      <p><span className="font-medium">Carrier:</span> {policy.carrier} • {policy.product}</p>
                                      <div className="flex items-center gap-2">
                                        <span className="font-medium">Status:</span>
                                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                                          policy.policy_status === 'Active' ? 'bg-green-100 text-green-800' :
                                          policy.policy_status === 'Pending' ? 'bg-yellow-100 text-yellow-800' :
                                          'bg-red-100 text-red-800'
                                        }`}>
                                          {policy.policy_status}
                                        </span>
                                      </div>
                                      {policy.date_policy_verified && (
                                        <p><span className="font-medium">Verified:</span> {format(parseISO(policy.date_policy_verified), 'MMM d, yyyy')}</p>
                                      )}
                                    </div>
                                    {isChargeback && (
                                      <p className="text-xs text-red-600 font-medium mt-2">
                                        ⚠️ CHARGEBACK - Cancelled within 30 days
                                      </p>
                                    )}
                                    {verificationMismatch && (
                                      <p className="text-xs text-orange-600 font-medium mt-2">
                                        ⚠️ Verified in app but not checked for spreadsheet
                                      </p>
                                    )}
                                  </div>
                                </div>
                              </div>
                              <div className="text-right">
                                <p className={`text-xl font-semibold ${isChargeback ? 'text-red-600' : 'text-gray-900'}`}>
                                  {isChargeback ? '-' : ''}{policy.commission_due.toLocaleString('en-US', {
                                    style: 'currency',
                                    currency: 'USD',
                                    minimumFractionDigits: 2,
                                    maximumFractionDigits: 2
                                  })}
                                </p>
                                <p className="text-xs text-gray-500">
                                  {(policy.commission_rate * 100).toFixed(0)}% commission
                                </p>
                              </div>
                            </div>

                            {/* Slack Notification Controls */}
                            <div className="pt-2 border-t border-gray-200">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  <input
                                    type="checkbox"
                                    checked={slackNotificationData[policy.id] || false}
                                    onChange={(e) => setSlackNotificationData(prev => ({
                                      ...prev,
                                      [policy.id]: e.target.checked
                                    }))}
                                    className="h-4 w-4 text-red-600 rounded border-gray-300 focus:ring-red-500"
                                  />
                                  <label className="text-sm font-medium text-gray-700">
                                    🚨 Send Slack Alert (Missing Commission)
                                  </label>
                                </div>
                              </div>
                              <p className="text-xs text-gray-500 mt-1 ml-6">
                                Check this to notify the team about missing commission or discrepancies
                              </p>
                            </div>

                            {/* Removal Request Input */}
                            <div className="pt-2 border-t border-gray-200">
                              <label className="block text-sm font-medium text-gray-700 mb-2">
                                📝 Request Policy Removal (Optional)
                              </label>
                              <textarea
                                value={removalRequests[policy.id] || ''}
                                onChange={(e) => setRemovalRequests(prev => ({
                                  ...prev,
                                  [policy.id]: e.target.value
                                }))}
                                placeholder="Explain why this policy should be removed from the spreadsheet (e.g., client cancelled, refund issued, etc.)"
                                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                                rows={2}
                              />
                              <p className="text-xs text-gray-500 mt-1">
                                This will send a Slack message requesting removal with your explanation
                              </p>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  <div className="flex items-center justify-between pt-4 border-t border-gray-200">
                    <button
                      onClick={() => {
                        setReconciliationMode(false);
                        setReconciliationData({});
                        setSlackNotificationData({});
                        setRemovalRequests({});
                      }}
                      className="px-4 py-2 text-gray-600 hover:text-gray-800 font-medium"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleReconciliation}
                      className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium transition-colors"
                    >
                      🔄 Process Reconciliation
                    </button>
                  </div>
                </div>
              ) : (
                <div>
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
                              {policy.commission_due.toLocaleString('en-US', {
                                style: 'currency',
                                currency: 'USD',
                                minimumFractionDigits: 2,
                                maximumFractionDigits: 2
                              })}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
} 
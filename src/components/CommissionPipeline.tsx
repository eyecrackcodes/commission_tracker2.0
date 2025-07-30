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
import { 
  ReconciliationFormData,
  ReconciliationOptions,
  ReconciliationSummary,
  SlackNotificationGroup
} from "@/types/reconciliation";

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
  const [reconciliationData, setReconciliationData] = useState<ReconciliationFormData>({});
  const [reconciliationOptions, setReconciliationOptions] = useState<ReconciliationOptions>({
    sendCompletionNotification: false,
    groupSimilarIssues: true,
    markAllAsProcessed: true
  });
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

  const calculateReconciliationSummary = (): ReconciliationSummary => {
    const summary = {
      onSpreadsheet: 0,
      missingCommission: 0,
      requestRemoval: 0,
      totalPolicies: 0,
      totalCommission: 0
    };

    Object.values(reconciliationData).forEach(policyState => {
      const policy = selectedPeriod?.policies.find(p => p.id === policyState.policyId);
      if (!policy) return;

      summary.totalPolicies++;
      summary.totalCommission += policy.commission_due;

      switch (policyState.action) {
        case 'on_spreadsheet':
          summary.onSpreadsheet++;
          break;
        case 'missing_commission':
          summary.missingCommission++;
          break;
        case 'request_removal':
          summary.requestRemoval++;
          break;
      }
    });

    return summary;
  };

  const groupSlackNotifications = (): SlackNotificationGroup[] => {
    const groups: SlackNotificationGroup[] = [];
    
    const missingCommissions: SlackNotificationGroup['policies'] = [];
    const removalRequests: SlackNotificationGroup['policies'] = [];
    const completedPolicies: SlackNotificationGroup['policies'] = [];

    Object.values(reconciliationData).forEach(policyState => {
      const policy = selectedPeriod?.policies.find(p => p.id === policyState.policyId);
      if (!policy) return;

      const policyData = {
        policyId: policy.id,
        client: policy.client,
        policyNumber: policy.policy_number,
        carrier: policy.carrier,
        product: policy.product,
        commission: policy.commission_due,
        priority: policyState.priority,
        reason: policyState.removalReason,
        status: policy.policy_status
      };

      switch (policyState.action) {
        case 'missing_commission':
          missingCommissions.push(policyData);
          break;
        case 'request_removal':
          removalRequests.push(policyData);
          break;
        case 'on_spreadsheet':
          completedPolicies.push(policyData);
          break;
      }
    });

    if (missingCommissions.length > 0) {
      groups.push({
        type: 'missing_commission',
        policies: missingCommissions,
        totalAmount: missingCommissions.reduce((sum, p) => sum + p.commission, 0)
      });
    }

    if (removalRequests.length > 0) {
      groups.push({
        type: 'removal_request',
        policies: removalRequests,
        totalAmount: removalRequests.reduce((sum, p) => sum + p.commission, 0)
      });
    }

    if (reconciliationOptions.sendCompletionNotification && completedPolicies.length > 0) {
      groups.push({
        type: 'reconciliation_complete',
        policies: completedPolicies,
        totalAmount: completedPolicies.reduce((sum, p) => sum + p.commission, 0)
      });
    }

    return groups;
  };

  const handleReconciliation = async () => {
    if (!user || !selectedPeriod) return;

    try {
      const updates = [];
      const slackGroups = groupSlackNotifications();
      
      // Process database updates
      for (const [, policyState] of Object.entries(reconciliationData)) {
        const policy = selectedPeriod.policies.find(p => p.id === policyState.policyId);
        if (!policy) continue;

        if (policyState.action === 'on_spreadsheet' && !policy.date_policy_verified) {
          // Policy is on spreadsheet but not verified in app - update verification
          updates.push({
            id: policyState.policyId,
            date_policy_verified: new Date().toISOString()
          });
        }
      }

      // Update verified policies in database
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

      // Send consolidated Slack notifications
      if (slackGroups.length > 0) {
        try {
          const response = await fetch('/api/slack-notification', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              type: 'reconciliation_alert_v2',
              data: {
                groups: slackGroups,
                paymentPeriod: selectedPeriod.paymentDate
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
      
      // Show success message  
      let message = "Reconciliation completed!";
      if (updates.length > 0) {
        message += ` ${updates.length} ${updates.length === 1 ? 'policy' : 'policies'} verified.`;
      }
      if (slackGroups.length > 0) {
        message += ` ${slackGroups.length} notification${slackGroups.length === 1 ? '' : 's'} sent to Slack.`;
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
                        const initialData: ReconciliationFormData = {};
                        selectedPeriod.policies.forEach(policy => {
                          initialData[policy.id] = {
                            policyId: policy.id,
                            action: policy.date_policy_verified ? 'on_spreadsheet' : null,
                            priority: 'normal',
                            removalReason: '',
                            notes: ''
                          };
                        });
                        setReconciliationData(initialData);
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
                  {/* Header with improved instructions */}
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <div className="flex items-start">
                      <svg className="h-5 w-5 text-blue-400 mt-0.5 mr-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      <div>
                        <h3 className="text-sm font-medium text-blue-800">Commission Spreadsheet Reconciliation</h3>
                        <p className="text-sm text-blue-700 mt-1">
                          For each policy, select one action: confirm it&apos;s on the spreadsheet, report missing commission, or request removal.
                          Policies in red are chargebacks (cancelled within 30 days).
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Progress indicator */}
                  {(() => {
                    const summary = calculateReconciliationSummary();
                    const completedActions = summary.onSpreadsheet + summary.missingCommission + summary.requestRemoval;
                    const totalPolicies = selectedPeriod.policies.length;
                    const progressPercent = totalPolicies > 0 ? (completedActions / totalPolicies) * 100 : 0;
                    
                    return (
                      <div className="bg-gray-50 rounded-lg p-4">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm font-medium text-gray-700">
                            Progress: {completedActions} of {totalPolicies} policies reviewed
                          </span>
                          <span className="text-sm text-gray-500">{Math.round(progressPercent)}%</span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2">
                          <div 
                            className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                            style={{ width: `${progressPercent}%` }}
                          ></div>
                        </div>
                        {completedActions > 0 && (
                          <div className="flex gap-4 mt-2 text-xs text-gray-600">
                            <span>✅ On Spreadsheet: {summary.onSpreadsheet}</span>
                            <span>🚨 Missing: {summary.missingCommission}</span>
                            <span>📝 Removal: {summary.requestRemoval}</span>
                          </div>
                        )}
                      </div>
                    );
                  })()}

                  {/* Reconciliation Options */}
                  <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                    <h4 className="text-sm font-medium text-green-800 mb-3">Notification Options</h4>
                    <div className="space-y-2">
                      <label className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={reconciliationOptions.sendCompletionNotification}
                          onChange={(e) => setReconciliationOptions(prev => ({
                            ...prev,
                            sendCompletionNotification: e.target.checked
                          }))}
                          className="h-4 w-4 text-green-600 rounded border-gray-300 focus:ring-green-500"
                        />
                        <span className="text-sm text-green-700">
                          📬 Send completion notification to Slack (confirms all verified commissions are correct)
                        </span>
                      </label>
                    </div>
                  </div>

                  {/* Policy list with improved UI */}
                  <div className="space-y-3">
                    {selectedPeriod.policies.map((policy) => {
                      const { isChargeback } = detectChargeback(policy);
                      const policyState = reconciliationData[policy.id];
                      const hasAction = policyState?.action !== null;
                      
                      return (
                        <div 
                          key={policy.id} 
                          className={`border rounded-lg p-4 transition-all ${
                            isChargeback ? 'bg-red-50 border-red-200' : 
                            hasAction ? 'bg-green-50 border-green-200' :
                            'bg-white border-gray-200 border-2 border-dashed'
                          }`}
                        >
                          <div className="space-y-4">
                            {/* Policy Header */}
                            <div className="flex items-start justify-between">
                              <div className="flex-1">
                                <h4 className="font-medium text-gray-900">{policy.client}</h4>
                                <div className="text-sm text-gray-600 space-y-1 mt-1">
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
                                    {policy.date_policy_verified && (
                                      <span className="inline-flex items-center px-2 py-1 text-xs font-medium rounded-full bg-blue-100 text-blue-800">
                                        ✓ Verified
                                      </span>
                                    )}
                                  </div>
                                </div>
                                {isChargeback && (
                                  <div className="mt-2 text-xs text-red-600 font-medium">
                                    ⚠️ CHARGEBACK - Cancelled within 30 days
                                  </div>
                                )}
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

                            {/* Action Selection - Radio Buttons */}
                            <div className="border-t pt-3">
                              <div className="text-sm font-medium text-gray-700 mb-3">Reconciliation Action:</div>
                              <div className="space-y-2">
                                <label className="flex items-center gap-3 p-2 rounded-md hover:bg-gray-50 cursor-pointer">
                                  <input
                                    type="radio"
                                    name={`action-${policy.id}`}
                                    checked={policyState?.action === 'on_spreadsheet'}
                                    onChange={() => setReconciliationData(prev => ({
                                      ...prev,
                                      [policy.id]: {
                                        ...prev[policy.id],
                                        action: 'on_spreadsheet'
                                      }
                                    }))}
                                    className="h-4 w-4 text-green-600 border-gray-300 focus:ring-green-500"
                                    disabled={isChargeback}
                                  />
                                  <div className="flex-1">
                                    <span className="text-sm font-medium text-gray-700">
                                      ✅ On Spreadsheet (Commission Correct)
                                    </span>
                                    <p className="text-xs text-gray-500">Policy exists on spreadsheet with correct commission amount</p>
                                  </div>
                                </label>

                                <label className="flex items-center gap-3 p-2 rounded-md hover:bg-gray-50 cursor-pointer">
                                  <input
                                    type="radio"
                                    name={`action-${policy.id}`}
                                    checked={policyState?.action === 'missing_commission'}
                                    onChange={() => setReconciliationData(prev => ({
                                      ...prev,
                                      [policy.id]: {
                                        ...prev[policy.id],
                                        action: 'missing_commission'
                                      }
                                    }))}
                                    className="h-4 w-4 text-red-600 border-gray-300 focus:ring-red-500"
                                  />
                                  <div className="flex-1">
                                    <span className="text-sm font-medium text-gray-700">
                                      🚨 Missing Commission / Incorrect Amount
                                    </span>
                                    <p className="text-xs text-gray-500">Policy missing from spreadsheet or commission amount is wrong</p>
                                  </div>
                                </label>

                                <label className="flex items-center gap-3 p-2 rounded-md hover:bg-gray-50 cursor-pointer">
                                  <input
                                    type="radio"
                                    name={`action-${policy.id}`}
                                    checked={policyState?.action === 'request_removal'}
                                    onChange={() => setReconciliationData(prev => ({
                                      ...prev,
                                      [policy.id]: {
                                        ...prev[policy.id],
                                        action: 'request_removal'
                                      }
                                    }))}
                                    className="h-4 w-4 text-orange-600 border-gray-300 focus:ring-orange-500"
                                  />
                                  <div className="flex-1">
                                    <span className="text-sm font-medium text-gray-700">
                                      📝 Request Removal
                                    </span>
                                    <p className="text-xs text-gray-500">Policy should be removed from spreadsheet</p>
                                  </div>
                                </label>
                              </div>

                              {/* Priority and Removal Reason */}
                              {policyState?.action === 'missing_commission' && (
                                <div className="mt-3 p-3 bg-red-50 rounded-md">
                                  <label className="flex items-center gap-2">
                                    <input
                                      type="checkbox"
                                      checked={policyState.priority === 'urgent'}
                                      onChange={(e) => setReconciliationData(prev => ({
                                        ...prev,
                                        [policy.id]: {
                                          ...prev[policy.id],
                                          priority: e.target.checked ? 'urgent' : 'normal'
                                        }
                                      }))}
                                      className="h-4 w-4 text-red-600 rounded border-gray-300 focus:ring-red-500"
                                    />
                                    <span className="text-sm font-medium text-red-700">⚡ Mark as Urgent</span>
                                  </label>
                                </div>
                              )}

                              {policyState?.action === 'request_removal' && (
                                <div className="mt-3">
                                  <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Removal Reason (Required)
                                  </label>
                                  <textarea
                                    value={policyState.removalReason}
                                    onChange={(e) => setReconciliationData(prev => ({
                                      ...prev,
                                      [policy.id]: {
                                        ...prev[policy.id],
                                        removalReason: e.target.value
                                      }
                                    }))}
                                    placeholder="Explain why this policy should be removed (e.g., client cancelled, refund processed, duplicate entry, etc.)"
                                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-orange-500 focus:border-orange-500"
                                    rows={2}
                                    required
                                  />
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Action Buttons */}
                  <div className="flex items-center justify-between pt-4 border-t border-gray-200">
                    <button
                      onClick={() => {
                        setReconciliationMode(false);
                        setReconciliationData({});
                      }}
                      className="px-4 py-2 text-gray-600 hover:text-gray-800 font-medium"
                    >
                      Cancel
                    </button>
                    <div className="flex items-center gap-3">
                      {(() => {
                        const summary = calculateReconciliationSummary();
                        const completedActions = summary.onSpreadsheet + summary.missingCommission + summary.requestRemoval;
                        const totalPolicies = selectedPeriod.policies.length;
                        const allComplete = completedActions === totalPolicies;
                        const hasRemovalWithoutReason = Object.values(reconciliationData).some(
                          state => state.action === 'request_removal' && !state.removalReason.trim()
                        );

                        return (
                          <>
                            <span className="text-sm text-gray-500">
                              {completedActions}/{totalPolicies} policies reviewed
                            </span>
                            <button
                              onClick={handleReconciliation}
                              disabled={!allComplete || hasRemovalWithoutReason}
                              className={`px-6 py-2 rounded-lg font-medium transition-colors ${
                                allComplete && !hasRemovalWithoutReason
                                  ? 'bg-blue-600 text-white hover:bg-blue-700'
                                  : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                              }`}
                            >
                              🔄 Process Reconciliation
                            </button>
                          </>
                        );
                      })()}
                    </div>
                  </div>
                </div>
              ) : (
                <div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                    <div className="bg-blue-50 rounded-lg p-4">
                      <p className="text-sm text-blue-700 font-medium">Total Commission</p>
                      <p className="text-2xl font-bold text-blue-900">
                        ${selectedPeriod.totalCommission.toLocaleString()}
                      </p>
                      <div className="mt-2 text-xs text-blue-600">
                        <div>Verified: ${selectedPeriod.verifiedCommission.toLocaleString()}</div>
                        <div>Unverified: ${selectedPeriod.expectedCommission.toLocaleString()}</div>
                      </div>
                    </div>
                    <div className="bg-green-50 rounded-lg p-4">
                      <p className="text-sm text-green-700 font-medium">Policy Count</p>
                      <p className="text-2xl font-bold text-green-900">
                        {selectedPeriod.policyCount}
                      </p>
                      <div className="mt-2 text-xs text-green-600">
                        <div>Verified: {selectedPeriod.verifiedCount}</div>
                        <div>Unverified: {selectedPeriod.unverifiedCount}</div>
                      </div>
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
                          <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Verified</th>
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
                            <td className="px-4 py-3 text-sm text-center">
                              {policy.date_policy_verified ? (
                                <span className="inline-flex items-center px-2 py-1 text-xs font-medium rounded-full bg-green-100 text-green-800">
                                  ✓ Verified
                                </span>
                              ) : (
                                <span className="inline-flex items-center px-2 py-1 text-xs font-medium rounded-full bg-yellow-100 text-yellow-800">
                                  Pending
                                </span>
                              )}
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
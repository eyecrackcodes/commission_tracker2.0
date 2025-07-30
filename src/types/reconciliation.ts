// Improved reconciliation workflow types

export type ReconciliationAction = 
  | 'on_spreadsheet'          // Policy exists and commission is correct
  | 'missing_commission'      // Policy missing or commission incorrect
  | 'request_removal';        // Policy should be removed

export type ReconciliationPriority = 'normal' | 'urgent';

export interface PolicyReconciliationState {
  policyId: number;
  action: ReconciliationAction | null;
  priority: ReconciliationPriority;
  removalReason: string;
  notes: string;
}

export interface ReconciliationSummary {
  onSpreadsheet: number;
  missingCommission: number;
  requestRemoval: number;
  totalPolicies: number;
  totalCommission: number;
}

export interface SlackNotificationGroup {
  type: 'missing_commission' | 'removal_request' | 'reconciliation_complete';
  policies: Array<{
    policyId: number;
    client: string;
    policyNumber: string;
    carrier: string;
    product: string;
    commission: number;
    priority?: ReconciliationPriority;
    reason?: string;
    status?: string;
  }>;
  totalAmount: number;
}

export interface ReconciliationFormData {
  [policyId: number]: PolicyReconciliationState;
}

export interface ReconciliationOptions {
  sendCompletionNotification: boolean;
  groupSimilarIssues: boolean;
  markAllAsProcessed: boolean;
}
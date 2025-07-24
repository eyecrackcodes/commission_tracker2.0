import { Policy } from './supabase';
import { parseISO } from 'date-fns';

export interface ReconciliationAlert {
  id: string;
  type: 'verified_missing' | 'payment_delay' | 'unexpected_payment';
  policy: Policy;
  message: string;
  severity: 'low' | 'medium' | 'high';
  daysOverdue: number;
  suggestedAction: string;
}

/**
 * Find policies that are verified in the app but may be missing from commission spreadsheets
 */
export function findReconciliationIssues(policies: Policy[]): ReconciliationAlert[] {
  const alerts: ReconciliationAlert[] = [];
  const today = new Date();

  policies.forEach(policy => {
    // Skip cancelled policies
    if (policy.policy_status === 'Cancelled') return;

    // Check for verified policies that might need follow-up
    if (policy.date_policy_verified) {
      const verifiedDate = parseISO(policy.date_policy_verified);
      const daysSinceVerified = Math.floor((today.getTime() - verifiedDate.getTime()) / (1000 * 60 * 60 * 24));

      // Alert if verified more than 30 days ago but policy is still active
      if (daysSinceVerified > 30 && policy.policy_status === 'Active') {
        alerts.push({
          id: `verified_missing_${policy.id}`,
          type: 'verified_missing',
          policy,
          message: `Policy verified ${daysSinceVerified} days ago but may need spreadsheet reconciliation`,
          severity: daysSinceVerified > 60 ? 'high' : 'medium',
          daysOverdue: daysSinceVerified - 30,
          suggestedAction: 'Confirm policy appears on latest commission spreadsheet'
        });
      }
    }

    // Check for policies past expected payment date without verification
    if (!policy.date_policy_verified && policy.created_at) {
      const policyDate = parseISO(policy.created_at);
      const daysSinceCreated = Math.floor((today.getTime() - policyDate.getTime()) / (1000 * 60 * 60 * 24));

      // Alert if policy is more than 45 days old and still unverified
      if (daysSinceCreated > 45 && policy.policy_status === 'Active') {
        alerts.push({
          id: `payment_delay_${policy.id}`,
          type: 'payment_delay',
          policy,
          message: `Policy created ${daysSinceCreated} days ago but never verified`,
          severity: daysSinceCreated > 90 ? 'high' : 'medium',
          daysOverdue: daysSinceCreated - 45,
          suggestedAction: 'Check carrier portal and verify commission status'
        });
      }
    }
  });

  // Sort by severity and days overdue
  return alerts.sort((a, b) => {
    const severityOrder = { high: 3, medium: 2, low: 1 };
    if (severityOrder[a.severity] !== severityOrder[b.severity]) {
      return severityOrder[b.severity] - severityOrder[a.severity];
    }
    return b.daysOverdue - a.daysOverdue;
  });
}

/**
 * Generate reconciliation summary for a specific time period
 */
export function generateReconciliationSummary(policies: Policy[]): {
  totalVerified: number;
  totalUnverified: number;
  verifiedAmount: number;
  unverifiedAmount: number;
  alerts: ReconciliationAlert[];
  recommendations: string[];
} {
  const activePolicies = policies.filter(p => p.policy_status !== 'Cancelled');
  const verifiedPolicies = activePolicies.filter(p => p.date_policy_verified);
  const unverifiedPolicies = activePolicies.filter(p => !p.date_policy_verified);

  const verifiedAmount = verifiedPolicies.reduce((sum, p) => sum + p.commission_due, 0);
  const unverifiedAmount = unverifiedPolicies.reduce((sum, p) => sum + p.commission_due, 0);

  const alerts = findReconciliationIssues(activePolicies);
  
  const recommendations: string[] = [];
  
  if (unverifiedPolicies.length > verifiedPolicies.length) {
    recommendations.push('Consider increasing verification frequency to stay current with commission payments');
  }
  
  if (alerts.filter(a => a.severity === 'high').length > 0) {
    recommendations.push('Prioritize resolving high-severity reconciliation issues immediately');
  }
  
  if (alerts.filter(a => a.type === 'verified_missing').length > 3) {
    recommendations.push('Review commission spreadsheet reconciliation process with your team');
  }

  return {
    totalVerified: verifiedPolicies.length,
    totalUnverified: unverifiedPolicies.length,
    verifiedAmount,
    unverifiedAmount,
    alerts,
    recommendations
  };
}

/**
 * Format alert message for display
 */
export function formatAlertMessage(alert: ReconciliationAlert): string {
  const policyInfo = `${alert.policy.client} (${alert.policy.policy_number})`;
  const amount = `$${alert.policy.commission_due.toFixed(2)}`;
  
  switch (alert.type) {
    case 'verified_missing':
      return `${policyInfo}: Verified ${alert.daysOverdue + 30} days ago (${amount}) - confirm on spreadsheet`;
    case 'payment_delay':
      return `${policyInfo}: ${alert.daysOverdue + 45} days old, unverified (${amount}) - check payment status`;
    default:
      return alert.message;
  }
} 
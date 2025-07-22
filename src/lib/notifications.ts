import { Policy } from "./supabase";
import { parseISO, differenceInDays, startOfDay } from "date-fns";
import { isBankConfirmationDue, getBusinessDaysOverdue, getBankConfirmationText } from "./businessDays";
import { wasContactedToday, getLastContactDate } from "./contactTracking";

export interface PaymentVerificationNotification {
  id: string;
  policyId: number;
  clientName: string;
  firstPaymentDate: string;
  businessDaysOverdue: number;
  priority: 'high' | 'medium' | 'low';
  type: 'payment_verification';
  createdAt: string;
  confirmationText: string;
}

export interface CancellationFollowUpNotification {
  id: string;
  policyId: number;
  clientName: string;
  cancelledDate: string;
  daysSinceCancellation: number;
  followUpDay: number; // 1, 2, or 3
  priority: 'urgent' | 'high';
  type: 'cancellation_followup';
  createdAt: string;
  assignedTo: 'agent' | 'retention_team';
  contactedToday?: boolean;
  lastContactDate?: string;
}

export type AgentNotification = PaymentVerificationNotification | CancellationFollowUpNotification;

// Generate unique notification ID
export function generateNotificationId(policyId: number, type: string): string {
  return `${type}_${policyId}_${Date.now()}`;
}

// Check for policies needing payment verification
export function findPendingPaymentVerifications(policies: Policy[]): PaymentVerificationNotification[] {
  const today = new Date();
  const notifications: PaymentVerificationNotification[] = [];

  policies.forEach(policy => {
    // Only check policies with Pending status and first_payment_date
    if (policy.policy_status !== 'Pending' || !policy.first_payment_date) {
      return;
    }

    const firstPaymentDate = parseISO(policy.first_payment_date);
    
    // Check if bank confirmation period has passed (2+ business days)
    if (isBankConfirmationDue(firstPaymentDate, today)) {
      const businessDaysOverdue = getBusinessDaysOverdue(firstPaymentDate, today);
      const confirmationText = getBankConfirmationText(firstPaymentDate, today);
      
      // Determine priority based on business days overdue
      let priority: 'high' | 'medium' | 'low' = 'medium';
      if (businessDaysOverdue >= 5) priority = 'high';      // 1+ weeks overdue
      else if (businessDaysOverdue >= 2) priority = 'medium'; // 2+ days overdue  
      else priority = 'low';                                  // Just became due

      notifications.push({
        id: generateNotificationId(policy.id, 'payment_verification'),
        policyId: policy.id,
        clientName: policy.client,
        firstPaymentDate: policy.first_payment_date,
        businessDaysOverdue,
        priority,
        type: 'payment_verification',
        createdAt: new Date().toISOString(),
        confirmationText
      });
    }
  });

  return notifications.sort((a, b) => {
    // Sort by priority (high first) then by business days overdue
    const priorityOrder = { high: 3, medium: 2, low: 1 };
    if (priorityOrder[a.priority] !== priorityOrder[b.priority]) {
      return priorityOrder[b.priority] - priorityOrder[a.priority];
    }
    return b.businessDaysOverdue - a.businessDaysOverdue;
  });
}

// Check for cancelled policies needing follow-up
export function findCancellationFollowUps(policies: Policy[], userId?: string): CancellationFollowUpNotification[] {
  const today = startOfDay(new Date());
  const notifications: CancellationFollowUpNotification[] = [];

  policies.forEach(policy => {
    // Only check cancelled policies
    if (policy.policy_status !== 'Cancelled') {
      return;
    }

    // Use cancelled_date if available, otherwise fall back to created_at for existing data
    const cancellationDateStr = policy.cancelled_date || policy.created_at;
    const cancelledDate = startOfDay(parseISO(cancellationDateStr));
    const daysSinceCancellation = differenceInDays(today, cancelledDate);

    // If using created_at as fallback, only process recent policies (within 7 days)
    // If using actual cancelled_date, process normally
    if (!policy.cancelled_date && daysSinceCancellation > 7) {
      return;
    }

    // Only show notifications for first 3 business days
    if (daysSinceCancellation >= 1 && daysSinceCancellation <= 3) {
      const followUpDay = daysSinceCancellation;
      
      // Check contact tracking if userId is provided
      const contactedToday = userId ? wasContactedToday(policy.id, userId) : false;
      const lastContactDate = userId ? getLastContactDate(policy.id, userId) : null;
      
      notifications.push({
        id: generateNotificationId(policy.id, 'cancellation_followup'),
        policyId: policy.id,
        clientName: policy.client,
        cancelledDate: cancelledDate.toISOString(),
        daysSinceCancellation,
        followUpDay,
        priority: followUpDay === 1 ? 'urgent' : 'high',
        type: 'cancellation_followup',
        createdAt: new Date().toISOString(),
        assignedTo: 'agent',
        contactedToday,
        lastContactDate: lastContactDate || undefined
      });
    }
  });

  return notifications.sort((a, b) => {
    // Sort by follow-up day (day 1 first)
    return a.followUpDay - b.followUpDay;
  });
}

// Get all notifications for an agent
export function getAgentNotifications(policies: Policy[], userId?: string): AgentNotification[] {
  const paymentVerifications = findPendingPaymentVerifications(policies);
  const cancellationFollowUps = findCancellationFollowUps(policies, userId);
  
  return [...cancellationFollowUps, ...paymentVerifications];
}

// Format notification message
export function formatNotificationMessage(notification: AgentNotification): string {
  if (notification.type === 'payment_verification') {
    return `Bank confirmation needed for ${notification.clientName} - ${notification.confirmationText}`;
  }
  
  if (notification.type === 'cancellation_followup') {
    return `Follow-up needed for ${notification.clientName} - Day ${notification.followUpDay} of cancellation retention (you have ${4 - notification.followUpDay} days remaining)`;
  }
  
  return '';
}

// Get notification icon/color based on priority
export function getNotificationStyle(notification: AgentNotification): {
  icon: string;
  color: string;
  bgColor: string;
} {
  if (notification.type === 'cancellation_followup') {
    return {
      icon: '🚨',
      color: 'text-red-700',
      bgColor: 'bg-red-50 border-red-200'
    };
  }
  
  switch (notification.priority) {
    case 'high':
      return {
        icon: '⚠️',
        color: 'text-orange-700',
        bgColor: 'bg-orange-50 border-orange-200'
      };
    case 'medium':
      return {
        icon: '⏰',
        color: 'text-yellow-700',
        bgColor: 'bg-yellow-50 border-yellow-200'
      };
    default:
      return {
        icon: '💡',
        color: 'text-blue-700',
        bgColor: 'bg-blue-50 border-blue-200'
      };
  }
}

// Get action buttons for notification
export function getNotificationActions(notification: AgentNotification): Array<{
  label: string;
  action: string;
  variant: 'primary' | 'secondary' | 'danger';
}> {
  if (notification.type === 'payment_verification') {
    return [
      { label: 'Mark Active', action: 'mark_active', variant: 'primary' },
      { label: 'Mark Cancelled', action: 'mark_cancelled', variant: 'danger' },
      { label: 'View Policy', action: 'view_policy', variant: 'secondary' }
    ];
  }
  
  if (notification.type === 'cancellation_followup') {
    const actions = [];
    
    // Change button text if already contacted today
    if (notification.contactedToday) {
      actions.push({ label: '✅ Called Today', action: 'logged_contact', variant: 'secondary' as const });
    } else {
      actions.push({ label: 'Call Client', action: 'logged_contact', variant: 'primary' as const });
    }
    
    actions.push({ label: 'Reactivated', action: 'reactivated', variant: 'primary' as const });
    actions.push({ label: 'View Policy', action: 'view_policy', variant: 'secondary' as const });
    
    return actions;
  }
  
  return [];
}

// Check if notifications should be shown (business rules)
export function shouldShowNotification(): boolean {
  const now = new Date();
  const currentHour = now.getHours();
  
  // Only show notifications during business hours (8 AM - 6 PM)
  if (currentHour < 8 || currentHour > 18) {
    return false;
  }
  
  // For weekend handling, you might want to suppress notifications
  const dayOfWeek = now.getDay();
  if (dayOfWeek === 0 || dayOfWeek === 6) {
    return false; // No notifications on weekends
  }
  
  return true;
}

// Summary statistics for dashboard
export function getNotificationSummary(notifications: AgentNotification[]): {
  total: number;
  paymentVerifications: number;
  cancellationFollowUps: number;
  urgent: number;
  high: number;
  medium: number;
  low: number;
} {
  const summary = {
    total: notifications.length,
    paymentVerifications: 0,
    cancellationFollowUps: 0,
    urgent: 0,
    high: 0,
    medium: 0,
    low: 0
  };
  
  notifications.forEach(notification => {
    if (notification.type === 'payment_verification') {
      summary.paymentVerifications++;
    } else if (notification.type === 'cancellation_followup') {
      summary.cancellationFollowUps++;
    }
    
    switch (notification.priority) {
      case 'urgent':
        summary.urgent++;
        break;
      case 'high':
        summary.high++;
        break;
      case 'medium':
        summary.medium++;
        break;
      case 'low':
        summary.low++;
        break;
    }
  });
  
  return summary;
} 
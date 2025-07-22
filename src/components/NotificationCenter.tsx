"use client";

import { useState, useEffect, useCallback } from "react";
import { useUser } from "@clerk/nextjs";
import { supabase } from "@/lib/supabase";
import {
  getAgentNotifications,
  formatNotificationMessage,
  getNotificationStyle,
  getNotificationActions,
  getNotificationSummary,
  AgentNotification,
} from "@/lib/notifications";
import { logContactAttempt } from "@/lib/contactTracking";
import { format, parseISO } from "date-fns";

interface NotificationCenterProps {
  onPolicyUpdate?: () => void;
  onViewPolicy?: (policyId: number) => void;
}

export default function NotificationCenter({ onPolicyUpdate, onViewPolicy }: NotificationCenterProps) {
  const [notifications, setNotifications] = useState<AgentNotification[]>([]);

  const [loading, setLoading] = useState(true);
  const [isExpanded, setIsExpanded] = useState(false);
  const [processingAction, setProcessingAction] = useState<string | null>(null);
  const { user } = useUser();

  const fetchPoliciesAndNotifications = useCallback(async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from("policies")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (error) throw error;

      const policiesData = data || [];

      
      // Generate notifications with user ID for contact tracking
      const agentNotifications = getAgentNotifications(policiesData, user.id);
      setNotifications(agentNotifications);
    } catch (err) {
      console.error("Error fetching policies and notifications:", err);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (user) {
      fetchPoliciesAndNotifications();
    }
  }, [user, fetchPoliciesAndNotifications]);

  const handleNotificationAction = async (
    notification: AgentNotification,
    action: string
  ) => {
    if (!user) return;

    console.log(`Processing action: ${action} for notification:`, notification);
    setProcessingAction(notification.id);

    try {
      if (action === 'mark_active' && notification.type === 'payment_verification') {
        // Update policy status to Active
        const { error } = await supabase
          .from("policies")
          .update({ 
            policy_status: 'Active',
            date_commission_paid: null // Clear this since it's now verified as active
          })
          .eq("id", notification.policyId)
          .eq("user_id", user.id);

        if (error) throw error;

        // Refresh notifications
        await fetchPoliciesAndNotifications();
        onPolicyUpdate?.();
        
      } else if (action === 'mark_cancelled' && notification.type === 'payment_verification') {
        // Update policy status to Cancelled (temporarily without cancelled_date until migration is run)
        const { error } = await supabase
          .from("policies")
          .update({ 
            policy_status: 'Cancelled'
            // cancelled_date: new Date().toISOString() // Commented out until migration runs
          })
          .eq("id", notification.policyId)
          .eq("user_id", user.id);

        if (error) throw error;

        // Refresh notifications
        await fetchPoliciesAndNotifications();
        onPolicyUpdate?.();
        
      } else if (action === 'reactivated' && notification.type === 'cancellation_followup') {
        // Reactivate cancelled policy (temporarily without cancelled_date until migration is run)
        const { error } = await supabase
          .from("policies")
          .update({ 
            policy_status: 'Active'
            // cancelled_date: null // Commented out until migration runs
          })
          .eq("id", notification.policyId)
          .eq("user_id", user.id);

        if (error) throw error;

        // Refresh notifications
        await fetchPoliciesAndNotifications();
        onPolicyUpdate?.();
        
      } else if (action === 'logged_contact') {
        // Log the contact attempt and refresh notifications
        logContactAttempt(notification.policyId, user.id);
        await fetchPoliciesAndNotifications(); // Refresh to show updated contact status
        
      } else if (action === 'view_policy') {
        // Use the provided callback to view policy
        if (onViewPolicy) {
          onViewPolicy(notification.policyId);
        } else {
          console.log(`Viewing policy ${notification.policyId}`);
        }
      }
    } catch (err) {
      console.error("Error handling notification action:", err);
    } finally {
      setProcessingAction(null);
    }
  };

  const summary = getNotificationSummary(notifications);

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow-sm border p-4">
        <div className="animate-pulse">
          <div className="h-4 bg-gray-200 rounded w-1/4 mb-2"></div>
          <div className="h-3 bg-gray-200 rounded w-1/2"></div>
        </div>
      </div>
    );
  }

  if (notifications.length === 0) {
    return (
      <div className="bg-green-50 border border-green-200 rounded-lg p-4">
        <div className="flex items-center">
          <div className="text-green-600 mr-3">✅</div>
          <div>
            <h3 className="text-sm font-medium text-green-800">All Caught Up!</h3>
            <p className="text-xs text-green-700 mt-1">
              No pending payment verifications or follow-ups needed.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border">
      {/* Header */}
      <div 
        className="p-4 border-b cursor-pointer hover:bg-gray-50"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <div className="text-red-600 mr-3">🔔</div>
            <div>
              <h3 className="text-sm font-semibold text-gray-900">
                Action Required ({summary.total})
              </h3>
              <p className="text-xs text-gray-600">
                {summary.paymentVerifications} payment verifications, {summary.cancellationFollowUps} follow-ups
              </p>
            </div>
          </div>
          <div className="flex items-center">
            {summary.urgent > 0 && (
              <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800 mr-2">
                {summary.urgent} urgent
              </span>
            )}
            <svg 
              className={`w-5 h-5 text-gray-500 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
              fill="none" 
              viewBox="0 0 24 24" 
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </div>
        </div>
      </div>

      {/* Notifications List */}
      {isExpanded && (
        <div className="max-h-96 overflow-y-auto">
          {notifications.map((notification) => {
            const style = getNotificationStyle(notification);
            const actions = getNotificationActions(notification);
            const message = formatNotificationMessage(notification);

            return (
              <div 
                key={notification.id} 
                className={`p-4 border-b last:border-b-0 ${style.bgColor} border-l-4`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center mb-2">
                      <span className="text-lg mr-2">{style.icon}</span>
                      <p className={`text-sm font-medium ${style.color}`}>
                        {message}
                      </p>
                    </div>
                    
                    <div className="text-xs text-gray-600 mb-3">
                      {notification.type === 'payment_verification' && (
                        <span>
                          First payment: {format(parseISO(notification.firstPaymentDate), 'MMM d, yyyy')} • 
                          {notification.businessDaysOverdue} business days overdue
                        </span>
                      )}
                      {notification.type === 'cancellation_followup' && (
                        <span>
                          Cancelled: {format(parseISO(notification.cancelledDate), 'MMM d, yyyy')} 
                          • Day {notification.followUpDay} of 3
                          {notification.contactedToday && (
                            <span className="text-green-600 font-medium"> • ✅ Contacted today</span>
                          )}
                          {notification.lastContactDate && !notification.contactedToday && (
                            <span className="text-blue-600"> • Last contact: {notification.lastContactDate}</span>
                          )}
                        </span>
                      )}
                    </div>

                    <div className="flex flex-wrap gap-2">
                      {actions.map((action) => (
                        <button
                          key={action.action}
                          onClick={() => handleNotificationAction(notification, action.action)}
                          disabled={processingAction === notification.id}
                          className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                            action.variant === 'primary'
                              ? 'bg-blue-600 text-white hover:bg-blue-700 disabled:bg-blue-400'
                              : action.variant === 'danger'
                              ? 'bg-red-600 text-white hover:bg-red-700 disabled:bg-red-400'
                              : 'bg-gray-200 text-gray-700 hover:bg-gray-300 disabled:bg-gray-100'
                          }`}
                        >
                          {processingAction === notification.id ? '...' : action.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Quick Stats Footer */}
      {isExpanded && (
        <div className="p-3 bg-gray-50 border-t">
          <div className="flex justify-between text-xs text-gray-600">
            <span>Business hours: 8 AM - 6 PM</span>
            <span>Updates every 5 minutes</span>
          </div>
        </div>
      )}
    </div>
  );
} 
"use client";

import { useState, useEffect } from "react";
import { format, parseISO, isEqual, subDays } from "date-fns";
import { getUpcomingPaymentPeriods } from "@/lib/commissionCalendar";

interface ReconciliationReminderProps {
  onStartReconciliation?: () => void;
}

export default function ReconciliationReminder({ onStartReconciliation }: ReconciliationReminderProps) {
  const [showReminder, setShowReminder] = useState(false);
  const [nextPaymentDate, setNextPaymentDate] = useState<string | null>(null);
  const [daysUntilPayment, setDaysUntilPayment] = useState<number>(0);

  useEffect(() => {
    const checkReconciliationDeadline = () => {
      const today = new Date();
      const upcomingPayments = getUpcomingPaymentPeriods();
      
      if (upcomingPayments.length === 0) return;

      const nextPayment = upcomingPayments[0];
      const paymentDate = parseISO(nextPayment.date);
      const reconciliationStart = subDays(paymentDate, 2); // Wednesday (2 days before Friday)
      const reconciliationEnd = subDays(paymentDate, 1);   // Thursday (1 day before Friday)

      // Check if today is Wednesday or Thursday before payment
      const isReconciliationPeriod = (
        isEqual(today.toDateString(), reconciliationStart.toDateString()) ||
        isEqual(today.toDateString(), reconciliationEnd.toDateString())
      );

      if (isReconciliationPeriod) {
        setShowReminder(true);
        setNextPaymentDate(nextPayment.date);
        setDaysUntilPayment(Math.ceil((paymentDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)));
      }
    };

    checkReconciliationDeadline();
  }, []);

  const handleDismiss = () => {
    setShowReminder(false);
    // Store dismissal in localStorage to avoid showing again today
    localStorage.setItem(`reconciliation-dismissed-${new Date().toDateString()}`, 'true');
  };

  const handleStartReconciliation = () => {
    setShowReminder(false);
    if (onStartReconciliation) {
      onStartReconciliation();
    }
  };

  // Check if already dismissed today
  useEffect(() => {
    const dismissed = localStorage.getItem(`reconciliation-dismissed-${new Date().toDateString()}`);
    if (dismissed) {
      setShowReminder(false);
    }
  }, []);

  if (!showReminder || !nextPaymentDate) return null;

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
        {/* Modal */}
        <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full mx-4 relative overflow-hidden">
          {/* Animated money background */}
          <div className="absolute inset-0 opacity-10">
            <div className="absolute top-4 left-4 text-6xl animate-bounce">💰</div>
            <div className="absolute top-8 right-8 text-4xl animate-pulse">💵</div>
            <div className="absolute bottom-6 left-8 text-5xl animate-bounce delay-300">🤑</div>
            <div className="absolute bottom-4 right-4 text-3xl animate-pulse delay-500">💳</div>
          </div>

          {/* Content */}
          <div className="relative p-6 text-center">
            {/* Header with money animation */}
            <div className="mb-4">
              <div className="text-6xl mb-2 animate-bounce">
                💰
              </div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">
                Commission Reconciliation Time!
              </h2>
              <div className="flex items-center justify-center gap-2 text-lg">
                <span>📊</span>
                <span className="font-semibold text-blue-600">
                  {daysUntilPayment === 1 ? 'Tomorrow' : `${daysUntilPayment} days`} until payday!
                </span>
              </div>
            </div>

            {/* Message */}
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
              <div className="flex items-start gap-3">
                <div className="text-2xl">⏰</div>
                <div className="text-left">
                  <h3 className="font-semibold text-yellow-800 mb-1">
                    Time to Reconcile Your Commissions
                  </h3>
                  <p className="text-sm text-yellow-700">
                    Payment date: <strong>{format(parseISO(nextPaymentDate), 'EEEE, MMMM do, yyyy')}</strong>
                  </p>
                  <p className="text-sm text-yellow-700 mt-1">
                    Review your commission spreadsheet and verify all policies before payment processing.
                  </p>
                </div>
              </div>
            </div>

            {/* Action buttons */}
            <div className="flex gap-3">
              <button
                onClick={handleDismiss}
                className="flex-1 px-4 py-3 text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg font-medium transition-colors"
              >
                Remind Me Later
              </button>
              <button
                onClick={handleStartReconciliation}
                className="flex-1 px-4 py-3 bg-gradient-to-r from-green-500 to-blue-600 text-white rounded-lg font-medium hover:from-green-600 hover:to-blue-700 transition-all transform hover:scale-105 shadow-lg"
              >
                🚀 Start Reconciliation
              </button>
            </div>

            {/* Footer tip */}
            <div className="mt-4 text-xs text-gray-500">
              💡 Complete reconciliation early to ensure accurate payments
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
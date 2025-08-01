"use client";

import { useState, useEffect } from "react";
import { parseISO, subDays } from "date-fns";
import { getUpcomingPaymentPeriods } from "@/lib/commissionCalendar";

interface ReconciliationBadgeProps {
  onClick?: () => void;
}

export default function ReconciliationBadge({ onClick }: ReconciliationBadgeProps) {
  const [showBadge, setShowBadge] = useState(false);
  const [isReconciliationPeriod, setIsReconciliationPeriod] = useState(false);

  useEffect(() => {
    const checkReconciliationStatus = () => {
      const today = new Date();
      const upcomingPayments = getUpcomingPaymentPeriods();
      
      if (upcomingPayments.length === 0) return;

      const nextPayment = upcomingPayments[0];
      const paymentDate = parseISO(nextPayment.date);
      // Commission sheets come out 9 days before payment (e.g., July 30 for Aug 8 payment)
      const reconciliationStart = subDays(paymentDate, 9);
      const reconciliationEnd = subDays(paymentDate, 1);   // Day before payment

      // Check if today is in the reconciliation period (9 days before to 1 day before payment)
      const isReconciliationTime = (
        (today >= reconciliationStart && today <= reconciliationEnd)
      );

      // Check if reconciliation has already been completed for this payment period
      const completionKey = `reconciliation-completed-${nextPayment.date}`;
      const isCompleted = localStorage.getItem(completionKey);

      const shouldShow = isReconciliationTime && !isCompleted;
      
      setIsReconciliationPeriod(isReconciliationTime);
      setShowBadge(shouldShow);
    };

    checkReconciliationStatus();
    
    // Check every hour
    const interval = setInterval(checkReconciliationStatus, 60 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  if (!showBadge || !isReconciliationPeriod) return null;

  return (
    <div 
      className="fixed bottom-6 right-6 z-40 cursor-pointer transform hover:scale-110 transition-all duration-300"
      onClick={onClick}
    >
      {/* Pulsing background */}
      <div className="absolute inset-0 bg-gradient-to-r from-yellow-400 to-orange-500 rounded-full animate-ping opacity-75"></div>
      
      {/* Main badge */}
      <div className="relative bg-gradient-to-r from-yellow-400 to-orange-500 text-white rounded-full p-4 shadow-2xl">
        <div className="flex items-center gap-2">
          <div className="text-2xl animate-bounce">💰</div>
          <div className="text-sm font-bold">
            <div>Reconcile</div>
            <div>Commissions!</div>
          </div>
        </div>
      </div>

      {/* Tooltip */}
      <div className="absolute bottom-full right-0 mb-2 hidden group-hover:block">
        <div className="bg-gray-900 text-white text-xs rounded-lg px-3 py-2 whitespace-nowrap">
          Click to start commission reconciliation
          <div className="absolute top-full right-4 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-gray-900"></div>
        </div>
      </div>
    </div>
  );
}
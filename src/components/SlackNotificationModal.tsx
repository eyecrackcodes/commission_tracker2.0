"use client";

import { useState } from "react";
import { getBestUserName, getUserEmail } from "@/lib/userUtils";
import { useUser } from "@clerk/nextjs";

interface PolicyData {
  client: string;
  carrier: string;
  policy_number: string;
  product: string;
  policy_status: string;
  commissionable_annual_premium: number;
  commission_rate: number;
  first_payment_date: string;
  type_of_payment: string;
  inforce_date: string;
  comments: string;
}

interface SlackNotificationModalProps {
  policyData: PolicyData | null;
  onClose: () => void;
}

export default function SlackNotificationModal({ policyData, onClose }: SlackNotificationModalProps) {
  const [slackAcronym, setSlackAcronym] = useState("OCC");
  const [slackLoading, setSlackLoading] = useState(false);
  const { user } = useUser();

  if (!policyData || !user) return null;

  const sendSlackNotification = async (type: 'full' | 'quick', acronym?: string) => {
    setSlackLoading(true);
    try {
      const payload = {
        type: type === 'full' ? 'policy_notification' : 'quick_post',
        data: type === 'full' ? {
          carrier: policyData.carrier,
          product: policyData.product,
          premium: policyData.commissionable_annual_premium,
          userEmail: getUserEmail(user),
          userName: getBestUserName(user)
        } : {
          carrier: policyData.carrier,
          product: policyData.product,
          premium: policyData.commissionable_annual_premium,
          acronym: acronym || slackAcronym,
          userName: getBestUserName(user)
        }
      };

      const response = await fetch('/api/slack-notification', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (response.ok) {
        console.log('Slack notification sent successfully');
        onClose();
      } else {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        console.error('Failed to send Slack notification:', errorData);
        
        if (response.status === 500) {
          alert('⚠️ Slack notification failed!\n\nThis is likely because Slack environment variables are not configured yet.\n\nTo fix this:\n1. Set up your Slack bot token\n2. Configure the channel ID\n3. Add them to your .env.local file\n\nSee README.md for setup instructions.');
        } else {
          alert('Failed to send Slack notification. Please try again.');
        }
      }
    } catch (error) {
      console.error('Error sending Slack notification:', error);
      alert('Network error while sending Slack notification. Please check your connection and try again.');
    } finally {
      setSlackLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md">
        <div className="bg-gradient-to-r from-green-600 to-green-700 px-6 py-4">
          <h2 className="text-xl font-bold text-white">🎉 Policy Added Successfully!</h2>
          <p className="text-green-100 mt-1">
            Share this sale on Slack?
          </p>
        </div>

        <div className="p-6">
          <div className="mb-4 p-4 bg-gray-50 rounded-lg">
            <p className="text-sm text-gray-600 mb-2">Policy Details:</p>
            <p className="font-semibold">{policyData.carrier} | {policyData.product}</p>
            <p className="text-lg font-bold text-green-600">
              {new Intl.NumberFormat('en-US', {
                style: 'currency',
                currency: 'USD',
                minimumFractionDigits: 2,
              }).format(policyData.commissionable_annual_premium)}
            </p>
          </div>

          <div className="space-y-3">
            <div className="flex items-center space-x-2">
              <input
                type="text"
                value={slackAcronym}
                onChange={(e) => setSlackAcronym(e.target.value)}
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                placeholder="Enter acronym (e.g., OCC)"
              />
              <button
                onClick={() => sendSlackNotification('quick', slackAcronym)}
                disabled={slackLoading}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {slackLoading ? 'Sending...' : '⚡ Quick Post'}
              </button>
            </div>

            <button
              onClick={onClose}
              className="w-full px-4 py-2 text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors font-medium"
            >
              Skip Slack Notification
            </button>
          </div>
        </div>
      </div>
    </div>
  );
} 
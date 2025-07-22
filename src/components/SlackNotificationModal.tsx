"use client";

import { useState } from "react";
import Image from "next/image";
import { getBestUserName } from "@/lib/userUtils";
import { useUser } from "@clerk/nextjs";

interface PolicyData {
  client: string;
  carrier: string;
  policy_number: string;
  product: string;
  policy_status: string;
  commissionable_annual_premium: number;
  commission_rate: number;
  first_payment_date?: string;
  type_of_payment?: string;
  inforce_date?: string;
  comments?: string;
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

  const sendSlackNotification = async (acronym?: string) => {
    setSlackLoading(true);
    try {
      const payload = {
        type: 'quick_post',
        data: {
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
            Share this sale on Slack with a quick post?
          </p>
        </div>

        <div className="p-6">
          <div className="mb-4 p-4 bg-gray-50 rounded-lg">
            <div className="flex items-start justify-between">
              <div>
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
              {user.imageUrl && (
                <Image 
                  src={user.imageUrl} 
                  alt={getBestUserName(user)}
                  width={48}
                  height={48}
                  className="w-12 h-12 rounded-full"
                />
              )}
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Custom Acronym (optional)
              </label>
              <input
                type="text"
                value={slackAcronym}
                onChange={(e) => setSlackAcronym(e.target.value)}
                className="w-full px-3 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 text-center font-medium"
                placeholder="Enter acronym (e.g., OCC, WIN, SALE)"
              />
              <p className="text-xs text-gray-500 mt-1 text-center">
                Will post: &ldquo;{slackAcronym || 'SALE'} - {policyData.carrier} | {policyData.product} | ${policyData.commissionable_annual_premium.toLocaleString()}&rdquo;
              </p>
            </div>

            <div className="flex space-x-3">
              <button
                onClick={() => sendSlackNotification(slackAcronym)}
                disabled={slackLoading}
                className="flex-1 px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {slackLoading ? 'Posting...' : '⚡ Post to Slack'}
              </button>
              
              <button
                onClick={onClose}
                className="flex-1 px-4 py-3 text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors font-medium"
              >
                Skip
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
} 
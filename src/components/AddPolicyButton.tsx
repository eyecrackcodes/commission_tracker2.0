"use client";

import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { supabase } from "@/lib/supabase";
import { useUser } from "@clerk/nextjs";
import confetti from "canvas-confetti";
import { calculateCommissionRate } from "@/lib/commission";
import { sendPolicyNotification } from "@/lib/slack";

interface PolicyFormData {
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

interface AddPolicyButtonProps {
  onPolicyAdded?: () => void;
}

export default function AddPolicyButton({
  onPolicyAdded,
}: AddPolicyButtonProps) {
  const [showModal, setShowModal] = useState(false);
  const [agentProfile, setAgentProfile] = useState<{
    start_date: string | null;
  } | null>(null);
  const { register, handleSubmit, reset, setValue } = useForm<PolicyFormData>();
  const { user } = useUser();

  useEffect(() => {
    async function fetchAgentProfile() {
      if (!user) return;

      try {
        const { data, error } = await supabase
          .from("agent_profiles")
          .select("start_date")
          .eq("user_id", user.id)
          .single();

        if (error) throw error;
        setAgentProfile(data);
      } catch (err) {
        console.error("Error fetching agent profile:", err);
      }
    }

    fetchAgentProfile();
  }, [user]);

  const triggerConfetti = () => {
    console.log("Triggering confetti effect");

    // Fire confetti from the left edge
    confetti({
      particleCount: 100,
      spread: 70,
      origin: { x: 0, y: 0.6 },
    });

    // Fire confetti from the right edge
    confetti({
      particleCount: 100,
      spread: 70,
      origin: { x: 1, y: 0.6 },
    });

    // Fire confetti from the center
    confetti({
      particleCount: 100,
      spread: 70,
      origin: { x: 0.5, y: 0.6 },
    });
  };

  const onSubmit = async (data: PolicyFormData) => {
    if (!user) return;

    try {
      console.log("Submitting policy data:", data);

      // Calculate commission rate based on tenure
      const commissionRate = calculateCommissionRate(
        agentProfile?.start_date || null
      );

      const { error } = await supabase.from("policies").insert([
        {
          ...data,
          user_id: user.id,
          commission_rate: commissionRate,
          created_at: new Date().toISOString(),
        },
      ]);

      if (error) {
        console.error("Supabase error:", error);
        throw error;
      }

      // Send Slack notification
      await sendPolicyNotification({
        client: data.client,
        carrier: data.carrier,
        policy_number: data.policy_number,
        commissionable_annual_premium: data.commissionable_annual_premium,
        commission_rate: commissionRate,
      });

      console.log("Policy added successfully, showing confetti");
      setShowModal(false);
      reset();

      // Trigger confetti after a short delay to ensure the modal is closed
      setTimeout(() => {
        console.log("Triggering confetti");
        triggerConfetti();
      }, 100);

      if (onPolicyAdded) {
        onPolicyAdded();
      }
    } catch (err) {
      console.error("Error adding policy:", err);
    }
  };

  return (
    <>
      <button
        onClick={() => setShowModal(true)}
        className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
      >
        <svg
          className="h-4 w-4 mr-2"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 6v6m0 0v6m0-6h6m-6 0H6"
          />
        </svg>
        Add Policy
      </button>

      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-8 rounded-lg w-full max-w-2xl">
            <h2 className="text-2xl font-bold mb-4">Add New Policy</h2>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Client
                  </label>
                  <input
                    {...register("client", { required: true })}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Carrier
                  </label>
                  <input
                    {...register("carrier", { required: true })}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Policy Number
                  </label>
                  <input
                    {...register("policy_number", { required: true })}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Product
                  </label>
                  <input
                    {...register("product", { required: true })}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Policy Status
                  </label>
                  <select
                    {...register("policy_status", { required: true })}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  >
                    <option value="Pending">Pending</option>
                    <option value="Active">Active</option>
                    <option value="Cancelled">Cancelled</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Commission Rate
                  </label>
                  <select
                    {...register("commission_rate", { required: true })}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  >
                    <option value="5">5%</option>
                    <option value="20">20%</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Commissionable Annual Premium
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    {...register("commissionable_annual_premium", {
                      required: true,
                      min: 0,
                    })}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    First Payment Date
                  </label>
                  <input
                    type="date"
                    {...register("first_payment_date")}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Type of Payment
                  </label>
                  <input
                    {...register("type_of_payment")}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Inforce Date
                  </label>
                  <input
                    type="date"
                    {...register("inforce_date")}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Comments
                </label>
                <textarea
                  {...register("comments")}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  rows={3}
                />
              </div>
              <div className="flex justify-end space-x-4">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="bg-gray-200 text-gray-800 px-4 py-2 rounded-md hover:bg-gray-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700"
                >
                  Add Policy
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}

"use client";

import React, { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { supabase } from "@/lib/supabase";
import { useUser } from "@clerk/nextjs";
import confetti from "canvas-confetti";
import { calculateCommissionRate } from "@/lib/commission";
import { getCarrierOptions, getProductOptions } from "@/lib/carriers";

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
  created_at: string;
}

interface AddPolicyButtonProps {
  onPolicyAdded?: (policyData?: PolicyFormData) => void;
}

interface AgentProfile {
  start_date: string | null;
}

interface ConfettiOptions {
  origin: { y: number; x?: number };
  zIndex?: number;
  particleCount?: number;
  spread?: number;
  startVelocity?: number;
  decay?: number;
  scalar?: number;
}

export default function AddPolicyButton({
  onPolicyAdded,
}: AddPolicyButtonProps) {
  const [showModal, setShowModal] = useState(false);
  const [agentProfile, setAgentProfile] = useState<AgentProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedCarrier, setSelectedCarrier] = useState("");
  const [productOptions, setProductOptions] = useState<string[]>([]);
  const { register, handleSubmit, reset, watch, setValue } = useForm<PolicyFormData>();
  const { user } = useUser();

  // Watch carrier changes
  const carrierValue = watch("carrier");

  useEffect(() => {
    if (carrierValue) {
      setSelectedCarrier(carrierValue);
      const products = getProductOptions(carrierValue);
      setProductOptions(products);
      // Reset product selection when carrier changes
      setValue("product", "");
    }
  }, [carrierValue, setValue]);

  useEffect(() => {
    const fetchAgentProfile = async () => {
      if (!user) {
        setIsLoading(false);
        return;
      }

      try {
        console.log("Fetching agent profile for user:", user.id);
        const response = await fetch("/api/agent-profile");

        if (!response.ok) {
          const errorData = await response.json();
          console.error("Error fetching agent profile:", errorData);
          // Even if there's an error, we'll set a default profile to allow policy creation
          setAgentProfile({ start_date: new Date().toISOString().split('T')[0] });
          setIsLoading(false);
          return;
        }

        const data = await response.json();
        console.log("Received agent profile:", data);

        if (data) {
          setAgentProfile({
            start_date: data.start_date || new Date().toISOString().split('T')[0],
          });
        } else {
          console.log("No agent profile data received, using default");
          setAgentProfile({ start_date: new Date().toISOString().split('T')[0] });
        }
      } catch (err) {
        console.error("Error in fetchAgentProfile:", err);
        // Even if there's an error, we'll set a default profile to allow policy creation
        setAgentProfile({ start_date: new Date().toISOString().split('T')[0] });
      } finally {
        setIsLoading(false);
      }
    };

    fetchAgentProfile();
  }, [user]);

  const triggerConfetti = () => {
    const count = 200;
    const defaults: ConfettiOptions = {
      origin: { y: 0.7 },
      zIndex: 999,
    };

    function fire(particleRatio: number, opts: Partial<ConfettiOptions>) {
      confetti({
        ...defaults,
        ...opts,
        particleCount: Math.floor(count * particleRatio),
      });
    }

    fire(0.25, {
      spread: 26,
      startVelocity: 55,
      origin: { x: 0.2, y: 0.7 },
    });

    fire(0.2, {
      spread: 60,
      origin: { x: 0.5, y: 0.7 },
    });

    fire(0.35, {
      spread: 100,
      decay: 0.91,
      scalar: 0.8,
      origin: { x: 0.8, y: 0.7 },
    });

    fire(0.1, {
      spread: 120,
      startVelocity: 25,
      decay: 0.92,
      scalar: 1.2,
      origin: { x: 0.5, y: 0.7 },
    });

    fire(0.1, {
      spread: 120,
      startVelocity: 45,
      origin: { x: 0.5, y: 0.7 },
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
          created_at: data.created_at || new Date().toISOString(),
        },
      ]);

      if (error) {
        console.error("Supabase error:", error);
        throw error;
      }

      console.log("Policy added successfully");
      setShowModal(false);
      reset();
      setSelectedCarrier("");
      setProductOptions([]);
      triggerConfetti();

      if (onPolicyAdded) {
        onPolicyAdded(data);
      }
    } catch (err) {
      console.error("Error adding policy:", err);
    }
  };

  const handleClose = () => {
    setShowModal(false);
    reset();
    setSelectedCarrier("");
    setProductOptions([]);
  };

  return (
    <>
      <button
        onClick={() => setShowModal(true)}
        disabled={isLoading}
        className={`inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white ${
          isLoading ? 'bg-gray-400' : 'bg-blue-600 hover:bg-blue-700'
        } focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500`}
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
        {isLoading ? 'Loading...' : 'Add Policy'}
      </button>

      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden">
            {/* Header */}
            <div className="bg-gradient-to-r from-blue-600 to-blue-700 px-8 py-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <div className="bg-white/20 rounded-lg p-3 mr-4">
                    <svg
                      className="h-6 w-6 text-white"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                      />
                    </svg>
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold text-white">Add New Policy</h2>
                    <p className="text-blue-100 text-sm mt-1">Fill in the details below to create a new policy</p>
                  </div>
                </div>
                <button
                  onClick={handleClose}
                  className="text-white/80 hover:text-white transition-colors"
                >
                  <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
            
            {/* Form Content */}
            <div className="p-8 overflow-y-auto max-h-[calc(90vh-180px)]">
              <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
                {/* Policy Date Section */}
                <div className="bg-blue-50 rounded-lg p-6 border-l-4 border-blue-500">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                    <svg className="h-5 w-5 mr-2 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    Policy Date
                  </h3>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Policy Entry Date
                      <span className="text-gray-500 text-xs ml-2">(When this policy was created - defaults to today)</span>
                    </label>
                    <input
                      type="date"
                      {...register("created_at")}
                      defaultValue={new Date().toISOString().split('T')[0]}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                    />
                  </div>
                </div>

                {/* Client Information Section */}
                <div className="bg-gray-50 rounded-lg p-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                    <svg className="h-5 w-5 mr-2 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                    Client Information
                  </h3>
                  <div className="grid grid-cols-1 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Client Name
                      </label>
                      <input
                        {...register("client", { required: true })}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                        placeholder="Enter client name"
                      />
                    </div>
                  </div>
                </div>

                {/* Policy Details Section */}
                <div className="bg-gray-50 rounded-lg p-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                    <svg className="h-5 w-5 mr-2 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    Policy Details
                  </h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Carrier
                      </label>
                      <select
                        {...register("carrier", { required: true })}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                      >
                        <option value="">Select a carrier</option>
                        {getCarrierOptions().map((carrier) => (
                          <option key={carrier} value={carrier}>
                            {carrier}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Product
                      </label>
                      <select
                        {...register("product", { required: true })}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors disabled:bg-gray-100 disabled:cursor-not-allowed"
                        disabled={!selectedCarrier}
                      >
                        <option value="">
                          {selectedCarrier ? "Select a product" : "Select carrier first"}
                        </option>
                        {productOptions.map((product) => (
                          <option key={product} value={product}>
                            {product}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Policy Number
                      </label>
                      <input
                        {...register("policy_number", { required: true })}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                        placeholder="Enter policy number"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Policy Status
                      </label>
                      <select
                        {...register("policy_status", { required: true })}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                      >
                        <option value="Pending">Pending</option>
                        <option value="Active">Active</option>
                        <option value="Cancelled">Cancelled</option>
                      </select>
                    </div>
                  </div>
                </div>

                {/* Financial Information Section */}
                <div className="bg-gray-50 rounded-lg p-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                    <svg className="h-5 w-5 mr-2 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    Financial Information
                  </h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Annual Premium
                      </label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">$</span>
                        <input
                          type="number"
                          step="0.01"
                          {...register("commissionable_annual_premium", {
                            required: true,
                            min: 0,
                            valueAsNumber: true,
                          })}
                          className="w-full pl-8 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                          placeholder="0.00"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Commission Rate
                      </label>
                      <select
                        {...register("commission_rate", { required: true })}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                        defaultValue={agentProfile?.start_date ? "20" : "5"}
                      >
                        <option value="5">5%</option>
                        <option value="20">20%</option>
                      </select>
                    </div>
                  </div>
                </div>

                {/* Dates Section */}
                <div className="bg-gray-50 rounded-lg p-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                    <svg className="h-5 w-5 mr-2 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    Important Dates
                  </h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        First Payment Date
                      </label>
                      <input
                        type="date"
                        {...register("first_payment_date")}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Inforce Date
                      </label>
                      <input
                        type="date"
                        {...register("inforce_date")}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                      />
                    </div>
                    <div className="col-span-2">
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Type of Payment
                      </label>
                      <input
                        {...register("type_of_payment")}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                        placeholder="e.g., Monthly, Annual"
                      />
                    </div>
                  </div>
                </div>

                {/* Comments Section */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Comments (Optional)
                  </label>
                  <textarea
                    {...register("comments")}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                    rows={3}
                    placeholder="Add any additional notes or comments..."
                  />
                </div>

                {/* Form Actions */}
                <div className="flex justify-end space-x-3 pt-4 border-t">
                  <button
                    type="button"
                    onClick={handleClose}
                    className="px-6 py-2.5 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 font-medium transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-6 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium transition-colors flex items-center"
                  >
                    <svg className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                    </svg>
                    Add Policy
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

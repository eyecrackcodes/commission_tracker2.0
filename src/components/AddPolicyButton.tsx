"use client";

import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { supabase } from "@/lib/supabase";
import { useUser } from "@clerk/nextjs";
import confetti from "canvas-confetti";
import { calculateCommissionRate } from "@/lib/commission";
import { getCarrierNames, getProductsByCarrier } from "@/lib/carriers";

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
  const [availableProducts, setAvailableProducts] = useState<string[]>([]);
  const [showCustomCarrier, setShowCustomCarrier] = useState(false);
  const [showCustomProduct, setShowCustomProduct] = useState(false);
  const [customCarrierValue, setCustomCarrierValue] = useState("");
  const [customProductValue, setCustomProductValue] = useState("");
  const { register, handleSubmit, reset, setValue, watch } =
    useForm<PolicyFormData>();
  const { user } = useUser();

  // Watch carrier field for changes
  const watchCarrier = watch("carrier");
  const watchProduct = watch("product");

  useEffect(() => {
    // Update available products when carrier changes
    if (watchCarrier) {
      if (watchCarrier === "Custom") {
        setShowCustomCarrier(true);
        setAvailableProducts(["Custom Product"]);
      } else {
        setShowCustomCarrier(false);
        setCustomCarrierValue("");
        const products = getProductsByCarrier(watchCarrier);
        setAvailableProducts(products);
      }
      // Reset product selection when carrier changes
      setValue("product", "");
      setShowCustomProduct(false);
      setCustomProductValue("");
    }
  }, [watchCarrier, setValue]);

  useEffect(() => {
    // Check if custom product is selected
    if (watchProduct === "Custom Product") {
      setShowCustomProduct(true);
    } else {
      setShowCustomProduct(false);
      setCustomProductValue("");
    }
  }, [watchProduct]);

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

  useEffect(() => {
    // Calculate and set commission rate when agent profile is loaded
    if (agentProfile) {
      const rate = calculateCommissionRate(agentProfile.start_date);
      setValue("commission_rate", rate);
    }
  }, [agentProfile, setValue]);

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

      // Use custom values if they exist
      const finalData = {
        ...data,
        carrier:
          showCustomCarrier && customCarrierValue
            ? customCarrierValue
            : data.carrier,
        product:
          showCustomProduct && customProductValue
            ? customProductValue
            : data.product,
      };

      // Calculate commission rate based on tenure
      const commissionRate = calculateCommissionRate(
        agentProfile?.start_date || null
      );

      // Calculate commission due
      const commissionDue =
        finalData.commissionable_annual_premium * commissionRate;

      const { error } = await supabase.from("policies").insert([
        {
          ...finalData,
          user_id: user.id,
          commission_rate: commissionRate,
          commission_due: commissionDue,
          created_at: new Date().toISOString(),
        },
      ]);

      if (error) {
        console.error("Supabase error:", error);
        throw error;
      }

      console.log("Policy added successfully, showing confetti");
      setShowModal(false);
      reset();
      setAvailableProducts([]);
      setCustomCarrierValue("");
      setCustomProductValue("");

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

  const handleModalClose = () => {
    setShowModal(false);
    reset();
    setAvailableProducts([]);
    setShowCustomCarrier(false);
    setShowCustomProduct(false);
    setCustomCarrierValue("");
    setCustomProductValue("");
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
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden">
            <div className="bg-gradient-to-r from-blue-600 to-blue-700 px-8 py-6">
              <h2 className="text-2xl font-bold text-white">Add New Policy</h2>
              <p className="text-blue-100 mt-1">
                Fill in the details below to add a new insurance policy
              </p>
            </div>

            <form
              onSubmit={handleSubmit(onSubmit)}
              className="p-8 overflow-y-auto max-h-[calc(90vh-120px)]"
            >
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Client Name
                  </label>
                  <input
                    {...register("client", { required: true })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                    placeholder="Enter client name"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Insurance Carrier
                  </label>
                  <select
                    {...register("carrier", { required: !showCustomCarrier })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                  >
                    <option value="">Select a carrier</option>
                    {getCarrierNames().map((carrier) => (
                      <option key={carrier} value={carrier}>
                        {carrier}
                      </option>
                    ))}
                  </select>
                  {showCustomCarrier && (
                    <input
                      type="text"
                      value={customCarrierValue}
                      onChange={(e) => setCustomCarrierValue(e.target.value)}
                      placeholder="Enter custom carrier name"
                      className="mt-2 w-full px-4 py-2 border border-gray-300 rounded-lg shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                      required
                    />
                  )}
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Policy Number
                  </label>
                  <input
                    {...register("policy_number", { required: true })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                    placeholder="Enter policy number"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Product Type
                  </label>
                  <select
                    {...register("product", { required: !showCustomProduct })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                    disabled={!watchCarrier}
                  >
                    <option value="">
                      {watchCarrier
                        ? "Select a product"
                        : "Select carrier first"}
                    </option>
                    {availableProducts.map((product) => (
                      <option key={product} value={product}>
                        {product}
                      </option>
                    ))}
                  </select>
                  {showCustomProduct && (
                    <input
                      type="text"
                      value={customProductValue}
                      onChange={(e) => setCustomProductValue(e.target.value)}
                      placeholder="Enter custom product name"
                      className="mt-2 w-full px-4 py-2 border border-gray-300 rounded-lg shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                      required
                    />
                  )}
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Policy Status
                  </label>
                  <select
                    {...register("policy_status", { required: true })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                  >
                    <option value="Pending">Pending</option>
                    <option value="Active">Active</option>
                    <option value="Cancelled">Cancelled</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Commission Rate
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      {...register("commission_rate")}
                      value={
                        agentProfile
                          ? `${
                              calculateCommissionRate(agentProfile.start_date) *
                              100
                            }%`
                          : "5%"
                      }
                      disabled
                      className="w-full px-4 py-2 pr-12 border border-gray-200 rounded-lg bg-gray-50 text-gray-600"
                    />
                    <div className="absolute inset-y-0 right-0 flex items-center pr-3">
                      <svg
                        className="h-5 w-5 text-gray-400"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                        />
                      </svg>
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Annual Premium ($)
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-2 text-gray-500">
                      $
                    </span>
                    <input
                      type="number"
                      step="0.01"
                      {...register("commissionable_annual_premium", {
                        required: true,
                        min: 0,
                      })}
                      className="w-full pl-8 pr-4 py-2 border border-gray-300 rounded-lg shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                      placeholder="0.00"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    First Payment Date
                  </label>
                  <input
                    type="date"
                    {...register("first_payment_date")}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Payment Frequency
                  </label>
                  <select
                    {...register("type_of_payment")}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                  >
                    <option value="">Select payment type</option>
                    <option value="Monthly">Monthly</option>
                    <option value="Quarterly">Quarterly</option>
                    <option value="Semi-Annual">Semi-Annual</option>
                    <option value="Annual">Annual</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    In-Force Date
                  </label>
                  <input
                    type="date"
                    {...register("inforce_date")}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                  />
                </div>
              </div>

              <div className="mt-6">
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Additional Comments
                </label>
                <textarea
                  {...register("comments")}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                  rows={3}
                  placeholder="Enter any additional notes or comments..."
                />
              </div>

              <div className="flex justify-end space-x-4 mt-8 pt-6 border-t border-gray-200">
                <button
                  type="button"
                  onClick={handleModalClose}
                  className="px-6 py-2.5 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors font-medium shadow-sm"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-6 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium shadow-sm"
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

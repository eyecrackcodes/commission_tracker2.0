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
  const [selectedCarrier, setSelectedCarrier] = useState("");
  const [availableProducts, setAvailableProducts] = useState<string[]>([]);
  const [showCustomCarrier, setShowCustomCarrier] = useState(false);
  const [showCustomProduct, setShowCustomProduct] = useState(false);
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
        const products = getProductsByCarrier(watchCarrier);
        setAvailableProducts(products);
      }
      // Reset product selection when carrier changes
      setValue("product", "");
      setShowCustomProduct(false);
    }
  }, [watchCarrier, setValue]);

  useEffect(() => {
    // Check if custom product is selected
    if (watchProduct === "Custom Product") {
      setShowCustomProduct(true);
    } else {
      setShowCustomProduct(false);
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

      console.log("Policy added successfully, showing confetti");
      setShowModal(false);
      reset();
      setAvailableProducts([]);

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
          <div className="bg-white p-8 rounded-lg w-full max-w-2xl max-h-[90vh] overflow-y-auto">
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
                  <select
                    {...register("carrier", { required: !showCustomCarrier })}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
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
                      {...register("carrier", { required: true })}
                      placeholder="Enter custom carrier name"
                      className="mt-2 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                    />
                  )}
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
                  <select
                    {...register("product", { required: !showCustomProduct })}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
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
                      {...register("product", { required: true })}
                      placeholder="Enter custom product name"
                      className="mt-2 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                    />
                  )}
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
                    className="mt-1 block w-full rounded-md border-gray-300 bg-gray-100 shadow-sm"
                  />
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
                  <select
                    {...register("type_of_payment")}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  >
                    <option value="">Select payment type</option>
                    <option value="Monthly">Monthly</option>
                    <option value="Quarterly">Quarterly</option>
                    <option value="Semi-Annual">Semi-Annual</option>
                    <option value="Annual">Annual</option>
                  </select>
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
                  onClick={handleModalClose}
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

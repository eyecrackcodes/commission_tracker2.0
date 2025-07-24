"use client";

import {
  useState,
  useEffect,
  forwardRef,
  useImperativeHandle,
  useCallback,
} from "react";
import { supabase, Policy } from "@/lib/supabase";
import { useUser } from "@clerk/nextjs";
// Removed differenceInMonths import - no longer using tenure calculations
import { useForm } from "react-hook-form";
import AddPolicyButton from "@/components/AddPolicyButton";
import SlackNotificationModal from "@/components/SlackNotificationModal";
import { getCarrierOptions, getProductOptions } from "@/lib/carriers";
import { getPaymentPeriodForPolicy } from "@/lib/commissionCalendar";
import { format, parseISO } from "date-fns";

export interface PolicyTableRef {
  fetchPolicies: () => Promise<void>;
  viewPolicy: (policyId: number) => void;
}

interface PolicyTableProps {
  onPolicyUpdate?: () => void;
}

interface EditPolicyFormData {
  client: string;
  carrier: string;
  policy_number: string;
  product: string;
  policy_status: string;
  commissionable_annual_premium: number;
  commission_rate: number;
  first_payment_date: string | null;
  type_of_payment: string | null;
  inforce_date: string | null;
  date_policy_verified: string | null;
  comments: string | null;
  created_at: string;
}

interface FilterOptions {
  status: string;
  dateRange: string;
  startDate: string;
  endDate: string;
  searchTerm: string;
}

// Removed AgentProfile interface - no longer needed since tenure calculations removed

const PolicyTable = forwardRef<PolicyTableRef, PolicyTableProps>(({ onPolicyUpdate }, ref) => {
  const [policies, setPolicies] = useState<Policy[]>([]);
  const [filteredPolicies, setFilteredPolicies] = useState<Policy[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingPolicy, setEditingPolicy] = useState<Policy | null>(null);
  const [policyToDelete, setPolicyToDelete] = useState<Policy | null>(null);
  const [filters, setFilters] = useState<FilterOptions>({
    status: "all",
    dateRange: "all",
    startDate: "",
    endDate: "",
    searchTerm: "",
  });
  const [searchInput, setSearchInput] = useState("");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");
  const [sortField, setSortField] = useState<keyof Policy>("created_at");
  const [editingCarrier, setEditingCarrier] = useState("");
  const [editingProductOptions, setEditingProductOptions] = useState<string[]>([]);
  
  interface SlackPolicyData {
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
  
  const [slackPolicyData, setSlackPolicyData] = useState<SlackPolicyData | null>(null);

  const { user } = useUser();
  const { register, handleSubmit, reset, setValue, watch } =
    useForm<EditPolicyFormData>();

  // Watch carrier changes in edit form
  const editCarrierValue = watch("carrier");

  useEffect(() => {
    if (editCarrierValue && editingPolicy) {
      setEditingCarrier(editCarrierValue);
      const products = getProductOptions(editCarrierValue);
      setEditingProductOptions(products);
      // Only reset product if carrier actually changed
      if (editCarrierValue !== editingPolicy.carrier) {
        setValue("product", "");
      }
    }
  }, [editCarrierValue, editingPolicy, setValue]);

  const viewPolicy = useCallback((policyId: number) => {
    const policy = policies.find(p => p.id === policyId);
    if (policy) {
      handleEdit(policy);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [policies]);

  useImperativeHandle(ref, () => ({
    fetchPolicies,
    viewPolicy,
  }));

  const fetchPolicies = useCallback(async () => {
    if (!user) return;

    try {
      setLoading(true);
      setError(null);

      const { data, error: supabaseError } = await supabase
        .from("policies")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (supabaseError) {
        throw supabaseError;
      }



      setPolicies(data || []);
    } catch (err) {
      console.error("Error fetching policies:", err);
      setError(
        "Failed to fetch policies. Please make sure your database is properly set up."
      );
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (user) {
      fetchPolicies();
    }
  }, [user, fetchPolicies]);

  const applyFilters = useCallback(() => {
    console.log("Starting filter application with:", {
      dateRange: filters.dateRange,
      status: filters.status,
      searchInput,
      policies: policies.map((p) => ({
        policy_number: p.policy_number,
        first_payment_date: p.first_payment_date,
        inforce_date: p.inforce_date,
        created_at: p.created_at,
      })),
    });

    let result = [...policies];
    console.log("Initial policies count:", result.length);

    // Apply status filter
    if (filters.status !== "all") {
      result = result.filter(
        (policy) =>
          policy.policy_status.toLowerCase() === filters.status.toLowerCase()
      );
      console.log("After status filter count:", result.length);
    }

    // Apply date range filter
    if (filters.dateRange !== "all") {
      const now = new Date();
      let startDate = new Date();
      let endDate = new Date();

      switch (filters.dateRange) {
        case "month":
          // This month: 1st to last day
          startDate = new Date(now.getFullYear(), now.getMonth(), 1);
          startDate.setHours(0, 0, 0, 0);
          endDate = new Date(
            now.getFullYear(),
            now.getMonth() + 1,
            0,
            23,
            59,
            59,
            999
          );
          console.log("Month Filter Setup:", {
            startDate: startDate.toISOString(),
            endDate: endDate.toISOString(),
          });
          break;
        case "quarter":
          // This quarter
          const currentQuarter = Math.floor(now.getMonth() / 3);
          const quarterStartMonth = currentQuarter * 3;
          startDate = new Date(now.getFullYear(), quarterStartMonth, 1);
          startDate.setHours(0, 0, 0, 0);
          endDate = new Date(
            now.getFullYear(),
            quarterStartMonth + 3,
            0,
            23,
            59,
            59,
            999
          );
          break;
        case "year":
          // This year
          startDate = new Date(now.getFullYear(), 0, 1);
          startDate.setHours(0, 0, 0, 0);
          endDate = new Date(
            now.getFullYear(),
            11,
            31,
            23,
            59,
            59,
            999
          );
          break;
        case "custom":
          if (filters.startDate && filters.endDate) {
            startDate = new Date(filters.startDate);
            startDate.setHours(0, 0, 0, 0);
            endDate = new Date(filters.endDate);
            endDate.setHours(23, 59, 59, 999);
          } else {
            // If custom dates are not set, don't apply date filter
            break;
          }
          break;
        default:
          // For "all" or any unhandled cases, don't apply date filter
          return result;
      }

      // Only apply date filter if we have valid dates
      if (startDate && endDate && startDate <= endDate) {
        if (process.env.NODE_ENV === 'development') {
          console.log("Applying date filter:", filters.dateRange, "(" + result.length + " policies)");
        }

        result = result.filter((policy) => {
          // Use created_at as the standard date for filtering consistency
          if (!policy.created_at) {
            console.warn("Policy missing created_at date:", policy.policy_number);
            return false;
          }

          const policyDate = new Date(policy.created_at);

          // Create a new date object for comparison to avoid mutation
          const normalizedPolicyDate = new Date(policyDate);
          normalizedPolicyDate.setHours(0, 0, 0, 0);

          const isInRange =
            normalizedPolicyDate >= startDate &&
            normalizedPolicyDate <= endDate;

          // Removed verbose logging for performance

          return isInRange;
        });

        if (process.env.NODE_ENV === 'development') {
          console.log("After date filter:", result.length + " policies");
        }
      }
    }

    // Apply search filter
    if (searchInput) {
      const searchLower = searchInput.toLowerCase();
      result = result.filter(
        (policy) =>
          policy.client.toLowerCase().includes(searchLower) ||
          policy.carrier.toLowerCase().includes(searchLower) ||
          policy.policy_number.toLowerCase().includes(searchLower) ||
          policy.product.toLowerCase().includes(searchLower)
      );
    }

    setFilteredPolicies(result);
    return result;
  }, [filters, searchInput, policies]);

  useEffect(() => {
    applyFilters();
  }, [applyFilters]);

  // Debounced search effect
  useEffect(() => {
    const timer = setTimeout(() => {
      setFilters((prev) => ({ ...prev, searchTerm: searchInput }));
    }, 300); // 300ms delay

    return () => clearTimeout(timer);
  }, [searchInput]);

  // Add a useEffect to reset custom date range when switching to other options
  useEffect(() => {
    if (filters.dateRange !== "custom") {
      setFilters((prev) => ({
        ...prev,
        startDate: "",
        endDate: "",
      }));
    }
  }, [filters.dateRange]);

  // Removed agent profile fetching - no longer needed since tenure calculations removed

  // Removed tenure calculation - agents now set their own commission rates

  const handleDelete = async (id: number) => {
    if (!user) return;

    try {
      const { error } = await supabase
        .from("policies")
        .delete()
        .eq("id", id)
        .eq("user_id", user.id);

      if (error) throw error;
      setPolicies(policies.filter((policy) => policy.id !== id));
      setPolicyToDelete(null); // Close the confirmation dialog
      
      // Notify parent component of policy update
      onPolicyUpdate?.();
    } catch (err) {
      setError("Failed to delete policy");
      console.error("Error deleting policy:", err);
    }
  };

  const handleEdit = (policy: Policy) => {
    setEditingPolicy(policy);
    // Set form values
    setValue("client", policy.client);
    setValue("carrier", policy.carrier);
    setValue("policy_number", policy.policy_number);
    setValue("product", policy.product);
    setValue("policy_status", policy.policy_status);
    setValue(
      "commissionable_annual_premium",
      policy.commissionable_annual_premium
    );
    setValue("commission_rate", policy.commission_rate * 100);
    setValue("first_payment_date", policy.first_payment_date || "");
    setValue("type_of_payment", policy.type_of_payment || "");
    setValue("inforce_date", policy.inforce_date || "");
    setValue("date_policy_verified", policy.date_policy_verified || "");
    setValue("comments", policy.comments || "");
    
    // Set carrier and product options
    setEditingCarrier(policy.carrier);
    const products = getProductOptions(policy.carrier);
    setEditingProductOptions(products);
  };

  const onSubmitEdit = async (data: EditPolicyFormData) => {
    if (!user || !editingPolicy) return;

    try {
      setError(null);
      
      // Convert commission rate from percentage to decimal
      const commissionRate = Number(data.commission_rate) / 100;
      
      // Validate that we have a valid number
      if (isNaN(commissionRate) || commissionRate < 0 || commissionRate > 1) {
        throw new Error("Invalid commission rate");
      }

      const annualPremium = Number(data.commissionable_annual_premium);
      if (isNaN(annualPremium) || annualPremium < 0) {
        throw new Error("Invalid annual premium amount");
      }

      // Determine policy status - if date_policy_verified is being set, automatically make it Active
      let finalPolicyStatus = data.policy_status || editingPolicy.policy_status;
      if (data.date_policy_verified && !editingPolicy.date_policy_verified) {
        finalPolicyStatus = 'Active'; // Automatically set to Active when verified
      }

      // Check if policy is being cancelled for Slack alert
      const isBeingCancelled = finalPolicyStatus === 'Cancelled' && editingPolicy.policy_status !== 'Cancelled';

      // Format the data for update
      const formattedData = {
        client: data.client?.trim() || editingPolicy.client,
        carrier: data.carrier?.trim() || editingPolicy.carrier,
        policy_number: data.policy_number?.trim() || editingPolicy.policy_number,
        product: data.product?.trim() || editingPolicy.product,
        policy_status: finalPolicyStatus,
        commissionable_annual_premium: annualPremium,
        commission_rate: commissionRate,
        first_payment_date: data.first_payment_date || null,
        type_of_payment: data.type_of_payment || null,
        inforce_date: data.inforce_date || null,
        date_policy_verified: data.date_policy_verified || null,
        comments: data.comments || null,
        created_at: data.created_at || editingPolicy.created_at,
        // Temporarily commented out cancelled_date logic until migration is run
        // cancelled_date: data.policy_status === 'Cancelled' && editingPolicy.policy_status !== 'Cancelled'
        //   ? new Date().toISOString()
        //   : data.policy_status !== 'Cancelled' && editingPolicy.policy_status === 'Cancelled'
        //   ? null
        //   : editingPolicy.cancelled_date, // Keep existing value if no status change
      };

      // Note: commission_due is a generated column and will be automatically calculated by the database

      // Development-only logging
      if (process.env.NODE_ENV === 'development') {
        console.log("Updating policy with data:", formattedData);
        console.log("Commission rate:", (commissionRate * 100).toFixed(2) + "%");
      }

      const { error } = await supabase
        .from("policies")
        .update(formattedData)
        .eq("id", editingPolicy.id)
        .eq("user_id", user.id);

      if (error) {
        console.error("Supabase error details:", error);
        console.error("Error code:", error.code);
        console.error("Error message:", error.message);
        console.error("Error details:", error.details);
        console.error("Error hint:", error.hint);
        throw error;
      }

      // Send Slack alert if policy is being cancelled
      if (isBeingCancelled) {
        try {
          const response = await fetch('/api/slack-notification', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              type: 'cancellation_alert',
              data: {
                policyNumber: editingPolicy.policy_number,
                client: editingPolicy.client,
                carrier: editingPolicy.carrier,
                commissionAmount: editingPolicy.commission_due,
                cancelledDate: new Date().toISOString()
              }
            }),
          });

          if (response.ok) {
            console.log('Cancellation alert sent to Slack successfully');
          } else {
            console.error('Failed to send cancellation alert to Slack');
          }
        } catch (slackError) {
          console.error('Error sending Slack cancellation alert:', slackError);
          // Don't fail the policy update if Slack fails
        }
      }

      // Refresh policies
      await fetchPolicies();
      setEditingPolicy(null);
      reset();
      setEditingCarrier("");
      setEditingProductOptions([]);
      
      // Notify parent component of policy update
      onPolicyUpdate?.();
    } catch (err) {
      console.error("Error updating policy:", err);
      setError(err instanceof Error ? err.message : "Failed to update policy");
    }
  };

  // Calculate summary statistics
  const summaryStats = {
    active: {
      count: policies.filter((p) => p.policy_status === "Active").length,
      premium: policies
        .filter((p) => p.policy_status === "Active")
        .reduce((sum, p) => sum + p.commissionable_annual_premium, 0),
      commission: policies
        .filter((p) => p.policy_status === "Active")
        .reduce((sum, p) => sum + p.commission_due, 0),
    },
    pending: {
      count: policies.filter((p) => p.policy_status === "Pending").length,
      premium: policies
        .filter((p) => p.policy_status === "Pending")
        .reduce((sum, p) => sum + p.commissionable_annual_premium, 0),
      commission: policies
        .filter((p) => p.policy_status === "Pending")
        .reduce((sum, p) => sum + p.commission_due, 0),
    },
    cancelled: {
      count: policies.filter((p) => p.policy_status === "Cancelled").length,
      premium: policies
        .filter((p) => p.policy_status === "Cancelled")
        .reduce((sum, p) => sum + p.commissionable_annual_premium, 0),
      commission: policies
        .filter((p) => p.policy_status === "Cancelled")
        .reduce((sum, p) => sum + p.commission_due, 0),
    },
  };

  const handleSort = (field: keyof Policy) => {
    if (field === sortField) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDirection("asc");
    }
  };

  const sortPolicies = (policies: Policy[]) => {
    return [...policies].sort((a, b) => {
      const aValue = a[sortField];
      const bValue = b[sortField];

      if (aValue === null) return sortDirection === "asc" ? -1 : 1;
      if (bValue === null) return sortDirection === "asc" ? 1 : -1;

      if (aValue < bValue) return sortDirection === "asc" ? -1 : 1;
      if (aValue > bValue) return sortDirection === "asc" ? 1 : -1;
      return 0;
    });
  };

  const sortedAndFilteredPolicies = sortPolicies(filteredPolicies);

  // Calculate total commission from filtered policies
  const totalCommission = sortedAndFilteredPolicies.reduce(
    (sum, policy) => sum + policy.commission_due,
    0
  );

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="text-gray-600">Loading policies...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-md p-4">
        <div className="flex">
          <div className="flex-shrink-0">
            <svg
              className="h-5 w-5 text-red-400"
              viewBox="0 0 20 20"
              fill="currentColor"
            >
              <path
                fillRule="evenodd"
                d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                clipRule="evenodd"
              />
            </svg>
          </div>
          <div className="ml-3">
            <h3 className="text-sm font-medium text-red-800">Error</h3>
            <div className="mt-2 text-sm text-red-700">{error}</div>
          </div>
        </div>
      </div>
    );
  }

  if (policies.length === 0) {
    return (
      <div>
        <div className="text-center py-12 bg-white dark:bg-gray-800 rounded-lg shadow dark:shadow-gray-900/50">
          <svg
            className="mx-auto h-12 w-12 text-gray-400 dark:text-gray-600"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 13h6m-3-3v6m-9 1V7a2 2 0 012-2h6l2 2h6a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z"
            />
          </svg>
          <h3 className="mt-2 text-sm font-medium text-gray-900">No policies</h3>
          <p className="mt-1 text-sm text-gray-500">
            Get started by creating a new policy.
          </p>
          <div className="mt-6">
            <AddPolicyButton 
              onPolicyAdded={(policyData) => {
                if (policyData) {
                  setSlackPolicyData(policyData);
                }
                fetchPolicies();
                onPolicyUpdate?.();
              }} 
            />
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 md:gap-6 mb-6 md:mb-8">
        {/* Active Policies Card */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow dark:shadow-gray-900/50 p-4 md:p-6">
          <div className="flex items-center">
            <div className="p-2 md:p-3 rounded-full bg-green-100 dark:bg-green-900/30">
              <svg
                className="h-6 w-6 md:h-8 md:w-8 text-green-600 dark:text-green-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            </div>
            <div className="ml-3 md:ml-4">
              <h2 className="text-sm md:text-lg font-semibold text-gray-700 dark:text-gray-300">
                Active Policies
              </h2>
              <div className="mt-1 md:mt-2">
                <p className="text-xl md:text-3xl font-bold text-gray-900 dark:text-gray-100">
                  {summaryStats.active.count}
                </p>
                <p className="text-xs md:text-sm text-gray-600 dark:text-gray-400">
                  ${summaryStats.active.premium.toLocaleString()} in premiums
                </p>
                <p className="text-xs md:text-sm text-gray-600 dark:text-gray-400">
                  ${summaryStats.active.commission.toFixed(2).toLocaleString()} in
                  commissions
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Pending Policies Card */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow dark:shadow-gray-900/50 p-4 md:p-6">
          <div className="flex items-center">
            <div className="p-2 md:p-3 rounded-full bg-yellow-100 dark:bg-yellow-900/30">
              <svg
                className="h-6 w-6 md:h-8 md:w-8 text-yellow-600 dark:text-yellow-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            </div>
            <div className="ml-3 md:ml-4">
              <h2 className="text-sm md:text-lg font-semibold text-gray-700 dark:text-gray-300">
                Pending Policies
              </h2>
              <div className="mt-1 md:mt-2">
                <p className="text-xl md:text-3xl font-bold text-gray-900 dark:text-gray-100">
                  {summaryStats.pending.count}
                </p>
                <p className="text-xs md:text-sm text-gray-600 dark:text-gray-400">
                  ${summaryStats.pending.premium.toLocaleString()} in premiums
                </p>
                <p className="text-xs md:text-sm text-gray-600 dark:text-gray-400">
                  ${summaryStats.pending.commission.toFixed(2).toLocaleString()} in
                  commissions
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Cancelled Policies Card */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow dark:shadow-gray-900/50 p-4 md:p-6 border-l-4 border-red-500">
          <div className="flex items-center">
            <div className="p-2 md:p-3 rounded-full bg-red-100 dark:bg-red-900/30">
              <svg
                className="h-6 w-6 md:h-8 md:w-8 text-red-600 dark:text-red-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            </div>
            <div className="ml-3 md:ml-4 flex-1">
              <h2 className="text-sm md:text-lg font-semibold text-gray-700 dark:text-gray-300">
                Cancelled Policies
              </h2>
              <div className="mt-1 md:mt-2">
                <p className="text-xl md:text-3xl font-bold text-red-600 dark:text-red-400">
                  {summaryStats.cancelled.count}
                </p>
                <p className="text-xs md:text-sm text-gray-600 dark:text-gray-400">
                  ${summaryStats.cancelled.premium.toLocaleString()} in premiums
                </p>
                <p className="text-xs md:text-sm font-semibold text-red-600 dark:text-red-400">
                  ${summaryStats.cancelled.commission.toFixed(2).toLocaleString()} in lost commissions
                </p>
                {summaryStats.cancelled.count > 0 && (
                  <div className="mt-2 p-2 bg-red-50 dark:bg-red-900/20 rounded-md">
                    <p className="text-xs text-red-700 dark:text-red-300 font-medium">
                      💡 Tip: Follow up quickly on pending policies to prevent cancellations
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Removed tenure display - agents now control their own commission rates */}

      {/* Filters */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6 mb-6">
        <div className="flex items-center mb-5">
          <svg className="h-5 w-5 text-blue-600 dark:text-blue-400 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
          </svg>
          <h2 className="text-lg md:text-xl font-semibold text-gray-900 dark:text-gray-100">
            Filters
          </h2>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <label
              htmlFor="status"
              className="block text-sm font-medium text-gray-700 mb-2"
            >
              Status
            </label>
            <select
              id="status"
              value={filters.status}
              onChange={(e) =>
                setFilters({ ...filters, status: e.target.value })
              }
              className="w-full px-4 py-2.5 bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors duration-200 hover:bg-gray-100"
            >
              <option value="all">All Statuses</option>
              <option value="Active">Active</option>
              <option value="Pending">Pending</option>
              <option value="Cancelled">Cancelled</option>
            </select>
          </div>

          <div>
            <label
              htmlFor="dateRange"
              className="block text-sm font-medium text-gray-700 mb-2"
            >
              Date Range
            </label>
            <select
              id="dateRange"
              value={filters.dateRange}
              onChange={(e) =>
                setFilters({ ...filters, dateRange: e.target.value })
              }
              className="w-full px-4 py-2.5 bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors duration-200 hover:bg-gray-100"
            >
              <option value="all">All Time</option>
              <option value="month">This Month</option>
              <option value="quarter">This Quarter</option>
              <option value="year">This Year</option>
              <option value="custom">Custom Range</option>
            </select>
          </div>

          {filters.dateRange === "custom" && (
            <>
              <div>
                <label
                  htmlFor="startDate"
                  className="block text-sm font-medium text-gray-700 mb-2"
                >
                  Start Date
                </label>
                <input
                  type="date"
                  id="startDate"
                  value={filters.startDate}
                  onChange={(e) =>
                    setFilters({ ...filters, startDate: e.target.value })
                  }
                  className="w-full px-4 py-2.5 bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors duration-200 hover:bg-gray-100"
                />
              </div>
              <div>
                <label
                  htmlFor="endDate"
                  className="block text-sm font-medium text-gray-700 mb-2"
                >
                  End Date
                </label>
                <input
                  type="date"
                  id="endDate"
                  value={filters.endDate}
                  onChange={(e) =>
                    setFilters({ ...filters, endDate: e.target.value })
                  }
                  className="w-full px-4 py-2.5 bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors duration-200 hover:bg-gray-100"
                />
              </div>
            </>
          )}

          <div className={filters.dateRange === "custom" ? "sm:col-span-2 md:col-span-4" : ""}>
            <label
              htmlFor="search"
              className="block text-sm font-medium text-gray-700 mb-2"
            >
              Search
            </label>
            <div className="relative">
              <input
                type="text"
                id="search"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="Search by client, carrier, or product..."
                className="w-full pl-4 pr-10 py-2.5 bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors duration-200 hover:bg-gray-100"
              />
              <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
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
                    d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                  />
                </svg>
              </div>
            </div>
          </div>
        </div>
        
        {/* Active filters indicator */}
        {(filters.status !== 'all' || filters.dateRange !== 'all' || searchInput) && (
          <div className="mt-4 flex items-center">
            <span className="text-sm text-gray-600 dark:text-gray-400 mr-2">Active filters:</span>
            <div className="flex flex-wrap gap-2">
              {filters.status !== 'all' && (
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                  Status: {filters.status}
                  <button
                    onClick={() => setFilters({ ...filters, status: 'all' })}
                    className="ml-1 hover:text-blue-600"
                  >
                    ×
                  </button>
                </span>
              )}
              {filters.dateRange !== 'all' && (
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                  Date: {filters.dateRange === 'month' ? 'This Month' : 
                         filters.dateRange === 'quarter' ? 'This Quarter' : 
                         filters.dateRange === 'year' ? 'This Year' : 'Custom'}
                  <button
                    onClick={() => setFilters({ ...filters, dateRange: 'all', startDate: '', endDate: '' })}
                    className="ml-1 hover:text-blue-600"
                  >
                    ×
                  </button>
                </span>
              )}
              {searchInput && (
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                  Search: {searchInput}
                  <button
                    onClick={() => setSearchInput('')}
                    className="ml-1 hover:text-blue-600"
                  >
                    ×
                  </button>
                </span>
              )}
              <button
                onClick={() => {
                  setFilters({ status: 'all', dateRange: 'all', startDate: '', endDate: '', searchTerm: '' });
                  setSearchInput('');
                }}
                className="text-xs text-blue-600 hover:text-blue-800 font-medium"
              >
                Clear all
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Table Actions */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 md:mb-6">
        <h2 className="text-lg md:text-xl font-semibold text-gray-900 mb-4 sm:mb-0">
          Policies
        </h2>
        <AddPolicyButton 
          onPolicyAdded={(policyData) => {
            if (policyData) {
              setSlackPolicyData(policyData);
            }
            fetchPolicies();
            onPolicyUpdate?.();
          }} 
        />
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-gray-800 shadow dark:shadow-gray-900/50 overflow-hidden rounded-lg">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-700">
              <tr>
                <th
                  scope="col"
                  className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                >
                  <button
                    onClick={() => handleSort("client")}
                    className="flex items-center focus:outline-none"
                  >
                    Client
                    {sortField === "client" && (
                      <span className="ml-1">
                        {sortDirection === "asc" ? "↑" : "↓"}
                      </span>
                    )}
                  </button>
                </th>
                <th
                  scope="col"
                  className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                >
                  <button
                    onClick={() => handleSort("carrier")}
                    className="flex items-center focus:outline-none"
                  >
                    Carrier
                    {sortField === "carrier" && (
                      <span className="ml-1">
                        {sortDirection === "asc" ? "↑" : "↓"}
                      </span>
                    )}
                  </button>
                </th>
                <th
                  scope="col"
                  className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                >
                  <button
                    onClick={() => handleSort("policy_number")}
                    className="flex items-center focus:outline-none"
                  >
                    Policy #
                    {sortField === "policy_number" && (
                      <span className="ml-1">
                        {sortDirection === "asc" ? "↑" : "↓"}
                      </span>
                    )}
                  </button>
                </th>
                <th
                  scope="col"
                  className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                >
                  <button
                    onClick={() => handleSort("product")}
                    className="flex items-center focus:outline-none"
                  >
                    Product
                    {sortField === "product" && (
                      <span className="ml-1">
                        {sortDirection === "asc" ? "↑" : "↓"}
                      </span>
                    )}
                  </button>
                </th>
                <th
                  scope="col"
                  className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                >
                  <button
                    onClick={() => handleSort("policy_status")}
                    className="flex items-center focus:outline-none"
                  >
                    Status
                    {sortField === "policy_status" && (
                      <span className="ml-1">
                        {sortDirection === "asc" ? "↑" : "↓"}
                      </span>
                    )}
                  </button>
                </th>
                <th
                  scope="col"
                  className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                >
                  <button
                    onClick={() => handleSort("commissionable_annual_premium")}
                    className="flex items-center focus:outline-none"
                  >
                    Premium
                    {sortField === "commissionable_annual_premium" && (
                      <span className="ml-1">
                        {sortDirection === "asc" ? "↑" : "↓"}
                      </span>
                    )}
                  </button>
                </th>
                <th
                  scope="col"
                  className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                >
                  <button
                    onClick={() => handleSort("commission_due")}
                    className="flex items-center focus:outline-none"
                  >
                    Commission
                    {sortField === "commission_due" && (
                      <span className="ml-1">
                        {sortDirection === "asc" ? "↑" : "↓"}
                      </span>
                    )}
                  </button>
                </th>
                <th
                  scope="col"
                  className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                >
                  Payment Status
                </th>
                <th
                  scope="col"
                  className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                >
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
              {filteredPolicies.length === 0 ? (
                <tr>
                  <td
                    colSpan={9}
                    className="px-3 py-4 text-center text-sm text-gray-500"
                  >
                    No policies found. Try adjusting your filters.
                  </td>
                </tr>
              ) : (
                sortedAndFilteredPolicies.map((policy) => (
                  <tr key={policy.id}>
                    <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                      {policy.client}
                    </td>
                    <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                      {policy.carrier}
                    </td>
                    <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                      {policy.policy_number}
                    </td>
                    <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                      {policy.product}
                    </td>
                    <td className="px-3 py-4 whitespace-nowrap text-sm">
                      <span
                        className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                          policy.policy_status === "Active"
                            ? "bg-green-100 text-green-800"
                            : policy.policy_status === "Pending"
                            ? "bg-yellow-100 text-yellow-800"
                            : "bg-red-100 text-red-800"
                        }`}
                      >
                        {policy.policy_status.charAt(0).toUpperCase() +
                          policy.policy_status.slice(1)}
                      </span>
                    </td>
                    <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                      ${policy.commissionable_annual_premium.toLocaleString()}
                    </td>
                    <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                      ${policy.commission_due.toFixed(2).toLocaleString()}
                    </td>
                    <td className="px-3 py-4 whitespace-nowrap text-sm">
                      {(() => {
                        const paymentInfo = getPaymentPeriodForPolicy(policy.created_at);
                        if (!policy.date_policy_verified && paymentInfo.paymentDate) {
                          return (
                            <div>
                              <p className="text-xs font-medium text-gray-900 dark:text-gray-100">
                                {format(parseISO(paymentInfo.paymentDate.date), 'MMM d')}
                              </p>
                              <p className="text-xs text-gray-500 dark:text-gray-400">
                                {paymentInfo.daysUntilPayment === 0 
                                  ? 'Today' 
                                  : `${paymentInfo.daysUntilPayment} days`}
                              </p>
                            </div>
                          );
                        } else if (policy.date_policy_verified) {
                          return (
                            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                              Verified
                            </span>
                          );
                        } else {
                          return <span className="text-gray-400">-</span>;
                        }
                      })()}
                    </td>
                    <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-500">
                      <div className="flex space-x-2">
                        <button
                          onClick={() => handleEdit(policy)}
                          className="text-blue-600 dark:text-blue-400 hover:text-blue-900 dark:hover:text-blue-300"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => setPolicyToDelete(policy)}
                          className="text-red-600 dark:text-red-400 hover:text-red-900 dark:hover:text-red-300"
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Total Commission */}
      <div className="mt-6 md:mt-8 bg-white rounded-lg shadow p-4 md:p-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center">
          <h2 className="text-lg md:text-xl font-semibold text-gray-900 mb-2 sm:mb-0">
            Total Commission
          </h2>
          <p className="text-2xl md:text-3xl font-bold text-blue-600">
            ${totalCommission.toFixed(2).toLocaleString()}
          </p>
        </div>
      </div>

      {/* Edit Policy Modal */}
      {editingPolicy && (
        <div className="fixed inset-0 bg-black dark:bg-black bg-opacity-50 dark:bg-opacity-70 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl dark:shadow-gray-900/50 w-full max-w-2xl max-h-[90vh] overflow-hidden">
            {/* Header */}
            <div className="bg-gradient-to-r from-amber-600 to-amber-700 px-8 py-6">
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
                        d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                      />
                    </svg>
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold text-white">Edit Policy</h2>
                    <p className="text-amber-100 text-sm mt-1">Update the policy information below</p>
                  </div>
                </div>
                <button
                  onClick={() => {
                    setEditingPolicy(null);
                    reset();
                    setEditingCarrier("");
                    setEditingProductOptions([]);
                  }}
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
              <form onSubmit={handleSubmit(onSubmitEdit)} className="space-y-6">
                {/* Policy Date Section */}
                <div className="bg-amber-50 rounded-lg p-6 border-l-4 border-amber-500">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                    <svg className="h-5 w-5 mr-2 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    Policy Date
                  </h3>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Policy Entry Date
                      <span className="text-gray-500 text-xs ml-2">(When this policy was created)</span>
                    </label>
                    <input
                      type="date"
                      {...register("created_at")}
                      defaultValue={editingPolicy?.created_at ? new Date(editingPolicy.created_at).toISOString().split('T')[0] : ''}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500 transition-colors"
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
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500 transition-colors"
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
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500 transition-colors"
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
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500 transition-colors disabled:bg-gray-100 disabled:cursor-not-allowed"
                        disabled={!editingCarrier}
                      >
                        <option value="">
                          {editingCarrier ? "Select a product" : "Select carrier first"}
                        </option>
                        {editingProductOptions.map((product) => (
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
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500 transition-colors"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Policy Status
                      </label>
                      <select
                        {...register("policy_status", { required: true })}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500 transition-colors"
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
                          })}
                          className="w-full pl-8 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500 transition-colors"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Commission Rate
                      </label>
                      <select
                        {...register("commission_rate", { required: true })}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500 transition-colors"
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
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500 transition-colors"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Inforce Date
                      </label>
                      <input
                        type="date"
                        {...register("inforce_date")}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500 transition-colors"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Type of Payment
                      </label>
                      <input
                        {...register("type_of_payment")}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500 transition-colors"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Date Verified
                        <span className="text-xs text-gray-500 ml-2">(When you verified the policy is active - automatically sets status to Active)</span>
                      </label>
                      <input
                        type="date"
                        {...register("date_policy_verified")}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500 transition-colors"
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
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500 transition-colors"
                    rows={3}
                  />
                </div>

                {/* Form Actions */}
                <div className="flex justify-end space-x-3 pt-4 border-t">
                  <button
                    type="button"
                    onClick={() => {
                      setEditingPolicy(null);
                      reset();
                      setEditingCarrier("");
                      setEditingProductOptions([]);
                    }}
                    className="px-6 py-2.5 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 font-medium transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-6 py-2.5 bg-amber-600 text-white rounded-lg hover:bg-amber-700 font-medium transition-colors flex items-center"
                  >
                    <svg className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    Save Changes
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {policyToDelete && (
        <div className="fixed inset-0 bg-black dark:bg-black bg-opacity-50 dark:bg-opacity-70 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl dark:shadow-gray-900/50 w-full max-w-md">
            <div className="p-6">
              <div className="flex items-center mb-4">
                <div className="bg-red-100 rounded-full p-3 mr-4">
                  <svg
                    className="h-6 w-6 text-red-600"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                    />
                  </svg>
                </div>
                <div>
                  <h2 className="text-xl font-bold text-gray-900">Confirm Deletion</h2>
                  <p className="text-sm text-gray-600 mt-1">This action cannot be undone</p>
                </div>
              </div>
              
              <p className="text-gray-700 mb-6">
                Are you sure you want to delete the policy for{" "}
                <span className="font-semibold text-gray-900">{policyToDelete.client}</span>?
                All associated data will be permanently removed.
              </p>
              
              <div className="flex justify-end space-x-3">
                <button
                  onClick={() => setPolicyToDelete(null)}
                  className="px-5 py-2.5 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 font-medium transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleDelete(policyToDelete.id)}
                  className="px-5 py-2.5 bg-red-600 text-white rounded-lg hover:bg-red-700 font-medium transition-colors flex items-center"
                >
                  <svg className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                  Delete Policy
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Slack Notification Modal */}
      <SlackNotificationModal 
        policyData={slackPolicyData}
        onClose={() => setSlackPolicyData(null)}
      />
    </>
  );
});

PolicyTable.displayName = "PolicyTable";

export default PolicyTable;

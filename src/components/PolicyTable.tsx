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
import { differenceInMonths } from "date-fns";
import { useForm } from "react-hook-form";
import AddPolicyButton from "@/components/AddPolicyButton";

export interface PolicyTableRef {
  fetchPolicies: () => Promise<void>;
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
  date_commission_paid: string | null;
  comments: string | null;
}

interface FilterOptions {
  status: string;
  dateRange: string;
  startDate: string;
  endDate: string;
  searchTerm: string;
}

type SortField =
  | "client"
  | "carrier"
  | "policy_number"
  | "product"
  | "policy_status"
  | "commissionable_annual_premium"
  | "commission_due";
type SortDirection = "asc" | "desc";

interface SortState {
  field: SortField;
  direction: SortDirection;
}

interface AgentProfile {
  start_date: string | null;
}

const PolicyTable = forwardRef<PolicyTableRef>((props, ref) => {
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
  const [sort, setSort] = useState<SortState>({
    field: "client",
    direction: "asc",
  });
  const [agentProfile, setAgentProfile] = useState<AgentProfile | null>(null);

  const { user } = useUser();
  const { register, handleSubmit, reset, setValue } =
    useForm<EditPolicyFormData>();

  useImperativeHandle(ref, () => ({
    fetchPolicies,
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
          // Last month: 1st to last day
          startDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
          startDate.setHours(0, 0, 0, 0);
          endDate = new Date(
            now.getFullYear(),
            now.getMonth(),
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
          // Last 3 months
          startDate = new Date(now.getFullYear(), now.getMonth() - 3, 1);
          startDate.setHours(0, 0, 0, 0);
          endDate = new Date(
            now.getFullYear(),
            now.getMonth(),
            0,
            23,
            59,
            59,
            999
          );
          break;
        case "year":
          // Last year
          startDate = new Date(now.getFullYear() - 1, now.getMonth(), 1);
          startDate.setHours(0, 0, 0, 0);
          endDate = new Date(
            now.getFullYear(),
            now.getMonth(),
            0,
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
        console.log("Applying date filter with:", {
          dateRange: filters.dateRange,
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString(),
          policiesBeforeFilter: result.length,
        });

        result = result.filter((policy) => {
          // Get the relevant date from the policy
          let policyDate = null;
          let dateSource = "";

          // Try to get the most relevant date in order of priority
          if (policy.first_payment_date) {
            policyDate = new Date(policy.first_payment_date);
            dateSource = "first_payment_date";
          } else if (policy.inforce_date) {
            policyDate = new Date(policy.inforce_date);
            dateSource = "inforce_date";
          } else if (policy.created_at) {
            policyDate = new Date(policy.created_at);
            dateSource = "created_at";
          }

          // If we couldn't get any valid date, exclude the policy
          if (!policyDate) {
            console.log("No valid date found for policy:", {
              policy_number: policy.policy_number,
              dates: {
                first_payment_date: policy.first_payment_date,
                inforce_date: policy.inforce_date,
                created_at: policy.created_at,
              },
            });
            return false;
          }

          // Create a new date object for comparison to avoid mutation
          const normalizedPolicyDate = new Date(policyDate);
          normalizedPolicyDate.setHours(0, 0, 0, 0);

          const isInRange =
            normalizedPolicyDate >= startDate &&
            normalizedPolicyDate <= endDate;

          console.log("Policy date check:", {
            policy_number: policy.policy_number,
            dateSource,
            policyDate: normalizedPolicyDate.toISOString(),
            startDate: startDate.toISOString(),
            endDate: endDate.toISOString(),
            isInRange,
          });

          return isInRange;
        });

        console.log("After date filter count:", result.length);
      }
    } else {
      console.log("Skipping date filter - showing all time");
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
      console.log("After search filter count:", result.length);
    }

    console.log("Final filtered results:", {
      totalPolicies: policies.length,
      filteredCount: result.length,
      dateRange: filters.dateRange,
      status: filters.status,
    });

    setFilteredPolicies(result);
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

  // Fetch agent profile for tenure calculation
  useEffect(() => {
    const fetchAgentProfile = async () => {
      try {
        console.log("Fetching agent profile...");
        const response = await fetch("/api/agent-profile");

        console.log("Agent profile response status:", response.status);

        if (!response.ok) {
          const errorData = await response.json();
          console.error("Failed to fetch agent profile:", errorData);
          // Don't block the component - allow it to work without a profile
          setAgentProfile(null);
          return;
        }

        const data = await response.json();
        console.log("Agent profile fetched successfully:", data);
        // Handle null response for new users
        setAgentProfile(data || null);
      } catch (error) {
        console.error("Error fetching agent profile:", error);
        // Don't block the component - allow it to work without a profile
        setAgentProfile(null);
      }
    };

    fetchAgentProfile();
  }, []);

  const calculateTenureMonths = () => {
    try {
      if (!agentProfile?.start_date) return 0;

      const startDate = new Date(agentProfile.start_date);
      const today = new Date();

      // Validate dates
      if (isNaN(startDate.getTime()) || isNaN(today.getTime())) {
        console.error("Invalid date in tenure calculation");
        return 0;
      }

      const months = differenceInMonths(today, startDate);
      return Math.max(0, months); // Ensure non-negative
    } catch (error) {
      console.error("Error calculating tenure months:", error);
      return 0;
    }
  };

  const getTenureBasedCommissionRate = (baseRate: number) => {
    try {
      const tenureMonths = calculateTenureMonths();

      // Apply tenure-based commission rate adjustments
      if (tenureMonths >= 24) {
        // 2+ years: 10% bonus
        return baseRate * 1.1;
      } else if (tenureMonths >= 12) {
        // 1+ year: 5% bonus
        return baseRate * 1.05;
      } else if (tenureMonths >= 6) {
        // 6+ months: 2% bonus
        return baseRate * 1.02;
      }

      // Less than 6 months: base rate
      return baseRate;
    } catch (error) {
      console.error("Error calculating tenure-based commission rate:", error);
      // Return base rate if there's an error
      return baseRate;
    }
  };

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
    setValue("date_commission_paid", policy.date_commission_paid || "");
    setValue("comments", policy.comments || "");
  };

  const onSubmitEdit = async (data: EditPolicyFormData) => {
    if (!user || !editingPolicy) return;

    try {
      // Convert empty date strings to null and ensure proper data types
      const baseCommissionRate = Number(data.commission_rate) / 100;
      const calculatedTenureRate = getTenureBasedCommissionRate(baseCommissionRate);
      
      // Database constraint only allows specific discrete values
      // Round to the nearest allowed commission rate value
      const allowedRates = [0.025, 0.05, 0.1, 0.2]; // 2.5%, 5%, 10%, 20%
      const tenureAdjustedRate = allowedRates.reduce((prev, curr) => {
        return Math.abs(curr - calculatedTenureRate) < Math.abs(prev - calculatedTenureRate) ? curr : prev;
      });

      // Validate that we have valid numbers
      if (isNaN(baseCommissionRate) || isNaN(tenureAdjustedRate)) {
        throw new Error("Invalid commission rate calculation");
      }

      const annualPremium = Number(data.commissionable_annual_premium);
      if (isNaN(annualPremium) || annualPremium < 0) {
        throw new Error("Invalid annual premium amount");
      }

      const formattedData = {
        client: data.client?.trim() || editingPolicy.client,
        carrier: data.carrier?.trim() || editingPolicy.carrier,
        policy_number: data.policy_number?.trim() || editingPolicy.policy_number,
        product: data.product?.trim() || editingPolicy.product,
        policy_status: data.policy_status || editingPolicy.policy_status,
        commissionable_annual_premium: annualPremium,
        commission_rate: tenureAdjustedRate,
        first_payment_date: data.first_payment_date || null,
        type_of_payment: data.type_of_payment || null,
        inforce_date: data.inforce_date || null,
        date_commission_paid: data.date_commission_paid || null,
        comments: data.comments || null,
      };

      // Note: commission_due is a generated column and will be automatically calculated by the database

      // Log the data being sent for debugging
      console.log("Updating policy with data:", formattedData);
      console.log("Policy ID:", editingPolicy.id);
      console.log("User ID:", user.id);
      console.log("Commission rate calculation:");
      console.log("- Original form value:", data.commission_rate);
      console.log("- Base commission rate:", baseCommissionRate);
      console.log("- Calculated tenure rate:", calculatedTenureRate);
      console.log("- Final rounded rate:", tenureAdjustedRate);
      console.log("- Tenure months:", calculateTenureMonths());
      if (calculatedTenureRate !== tenureAdjustedRate) {
        console.warn("Commission rate was rounded from", calculatedTenureRate, "to", tenureAdjustedRate, "to match database constraint (only discrete values allowed)");
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

      // Refresh policies
      await fetchPolicies();
      setEditingPolicy(null);
      reset();
    } catch (err) {
      console.error("Error updating policy:", err);
      setError("Failed to update policy");
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

  const handleSort = (field: SortField) => {
    setSort((prev) => ({
      field,
      direction:
        prev.field === field && prev.direction === "asc" ? "desc" : "asc",
    }));
  };

  const sortPolicies = (policies: Policy[]) => {
    return [...policies].sort((a, b) => {
      const aValue = a[sort.field];
      const bValue = b[sort.field];

      if (typeof aValue === "number" && typeof bValue === "number") {
        return sort.direction === "asc" ? aValue - bValue : bValue - aValue;
      }

      const aString = String(aValue).toLowerCase();
      const bString = String(bValue).toLowerCase();

      if (sort.direction === "asc") {
        return aString.localeCompare(bString);
      } else {
        return bString.localeCompare(aString);
      }
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
        <div className="text-center py-12 bg-white rounded-lg shadow">
          <svg
            className="mx-auto h-12 w-12 text-gray-400"
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
            <AddPolicyButton onPolicyAdded={fetchPolicies} />
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
        <div className="bg-white rounded-lg shadow p-4 md:p-6">
          <div className="flex items-center">
            <div className="p-2 md:p-3 rounded-full bg-green-100">
              <svg
                className="h-6 w-6 md:h-8 md:w-8 text-green-600"
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
              <h2 className="text-sm md:text-lg font-semibold text-gray-700">
                Active Policies
              </h2>
              <div className="mt-1 md:mt-2">
                <p className="text-xl md:text-3xl font-bold text-gray-900">
                  {summaryStats.active.count}
                </p>
                <p className="text-xs md:text-sm text-gray-600">
                  ${summaryStats.active.premium.toLocaleString()} in premiums
                </p>
                <p className="text-xs md:text-sm text-gray-600">
                  ${summaryStats.active.commission.toLocaleString()} in
                  commissions
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Pending Policies Card */}
        <div className="bg-white rounded-lg shadow p-4 md:p-6">
          <div className="flex items-center">
            <div className="p-2 md:p-3 rounded-full bg-yellow-100">
              <svg
                className="h-6 w-6 md:h-8 md:w-8 text-yellow-600"
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
              <h2 className="text-sm md:text-lg font-semibold text-gray-700">
                Pending Policies
              </h2>
              <div className="mt-1 md:mt-2">
                <p className="text-xl md:text-3xl font-bold text-gray-900">
                  {summaryStats.pending.count}
                </p>
                <p className="text-xs md:text-sm text-gray-600">
                  ${summaryStats.pending.premium.toLocaleString()} in premiums
                </p>
                <p className="text-xs md:text-sm text-gray-600">
                  ${summaryStats.pending.commission.toLocaleString()} in
                  commissions
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Cancelled Policies Card */}
        <div className="bg-white rounded-lg shadow p-4 md:p-6">
          <div className="flex items-center">
            <div className="p-2 md:p-3 rounded-full bg-red-100">
              <svg
                className="h-6 w-6 md:h-8 md:w-8 text-red-600"
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
            <div className="ml-3 md:ml-4">
              <h2 className="text-sm md:text-lg font-semibold text-gray-700">
                Cancelled Policies
              </h2>
              <div className="mt-1 md:mt-2">
                <p className="text-xl md:text-3xl font-bold text-gray-900">
                  {summaryStats.cancelled.count}
                </p>
                <p className="text-xs md:text-sm text-gray-600">
                  ${summaryStats.cancelled.premium.toLocaleString()} in premiums
                </p>
                <p className="text-xs md:text-sm text-gray-600">
                  ${summaryStats.cancelled.commission.toLocaleString()} in
                  commissions
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Tenure Info Card */}
      {agentProfile?.start_date && (
        <div className="bg-white rounded-lg shadow p-4 md:p-6 mb-6 md:mb-8">
          <div className="flex items-center">
            <div className="p-2 md:p-3 rounded-full bg-blue-100">
              <svg
                className="h-6 w-6 md:h-8 md:w-8 text-blue-600"
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
              <h2 className="text-sm md:text-lg font-semibold text-gray-700">
                Agent Tenure
              </h2>
              <p className="text-xl md:text-3xl font-bold text-gray-900">
                {calculateTenureMonths()} months
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="bg-white rounded-lg shadow p-4 md:p-6 mb-6">
        <h2 className="text-lg md:text-xl font-semibold text-gray-900 mb-4">
          Filters
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <label
              htmlFor="status"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Status
            </label>
            <select
              id="status"
              value={filters.status}
              onChange={(e) =>
                setFilters({ ...filters, status: e.target.value })
              }
              className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
            >
              <option value="all">All</option>
              <option value="Active">Active</option>
              <option value="Pending">Pending</option>
              <option value="Cancelled">Cancelled</option>
            </select>
          </div>

          <div>
            <label
              htmlFor="dateRange"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Date Range
            </label>
            <select
              id="dateRange"
              value={filters.dateRange}
              onChange={(e) =>
                setFilters({ ...filters, dateRange: e.target.value })
              }
              className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
            >
              <option value="all">All Time</option>
              <option value="month">Month</option>
              <option value="quarter">Quarter</option>
              <option value="year">Year</option>
              <option value="custom">Custom Range</option>
            </select>
          </div>

          {filters.dateRange === "custom" && (
            <>
              <div>
                <label
                  htmlFor="startDate"
                  className="block text-sm font-medium text-gray-700 mb-1"
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
                  className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                />
              </div>
              <div>
                <label
                  htmlFor="endDate"
                  className="block text-sm font-medium text-gray-700 mb-1"
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
                  className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                />
              </div>
            </>
          )}

          <div>
            <label
              htmlFor="search"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Search
            </label>
            <div className="relative">
              <input
                type="text"
                id="search"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="Search policies..."
                className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
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
                    d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                  />
                </svg>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Table Actions */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 md:mb-6">
        <h2 className="text-lg md:text-xl font-semibold text-gray-900 mb-4 sm:mb-0">
          Policies
        </h2>
        <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-2 w-full sm:w-auto">
          <AddPolicyButton onPolicyAdded={fetchPolicies} />
        </div>
      </div>

      {/* Table */}
      <div className="bg-white shadow overflow-hidden rounded-lg">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
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
                    {sort.field === "client" && (
                      <span className="ml-1">
                        {sort.direction === "asc" ? "↑" : "↓"}
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
                    {sort.field === "carrier" && (
                      <span className="ml-1">
                        {sort.direction === "asc" ? "↑" : "↓"}
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
                    {sort.field === "policy_number" && (
                      <span className="ml-1">
                        {sort.direction === "asc" ? "↑" : "↓"}
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
                    {sort.field === "product" && (
                      <span className="ml-1">
                        {sort.direction === "asc" ? "↑" : "↓"}
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
                    {sort.field === "policy_status" && (
                      <span className="ml-1">
                        {sort.direction === "asc" ? "↑" : "↓"}
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
                    {sort.field === "commissionable_annual_premium" && (
                      <span className="ml-1">
                        {sort.direction === "asc" ? "↑" : "↓"}
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
                    {sort.field === "commission_due" && (
                      <span className="ml-1">
                        {sort.direction === "asc" ? "↑" : "↓"}
                      </span>
                    )}
                  </button>
                </th>
                <th
                  scope="col"
                  className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                >
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredPolicies.length === 0 ? (
                <tr>
                  <td
                    colSpan={8}
                    className="px-3 py-4 text-center text-sm text-gray-500"
                  >
                    No policies found. Try adjusting your filters.
                  </td>
                </tr>
              ) : (
                sortedAndFilteredPolicies.map((policy) => (
                  <tr key={policy.id}>
                    <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-900">
                      {policy.client}
                    </td>
                    <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-900">
                      {policy.carrier}
                    </td>
                    <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-900">
                      {policy.policy_number}
                    </td>
                    <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-900">
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
                    <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-900">
                      ${policy.commissionable_annual_premium.toLocaleString()}
                    </td>
                    <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-900">
                      ${policy.commission_due.toLocaleString()}
                    </td>
                    <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-500">
                      <div className="flex space-x-2">
                        <button
                          onClick={() => handleEdit(policy)}
                          className="text-blue-600 hover:text-blue-900"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => setPolicyToDelete(policy)}
                          className="text-red-600 hover:text-red-900"
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
            ${totalCommission.toLocaleString()}
          </p>
        </div>
      </div>

      {/* Edit Policy Modal */}
      {editingPolicy && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center">
          <div className="bg-white p-8 rounded-lg w-full max-w-2xl">
            <h2 className="text-2xl font-bold mb-4">Edit Policy</h2>
            <form onSubmit={handleSubmit(onSubmitEdit)} className="space-y-4">
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
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Date Commission Paid
                  </label>
                  <input
                    type="date"
                    {...register("date_commission_paid")}
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
                  onClick={() => {
                    setEditingPolicy(null);
                    reset();
                  }}
                  className="bg-gray-200 text-gray-800 px-4 py-2 rounded-md hover:bg-gray-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {policyToDelete && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg w-full max-w-md">
            <h2 className="text-xl font-bold mb-4">Confirm Deletion</h2>
            <p className="mb-6">
              Are you sure you want to delete the policy for{" "}
              <span className="font-semibold">{policyToDelete.client}</span>? This action cannot be undone.
            </p>
            <div className="flex justify-end space-x-4">
              <button
                onClick={() => setPolicyToDelete(null)}
                className="bg-gray-200 text-gray-800 px-4 py-2 rounded-md hover:bg-gray-300"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDelete(policyToDelete.id)}
                className="bg-red-600 text-white px-4 py-2 rounded-md hover:bg-red-700"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
});

PolicyTable.displayName = "PolicyTable";

export default PolicyTable;

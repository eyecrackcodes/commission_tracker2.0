"use client";

import { useState, useEffect, useCallback } from "react";
import { supabase, Policy } from "@/lib/supabase";
import { useUser } from "@clerk/nextjs";
import { format } from "date-fns";
import { useForm } from "react-hook-form";
import { CSVLink } from "react-csv";

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

export default function PolicyTable() {
  const [policies, setPolicies] = useState<Policy[]>([]);
  const [filteredPolicies, setFilteredPolicies] = useState<Policy[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingPolicy, setEditingPolicy] = useState<Policy | null>(null);
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

  const { user } = useUser();
  const { register, handleSubmit, reset, setValue } =
    useForm<EditPolicyFormData>();

  useEffect(() => {
    if (user) {
      fetchPolicies();
    }
  }, [user]);

  useEffect(() => {
    applyFilters();
  }, [policies, filters, searchInput]);

  // Debounced search effect
  useEffect(() => {
    const timer = setTimeout(() => {
      setFilters((prev) => ({ ...prev, searchTerm: searchInput }));
    }, 300); // 300ms delay

    return () => clearTimeout(timer);
  }, [searchInput]);

  const applyFilters = () => {
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
        (policy) => policy.policy_status === filters.status
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
  };

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

  const fetchPolicies = async () => {
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
      // Convert empty date strings to null
      const formattedData = {
        ...data,
        commission_rate: data.commission_rate / 100,
        first_payment_date: data.first_payment_date || null,
        inforce_date: data.inforce_date || null,
        date_commission_paid: data.date_commission_paid || null,
      };

      const { error } = await supabase
        .from("policies")
        .update(formattedData)
        .eq("id", editingPolicy.id)
        .eq("user_id", user.id);

      if (error) {
        console.error("Supabase error:", error);
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

  const handleSearch = () => {
    setFilters((prev) => ({ ...prev, searchTerm: searchInput }));
  };

  const clearSearch = () => {
    setSearchInput("");
    setFilters((prev) => ({ ...prev, searchTerm: "" }));
  };

  const csvHeaders = [
    { label: "Client", key: "client" },
    { label: "Carrier", key: "carrier" },
    { label: "Policy Number", key: "policy_number" },
    { label: "Product", key: "product" },
    { label: "Status", key: "policy_status" },
    { label: "Premium", key: "commissionable_annual_premium" },
    { label: "Commission Rate", key: "commission_rate" },
    { label: "Commission", key: "commission_due" },
    { label: "First Payment Date", key: "first_payment_date" },
    { label: "Inforce Date", key: "inforce_date" },
  ];

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
      </div>
    );
  }

  return (
    <>
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center">
            <div className="p-3 rounded-full bg-green-100">
              <svg
                className="h-8 w-8 text-green-600"
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
            <div className="ml-4">
              <h2 className="text-lg font-semibold text-gray-700">
                Active Policies
              </h2>
              <div className="mt-2">
                <p className="text-3xl font-bold text-gray-900">
                  {summaryStats.active.count}
                </p>
                <div className="mt-2 space-y-1">
                  <p className="text-sm text-gray-600">
                    Premium: ${summaryStats.active.premium.toLocaleString()}
                  </p>
                  <p className="text-sm text-gray-600">
                    Commission: $
                    {summaryStats.active.commission.toLocaleString()}
                  </p>
                  <p className="text-sm text-gray-600">
                    Avg. Rate:{" "}
                    {(
                      (summaryStats.active.commission /
                        summaryStats.active.premium) *
                      100
                    ).toFixed(1)}
                    %
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center">
            <div className="p-3 rounded-full bg-yellow-100">
              <svg
                className="h-8 w-8 text-yellow-600"
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
            <div className="ml-4">
              <h2 className="text-lg font-semibold text-gray-700">
                Pending Policies
              </h2>
              <div className="mt-2">
                <p className="text-3xl font-bold text-gray-900">
                  {summaryStats.pending.count}
                </p>
                <div className="mt-2 space-y-1">
                  <p className="text-sm text-gray-600">
                    Premium: ${summaryStats.pending.premium.toLocaleString()}
                  </p>
                  <p className="text-sm text-gray-600">
                    Commission: $
                    {summaryStats.pending.commission.toLocaleString()}
                  </p>
                  <p className="text-sm text-gray-600">
                    Avg. Rate:{" "}
                    {(
                      (summaryStats.pending.commission /
                        summaryStats.pending.premium) *
                      100
                    ).toFixed(1)}
                    %
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center">
            <div className="p-3 rounded-full bg-red-100">
              <svg
                className="h-8 w-8 text-red-600"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </div>
            <div className="ml-4">
              <h2 className="text-lg font-semibold text-gray-700">
                Cancelled Policies
              </h2>
              <div className="mt-2">
                <p className="text-3xl font-bold text-gray-900">
                  {summaryStats.cancelled.count}
                </p>
                <div className="mt-2 space-y-1">
                  <p className="text-sm text-gray-600">
                    Premium: ${summaryStats.cancelled.premium.toLocaleString()}
                  </p>
                  <p className="text-sm text-gray-600">
                    Commission: $
                    {summaryStats.cancelled.commission.toLocaleString()}
                  </p>
                  <p className="text-sm text-gray-600">
                    Avg. Rate:{" "}
                    {(
                      (summaryStats.cancelled.commission /
                        summaryStats.cancelled.premium) *
                      100
                    ).toFixed(1)}
                    %
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow p-6 mb-8">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">
              Status
            </label>
            <select
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
              value={filters.status}
              onChange={(e) =>
                setFilters({ ...filters, status: e.target.value })
              }
            >
              <option value="all">All Statuses</option>
              <option value="Active">Active</option>
              <option value="Pending">Pending</option>
              <option value="Cancelled">Cancelled</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">
              Date Range
            </label>
            <select
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
              value={filters.dateRange}
              onChange={(e) =>
                setFilters({ ...filters, dateRange: e.target.value })
              }
            >
              <option value="all">All Time</option>
              <option value="month">Last Month</option>
              <option value="quarter">Last Quarter</option>
              <option value="year">Last Year</option>
              <option value="custom">Custom Range</option>
            </select>
          </div>

          {filters.dateRange === "custom" && (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Start Date
                </label>
                <input
                  type="date"
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  value={filters.startDate}
                  onChange={(e) =>
                    setFilters({ ...filters, startDate: e.target.value })
                  }
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  End Date
                </label>
                <input
                  type="date"
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  value={filters.endDate}
                  onChange={(e) =>
                    setFilters({ ...filters, endDate: e.target.value })
                  }
                />
              </div>
            </>
          )}

          <div
            className={filters.dateRange === "custom" ? "md:col-span-4" : ""}
          >
            <label className="block text-sm font-medium text-gray-700">
              Search
            </label>
            <div className="mt-1 flex rounded-md shadow-sm">
              <input
                type="text"
                className="flex-1 rounded-l-md border-gray-300 focus:border-blue-500 focus:ring-blue-500"
                placeholder="Search policies..."
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                onKeyPress={(e) => {
                  if (e.key === "Enter") {
                    handleSearch();
                  }
                }}
              />
              <button
                type="button"
                onClick={handleSearch}
                className="inline-flex items-center px-4 py-2 border border-l-0 border-gray-300 text-sm font-medium rounded-r-md text-gray-700 bg-gray-50 hover:bg-gray-100 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
              >
                <svg
                  className="h-4 w-4 text-gray-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                  />
                </svg>
              </button>
              {searchInput && (
                <button
                  type="button"
                  onClick={clearSearch}
                  className="ml-2 inline-flex items-center px-3 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-gray-50 hover:bg-gray-100 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                >
                  Clear
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-900">
          Commission Dashboard
        </h1>
        <div className="space-x-4">
          <CSVLink
            data={filteredPolicies}
            headers={csvHeaders}
            filename={`commission-report-${
              new Date().toISOString().split("T")[0]
            }.csv`}
            className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
          >
            <svg
              className="mr-2 h-5 w-5 text-gray-500"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
              />
            </svg>
            Export to CSV
          </CSVLink>
          <button
            onClick={() => setShowAddModal(true)}
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
          >
            Add Policy
          </button>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full bg-white shadow-md rounded-lg">
          <thead className="bg-gray-50">
            <tr>
              {[
                { label: "CLIENT", field: "client" },
                { label: "CARRIER", field: "carrier" },
                { label: "POLICY #", field: "policy_number" },
                { label: "PRODUCT", field: "product" },
                { label: "STATUS", field: "policy_status" },
                { label: "PREMIUM", field: "commissionable_annual_premium" },
                { label: "RATE", field: "commission_rate" },
                { label: "COMMISSION", field: "commission_due" },
                { label: "ACTIONS", field: null },
              ].map((column) => (
                <th
                  key={column.label}
                  scope="col"
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                >
                  {column.field ? (
                    <button
                      className="group inline-flex items-center space-x-1"
                      onClick={() =>
                        column.field && handleSort(column.field as SortField)
                      }
                    >
                      <span>{column.label}</span>
                      <span className="ml-2 flex-none rounded text-gray-400">
                        {sort.field === column.field
                          ? sort.direction === "desc"
                            ? "↓"
                            : "↑"
                          : "↕"}
                      </span>
                    </button>
                  ) : (
                    column.label
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sortedAndFilteredPolicies.map((policy) => (
              <tr key={policy.id} className="hover:bg-gray-50">
                <td className="px-6 py-4 whitespace-nowrap">{policy.client}</td>
                <td className="px-6 py-4 whitespace-nowrap">
                  {policy.carrier}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  {policy.policy_number}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  {policy.product}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span
                    className={`px-2 py-1 rounded-full text-xs font-medium ${
                      policy.policy_status === "Active"
                        ? "bg-green-100 text-green-800"
                        : policy.policy_status === "Pending"
                        ? "bg-yellow-100 text-yellow-800"
                        : "bg-red-100 text-red-800"
                    }`}
                  >
                    {policy.policy_status}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  ${policy.commissionable_annual_premium.toLocaleString()}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  {(policy.commission_rate * 100).toFixed(0)}%
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  ${policy.commission_due.toLocaleString()}
                </td>
                <td className="px-6 py-4 whitespace-nowrap space-x-2">
                  <button
                    onClick={() => handleEdit(policy)}
                    className="text-blue-600 hover:text-blue-900"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleDelete(policy.id)}
                    className="text-red-600 hover:text-red-900"
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot className="bg-gray-50">
            <tr>
              <td colSpan={7} className="px-6 py-4 text-right font-bold">
                Total Commission:
              </td>
              <td className="px-6 py-4 font-bold">
                <div className="space-y-1">
                  <p>
                    $
                    {filteredPolicies
                      .reduce((sum, policy) => sum + policy.commission_due, 0)
                      .toLocaleString()}
                  </p>
                  <p className="text-sm text-gray-600">
                    Avg. Rate:{" "}
                    {(
                      (filteredPolicies.reduce(
                        (sum, policy) => sum + policy.commission_due,
                        0
                      ) /
                        filteredPolicies.reduce(
                          (sum, policy) =>
                            sum + policy.commissionable_annual_premium,
                          0
                        )) *
                      100
                    ).toFixed(1)}
                    %
                  </p>
                </div>
              </td>
              <td></td>
            </tr>
          </tfoot>
        </table>
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
    </>
  );
}

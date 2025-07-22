"use client";

import { useState, useCallback } from "react";
import PolicyTable from "@/components/PolicyTable";
import AgentProfile from "@/components/AgentProfile";
import InsightsDashboard from "@/components/InsightsDashboard";
import CommissionPipeline from "@/components/CommissionPipeline";

export default function DashboardContent() {
  const [activeTab, setActiveTab] = useState<
    "policies" | "profile" | "insights" | "pipeline"
  >("policies");
  
  // Refresh key to trigger re-fetching in other components when policies change
  const [refreshKey, setRefreshKey] = useState(0);
  
  const handlePolicyUpdate = useCallback(() => {
    setRefreshKey(prev => prev + 1);
  }, []);

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Commission Dashboard</h1>
        <div className="flex space-x-4">
          <button
            onClick={() => setActiveTab("policies")}
            className={`${
              activeTab === "policies"
                ? "bg-blue-500 text-white dark:bg-blue-600"
                : "bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-300"
            } px-4 py-2 rounded-md transition-colors`}
          >
            Policies
          </button>
          <button
            onClick={() => setActiveTab("pipeline")}
            className={`${
              activeTab === "pipeline"
                ? "bg-blue-500 text-white dark:bg-blue-600"
                : "bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-300"
            } px-4 py-2 rounded-md transition-colors`}
          >
            Pipeline
          </button>
          <button
            onClick={() => setActiveTab("insights")}
            className={`${
              activeTab === "insights"
                ? "bg-blue-500 text-white dark:bg-blue-600"
                : "bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-300"
            } px-4 py-2 rounded-md transition-colors`}
          >
            Insights
          </button>
          <button
            onClick={() => setActiveTab("profile")}
            className={`${
              activeTab === "profile"
                ? "bg-blue-500 text-white dark:bg-blue-600"
                : "bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-300"
            } px-4 py-2 rounded-md transition-colors`}
          >
            Profile
          </button>
        </div>
      </div>

      {activeTab === "policies" && <PolicyTable onPolicyUpdate={handlePolicyUpdate} />}
      {activeTab === "pipeline" && <CommissionPipeline key={refreshKey} />}
      {activeTab === "insights" && <InsightsDashboard key={refreshKey} />}
      {activeTab === "profile" && <AgentProfile />}
    </div>
  );
}

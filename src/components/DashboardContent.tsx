"use client";

import { useState } from "react";
import PolicyTable from "@/components/PolicyTable";
import AgentProfile from "@/components/AgentProfile";
import InsightsDashboard from "@/components/InsightsDashboard";
import CommissionPipeline from "@/components/CommissionPipeline";

export default function DashboardContent() {
  const [activeTab, setActiveTab] = useState<
    "policies" | "profile" | "insights" | "pipeline"
  >("policies");

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold">Commission Dashboard</h1>
        <div className="flex space-x-4">
          <button
            onClick={() => setActiveTab("policies")}
            className={`${
              activeTab === "policies"
                ? "bg-blue-500 text-white"
                : "bg-gray-200 text-gray-700"
            } px-4 py-2 rounded-md transition-colors`}
          >
            Policies
          </button>
          <button
            onClick={() => setActiveTab("pipeline")}
            className={`${
              activeTab === "pipeline"
                ? "bg-blue-500 text-white"
                : "bg-gray-200 text-gray-700"
            } px-4 py-2 rounded-md transition-colors`}
          >
            Pipeline
          </button>
          <button
            onClick={() => setActiveTab("insights")}
            className={`${
              activeTab === "insights"
                ? "bg-blue-500 text-white"
                : "bg-gray-200 text-gray-700"
            } px-4 py-2 rounded-md transition-colors`}
          >
            Insights
          </button>
          <button
            onClick={() => setActiveTab("profile")}
            className={`${
              activeTab === "profile"
                ? "bg-blue-500 text-white"
                : "bg-gray-200 text-gray-700"
            } px-4 py-2 rounded-md transition-colors`}
          >
            Profile
          </button>
        </div>
      </div>

      {activeTab === "policies" && <PolicyTable />}
      {activeTab === "pipeline" && <CommissionPipeline />}
      {activeTab === "insights" && <InsightsDashboard />}
      {activeTab === "profile" && <AgentProfile />}
    </div>
  );
}

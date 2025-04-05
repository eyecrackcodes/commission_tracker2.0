"use client";

import { useRef, useState } from "react";
import PolicyTable from "@/components/PolicyTable";
import AddPolicyButton from "@/components/AddPolicyButton";
import AgentProfile from "@/components/AgentProfile";

export default function DashboardContent() {
  const policyTableRef = useRef<{ fetchPolicies: () => void }>();
  const [activeTab, setActiveTab] = useState<"policies" | "profile">(
    "policies"
  );

  const handlePolicyAdded = () => {
    policyTableRef.current?.fetchPolicies();
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold text-gray-900">
          Commission Dashboard
        </h1>
        {activeTab === "policies" && (
          <AddPolicyButton onPolicyAdded={handlePolicyAdded} />
        )}
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200 mb-8">
        <nav className="-mb-px flex space-x-8">
          <button
            onClick={() => setActiveTab("policies")}
            className={`${
              activeTab === "policies"
                ? "border-blue-500 text-blue-600"
                : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
            } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}
          >
            Policies
          </button>
          <button
            onClick={() => setActiveTab("profile")}
            className={`${
              activeTab === "profile"
                ? "border-blue-500 text-blue-600"
                : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
            } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}
          >
            Profile
          </button>
        </nav>
      </div>

      {/* Content */}
      {activeTab === "policies" ? (
        <PolicyTable ref={policyTableRef} />
      ) : (
        <AgentProfile />
      )}
    </div>
  );
}

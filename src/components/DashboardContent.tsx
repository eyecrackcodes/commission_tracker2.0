"use client";

import { useRef } from "react";
import PolicyTable from "@/components/PolicyTable";
import AddPolicyButton from "@/components/AddPolicyButton";

export default function DashboardContent() {
  const policyTableRef = useRef<{ fetchPolicies: () => void }>();

  const handlePolicyAdded = () => {
    policyTableRef.current?.fetchPolicies();
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold text-gray-900">
          Commission Dashboard
        </h1>
        <AddPolicyButton onPolicyAdded={handlePolicyAdded} />
      </div>
      <PolicyTable ref={policyTableRef} />
    </div>
  );
}

"use client";

import { useState } from "react";
import { useUser } from "@clerk/nextjs";

export default function TestAgentProfile() {
  const { user } = useUser();
  const [result, setResult] = useState<string>("");
  const [loading, setLoading] = useState(false);

  const createAgentProfile = async () => {
    if (!user) {
      setResult("You must be logged in to create an agent profile");
      return;
    }

    setLoading(true);
    try {
      const response = await fetch("/api/create-agent-profile", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ userId: user.id }),
      });

      const data = await response.json();
      setResult(JSON.stringify(data, null, 2));
    } catch (error) {
      setResult(
        `Error: ${error instanceof Error ? error.message : String(error)}`
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container mx-auto p-8">
      <h1 className="text-2xl font-bold mb-4">Test Agent Profile Creation</h1>

      <div className="mb-4">
        <p className="mb-2">Current user: {user ? user.id : "Not logged in"}</p>
        <button
          onClick={createAgentProfile}
          disabled={!user || loading}
          className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded disabled:opacity-50"
        >
          {loading ? "Creating..." : "Create Agent Profile"}
        </button>
      </div>

      {result && (
        <div className="mt-4">
          <h2 className="text-xl font-semibold mb-2">Result:</h2>
          <pre className="bg-gray-100 p-4 rounded overflow-auto max-h-96">
            {result}
          </pre>
        </div>
      )}
    </div>
  );
}

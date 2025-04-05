"use client";

import { useState, useEffect, useCallback } from "react";
import { useUser } from "@clerk/nextjs";

interface AgentProfile {
  id: number;
  user_id: string;
  start_date: string | null;
  license_number: string | null;
  specializations: string[] | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export default function AgentProfile() {
  const { user } = useUser();
  const [profile, setProfile] = useState<AgentProfile | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchProfile = useCallback(async () => {
    if (!user) return;

    try {
      const response = await fetch("/api/agent-profile");

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to load profile");
      }

      const data = await response.json();
      // Parse specializations if it's a string
      if (typeof data?.specializations === "string") {
        try {
          data.specializations = JSON.parse(data.specializations);
        } catch (e) {
          console.error("Error parsing specializations:", e);
          data.specializations = [];
        }
      }
      setProfile(data);
    } catch (err) {
      console.error("Error fetching profile:", err);
      setError("Failed to load profile");
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (user) {
      fetchProfile();
    }
  }, [user, fetchProfile]);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!user) return;

    setIsLoading(true);
    setError(null);

    const formData = new FormData(e.currentTarget);
    const startDate = formData.get("start_date") as string;
    const licenseNumber = formData.get("license_number") as string;
    const specializationsInput = formData.get("specializations") as string;
    const notes = formData.get("notes") as string;

    // Process specializations
    const specializations = specializationsInput
      ? specializationsInput
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean)
      : null;

    console.log("Submitting profile data:", {
      start_date: startDate || null,
      license_number: licenseNumber || null,
      specializations,
      notes: notes || null,
    });

    try {
      const response = await fetch("/api/agent-profile", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          start_date: startDate || null,
          license_number: licenseNumber || null,
          specializations,
          notes: notes || null,
        }),
      });

      console.log("Response status:", response.status);

      const responseData = await response.json();
      console.log("Response data:", responseData);

      if (!response.ok) {
        console.error("Error response:", responseData);
        throw new Error(responseData.error || "Failed to save profile");
      }

      // Parse specializations from the response data
      if (typeof responseData?.specializations === "string") {
        try {
          responseData.specializations = JSON.parse(
            responseData.specializations
          );
        } catch (e) {
          console.error("Error parsing specializations from response:", e);
          responseData.specializations = [];
        }
      }

      console.log("Profile saved successfully:", responseData);
      setProfile(responseData);
      setIsEditing(false);
      setError(null);
    } catch (err) {
      console.error("Error saving profile:", err);
      setError(
        "Failed to save profile: " +
          (err instanceof Error ? err.message : String(err))
      );
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6 md:py-8">
      <div className="bg-white shadow overflow-hidden rounded-lg">
        <div className="px-4 sm:px-6 py-5 md:py-6">
          <h2 className="text-lg md:text-xl font-semibold text-gray-900 mb-4 md:mb-6">
            Agent Profile
          </h2>

          {isLoading ? (
            <div className="flex justify-center items-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 md:h-10 md:w-10 border-b-2 border-blue-600"></div>
            </div>
          ) : error ? (
            <div className="bg-red-50 border border-red-200 rounded-md p-4">
              <div className="flex">
                <div className="flex-shrink-0">
                  <svg
                    className="h-5 w-5 text-red-400"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                </div>
                <div className="ml-3">
                  <h3 className="text-sm font-medium text-red-800">Error</h3>
                  <div className="mt-2 text-sm text-red-700">{error}</div>
                </div>
              </div>
            </div>
          ) : isEditing ? (
            <form onSubmit={handleSubmit} className="space-y-4 md:space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 md:gap-6">
                <div>
                  <label
                    htmlFor="start_date"
                    className="block text-sm font-medium text-gray-700 mb-1"
                  >
                    Start Date
                  </label>
                  <input
                    type="date"
                    id="start_date"
                    name="start_date"
                    defaultValue={profile?.start_date || ""}
                    className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label
                    htmlFor="license_number"
                    className="block text-sm font-medium text-gray-700 mb-1"
                  >
                    License Number
                  </label>
                  <input
                    type="text"
                    id="license_number"
                    name="license_number"
                    defaultValue={profile?.license_number || ""}
                    className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div>
                <label
                  htmlFor="specializations"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  Specializations (comma-separated)
                </label>
                <input
                  type="text"
                  id="specializations"
                  name="specializations"
                  defaultValue={
                    Array.isArray(profile?.specializations)
                      ? profile.specializations.join(", ")
                      : ""
                  }
                  placeholder="e.g., Life Insurance, Health Insurance"
                  className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                />
              </div>

              <div>
                <label
                  htmlFor="notes"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  Notes
                </label>
                <textarea
                  id="notes"
                  name="notes"
                  defaultValue={profile?.notes || ""}
                  rows={4}
                  className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                ></textarea>
              </div>

              <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-2">
                <button
                  type="submit"
                  className="inline-flex justify-center items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                >
                  Save Profile
                </button>
                <button
                  type="button"
                  onClick={() => setIsEditing(false)}
                  className="inline-flex justify-center items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                >
                  Cancel
                </button>
              </div>
            </form>
          ) : (
            <div className="space-y-4 md:space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 md:gap-6">
                <div>
                  <h3 className="text-sm font-medium text-gray-500">
                    Start Date
                  </h3>
                  <p className="mt-1 text-sm md:text-base text-gray-900">
                    {profile?.start_date
                      ? new Date(profile.start_date).toLocaleDateString()
                      : "Not set"}
                  </p>
                </div>

                <div>
                  <h3 className="text-sm font-medium text-gray-500">
                    License Number
                  </h3>
                  <p className="mt-1 text-sm md:text-base text-gray-900">
                    {profile?.license_number || "Not set"}
                  </p>
                </div>
              </div>

              <div>
                <h3 className="text-sm font-medium text-gray-500">
                  Specializations
                </h3>
                <p className="mt-1 text-sm md:text-base text-gray-900">
                  {Array.isArray(profile?.specializations)
                    ? profile.specializations.join(", ")
                    : "Not set"}
                </p>
              </div>

              <div>
                <h3 className="text-sm font-medium text-gray-500">Notes</h3>
                <p className="mt-1 text-sm md:text-base text-gray-900 whitespace-pre-wrap">
                  {profile?.notes || "No notes"}
                </p>
              </div>

              <div className="pt-4 md:pt-6">
                <button
                  onClick={() => setIsEditing(true)}
                  className="inline-flex justify-center items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                >
                  Edit Profile
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

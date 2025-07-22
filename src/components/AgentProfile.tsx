"use client";

import { useState, useEffect, useCallback } from "react";
import { useUser } from "@clerk/nextjs";

interface AgentProfile {
  id?: number | null;
  user_id: string;
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
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const fetchProfile = useCallback(async () => {
    if (!user) return;

    try {
      setError(null);
      const response = await fetch("/api/agent-profile");

      if (!response.ok) {
        const errorData = await response
          .json()
          .catch(() => ({ error: "Failed to load profile" }));
        throw new Error(errorData.error || "Failed to load profile");
      }

      const data = await response.json();
      
      // Handle the response - it will always have a structure now
      if (data) {
        // Ensure specializations is always an array
        if (!Array.isArray(data.specializations)) {
          data.specializations = data.specializations ? [data.specializations] : [];
        }
        setProfile(data);
      }
    } catch (err) {
      console.error("Error fetching profile:", err);
      setError(err instanceof Error ? err.message : "Failed to load profile");
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (user) {
      fetchProfile();
    } else {
      setIsLoading(false);
    }
  }, [user, fetchProfile]);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!user) return;

    setIsLoading(true);
    setError(null);
    setSuccessMessage(null);

    const formData = new FormData(e.currentTarget);
    const licenseNumber = formData.get("license_number") as string;
    const specializationsInput = formData.get("specializations") as string;
    const notes = formData.get("notes") as string;

    // Parse specializations from comma-separated string to array
    const specializations = specializationsInput
      ? specializationsInput
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean)
      : [];

    try {
      const response = await fetch("/api/agent-profile", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          license_number: licenseNumber || null,
          specializations: specializations.length > 0 ? specializations : null,
          notes: notes || null,
        }),
      });

      const responseData = await response.json();

      if (!response.ok) {
        throw new Error(responseData.error || "Failed to save profile");
      }

      // Ensure specializations is an array in the response
      if (!Array.isArray(responseData.specializations)) {
        responseData.specializations = responseData.specializations ? [responseData.specializations] : [];
      }

      setProfile(responseData);
      setIsEditing(false);
      setError(null);
      setSuccessMessage("Profile updated successfully!");

      // Clear success message after 3 seconds
      setTimeout(() => {
        setSuccessMessage(null);
      }, 3000);
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

  if (!user) {
    return (
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6 md:py-8">
        <div className="bg-white shadow overflow-hidden rounded-lg p-6">
          <p className="text-gray-600 text-center">Please sign in to view your profile.</p>
        </div>
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

          {successMessage && (
            <div className="mb-4 bg-green-50 border-l-4 border-green-400 p-4">
              <div className="flex">
                <div className="flex-shrink-0">
                  <svg
                    className="h-5 w-5 text-green-400"
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                  >
                    <path
                      fillRule="evenodd"
                      d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                      clipRule="evenodd"
                    />
                  </svg>
                </div>
                <div className="ml-3">
                  <p className="text-sm text-green-700">{successMessage}</p>
                </div>
              </div>
            </div>
          )}

          {error ? (
            <div className="bg-red-50 border border-red-200 rounded-md p-4 mb-4">
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
              <div className="grid grid-cols-1 gap-4 md:gap-6">
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

              <div className="flex justify-end space-x-3">
                <button
                  type="submit"
                  disabled={isLoading}
                  className="inline-flex justify-center items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isLoading ? "Saving..." : "Save Profile"}
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
              <div>
                <h3 className="text-sm font-medium text-gray-500">
                  License Number
                </h3>
                <p className="mt-1 text-sm md:text-base text-gray-900">
                  {profile?.license_number || "Not set"}
                </p>
              </div>

              <div>
                <h3 className="text-sm font-medium text-gray-500">
                  Specializations
                </h3>
                <p className="mt-1 text-sm md:text-base text-gray-900">
                  {Array.isArray(profile?.specializations) && profile.specializations.length > 0
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

              <div className="flex justify-end">
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

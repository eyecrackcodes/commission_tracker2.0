"use client";

import { useState } from "react";
import { useUser } from "@clerk/nextjs";

export default function TestCommissionUpdate() {
  const { user } = useUser();
  const [result, setResult] = useState<string | null>("");
  const [loading, setLoading] = useState(false);
  const [showTroubleshooting] = useState(false);
  const [agentName, setAgentName] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [fixInstructions, setFixInstructions] = useState<string | null>(null);

  // Define interfaces for diagnostic info and result
  interface DiagnosticInfo {
    details?: string;
    errorType?: string;
    channelId?: string;
    botTokenExists?: boolean;
  }

  interface DiagnosticResult {
    success?: boolean;
    message?: string;
    details?: {
      botName?: string;
      botId?: string;
      channelName?: string;
      channelId?: string;
      messageTs?: string;
    };
  }

  const [diagnosticInfo, setDiagnosticInfo] = useState<DiagnosticInfo | null>(
    null
  );
  const [diagnosticResult, setDiagnosticResult] =
    useState<DiagnosticResult | null>(null);

  const testCommissionRateUpdate = async () => {
    setLoading(true);
    try {
      // Call the update-commission-rates API endpoint
      const response = await fetch("/api/update-commission-rates", {
        method: "GET",
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

  const modifyAgentStartDate = async () => {
    if (!user) {
      setResult("You must be logged in to modify an agent profile");
      return;
    }

    setLoading(true);
    try {
      // Calculate a date 7 months ago
      const today = new Date();
      const sevenMonthsAgo = new Date();
      sevenMonthsAgo.setMonth(today.getMonth() - 7);
      const formattedDate = sevenMonthsAgo.toISOString().split("T")[0];

      // Call the modify-agent-profile API endpoint
      const response = await fetch("/api/modify-agent-profile", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          userId: user.id,
          startDate: formattedDate,
        }),
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

  const resetNotificationDate = async () => {
    if (!user) {
      setError("You must be logged in to reset notification date");
      return;
    }

    setLoading(true);
    setError(null);
    setResult(null);
    setFixInstructions(null);
    setDiagnosticInfo(null);

    try {
      // Call the API to reset the notification date
      const response = await fetch("/api/reset-notification-date", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          userId: user.id,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Failed to reset notification date");
        if (data.fixInstructions) {
          setFixInstructions(data.fixInstructions);
        }
        if (data.diagnosticInfo) {
          setDiagnosticInfo(data.diagnosticInfo);
        }
        return;
      }

      setResult(JSON.stringify(data, null, 2));
    } catch (error) {
      setError("An error occurred while resetting notification date");
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const testSlackNotification = async () => {
    if (!user) {
      setError("You must be logged in to test Slack notifications");
      return;
    }

    setLoading(true);
    setError(null);
    setResult(null);
    setFixInstructions(null);
    setDiagnosticInfo(null);

    try {
      const response = await fetch("/api/slack/notify", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          type: "commission_rate_change",
          data: {
            userId: user.id,
            oldRate: 0.05,
            newRate: 0.2,
            agentName: agentName || undefined,
          },
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Failed to send Slack notification");
        if (data.fixInstructions) {
          setFixInstructions(data.fixInstructions);
        }
        if (data.diagnosticInfo) {
          setDiagnosticInfo(data.diagnosticInfo);
        }
        return;
      }

      // Format the response data
      const formattedResult = {
        success: data.success || false,
        message: data.message || "Slack notification sent successfully",
      };

      // Set the formatted result
      setResult(JSON.stringify(formattedResult, null, 2));
      setError(null);
      setFixInstructions(
        "Slack notification sent successfully! Check your Slack channel."
      );
    } catch (err) {
      setError("An error occurred while sending Slack notification");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const runSlackDiagnostic = async () => {
    setLoading(true);
    setError(null);
    setResult(null);
    setFixInstructions(null);
    setDiagnosticInfo(null);
    setDiagnosticResult(null);

    try {
      const response = await fetch("/api/slack/diagnose", {
        method: "GET",
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Diagnostic failed");
        if (data.fixInstructions) {
          setFixInstructions(data.fixInstructions);
        }
        if (data.details) {
          setDiagnosticInfo({ details: data.details });
        }
        return;
      }

      // Ensure we're storing a properly formatted object
      const formattedResult = {
        success: data.success || false,
        message: data.message || "Diagnostic completed successfully",
        details: data.details || {},
      };

      // Store the formatted data for the diagnostic result
      setDiagnosticResult(formattedResult);

      // Stringify the data for display
      setResult(JSON.stringify(formattedResult, null, 2));
    } catch (err) {
      setError("An error occurred while running the diagnostic");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container mx-auto p-8">
      <h1 className="text-2xl font-bold mb-4">Test Commission Rate Update</h1>

      <div className="mb-4">
        <p className="mb-2">Current user: {user ? user.id : "Not logged in"}</p>

        <div className="space-y-4">
          <button
            onClick={modifyAgentStartDate}
            disabled={!user || loading}
            className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded disabled:opacity-50 mr-4"
          >
            Set Start Date to 7 Months Ago
          </button>

          <button
            onClick={testCommissionRateUpdate}
            disabled={loading}
            className="bg-green-500 hover:bg-green-700 text-white font-bold py-2 px-4 rounded disabled:opacity-50 mr-4"
          >
            Test Commission Rate Update
          </button>

          <button
            onClick={resetNotificationDate}
            disabled={!user || loading}
            className="bg-yellow-500 hover:bg-yellow-700 text-white font-bold py-2 px-4 rounded disabled:opacity-50"
          >
            Reset Notification Date (for testing)
          </button>
        </div>
      </div>

      <div className="mb-6 p-4 bg-gray-100 rounded">
        <h2 className="text-xl font-semibold mb-4">Test Slack Notification</h2>

        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Agent Name (optional)
          </label>
          <input
            type="text"
            value={agentName}
            onChange={(e) => setAgentName(e.target.value)}
            placeholder="Enter agent name"
            className="w-full p-2 border border-gray-300 rounded"
          />
        </div>

        <div className="flex space-x-4">
          <button
            onClick={testSlackNotification}
            disabled={loading}
            className="bg-purple-500 hover:bg-purple-700 text-white font-bold py-2 px-4 rounded disabled:opacity-50"
          >
            Test Slack Notification
          </button>

          <button
            onClick={runSlackDiagnostic}
            disabled={loading}
            className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded disabled:opacity-50"
          >
            Run Slack Diagnostic
          </button>
        </div>
      </div>

      {result && (
        <div className="mt-4">
          <h2 className="text-xl font-semibold mb-2">Result:</h2>
          <pre className="bg-gray-100 p-4 rounded overflow-auto max-h-96">
            {result}
          </pre>
        </div>
      )}

      {showTroubleshooting && (
        <div className="mt-6 p-4 bg-yellow-50 border border-yellow-200 rounded">
          <h2 className="text-xl font-semibold mb-2 text-yellow-800">
            Slack Troubleshooting Tips
          </h2>
          <ul className="list-disc pl-5 space-y-2 text-yellow-700">
            <li>
              <strong>Channel ID Issue:</strong> Make sure your{" "}
              <code>SLACK_CHANNEL_ID</code> environment variable is correct.
              Channel IDs typically start with &quot;C&quot; followed by a
              string of characters.
            </li>
            <li>
              <strong>Bot Not in Channel:</strong> Your Slack bot needs to be
              invited to the channel before it can post messages. In Slack, type{" "}
              <code>/invite @YourBotName</code> in the channel.
            </li>
            <li>
              <strong>Bot Permissions:</strong> Ensure your Slack app has the{" "}
              <code>chat:write</code> scope enabled.
            </li>
            <li>
              <strong>Environment Variables:</strong> Check that your{" "}
              <code>SLACK_BOT_TOKEN</code> and <code>SLACK_CHANNEL_ID</code>
              are correctly set in your environment.
            </li>
            <li>
              <strong>Restart Your Server:</strong> After updating environment
              variables, restart your development server.
            </li>
          </ul>
        </div>
      )}

      {error && (
        <div className="bg-red-50 border-l-4 border-red-400 p-4 mb-4">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg
                className="h-5 w-5 text-red-400"
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 20 20"
                fill="currentColor"
                aria-hidden="true"
              >
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                  clipRule="evenodd"
                />
              </svg>
            </div>
            <div className="ml-3">
              <p className="text-sm text-red-700">{error}</p>
            </div>
          </div>
        </div>
      )}

      {fixInstructions && (
        <div className="bg-blue-50 border-l-4 border-blue-400 p-4 mb-4">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg
                className="h-5 w-5 text-blue-400"
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 20 20"
                fill="currentColor"
                aria-hidden="true"
              >
                <path
                  fillRule="evenodd"
                  d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
                  clipRule="evenodd"
                />
              </svg>
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-blue-800">
                How to fix this issue:
              </h3>
              <div className="mt-2 text-sm text-blue-700">
                <pre className="whitespace-pre-wrap">{fixInstructions}</pre>
              </div>
            </div>
          </div>
        </div>
      )}

      {diagnosticInfo && (
        <div className="bg-gray-50 border border-gray-200 p-4 mb-4 rounded">
          <h3 className="text-sm font-medium text-gray-800 mb-2">
            Diagnostic Information:
          </h3>
          <div className="bg-gray-100 p-3 rounded overflow-auto max-h-60">
            <pre className="text-xs text-gray-700">
              {JSON.stringify(diagnosticInfo, null, 2)}
            </pre>
          </div>
        </div>
      )}

      {diagnosticResult && (
        <div className="bg-green-50 border-l-4 border-green-400 p-4 mb-4">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg
                className="h-5 w-5 text-green-400"
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 20 20"
                fill="currentColor"
                aria-hidden="true"
              >
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                  clipRule="evenodd"
                />
              </svg>
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-green-800">
                Slack Diagnostic Successful
              </h3>
              <div className="mt-2 text-sm text-green-700">
                <p>
                  {diagnosticResult.message ||
                    "Diagnostic completed successfully"}
                </p>
                <div className="mt-2 bg-green-100 p-2 rounded">
                  <pre className="text-xs">
                    {diagnosticResult.details
                      ? JSON.stringify(diagnosticResult.details, null, 2)
                      : "No details available"}
                  </pre>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

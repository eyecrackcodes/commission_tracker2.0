"use client";

import { useState } from "react";
import { useUser } from "@clerk/nextjs";
import Image from "next/image";
import { getBestUserName } from "@/lib/userUtils";

export default function TestSlackPage() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string>("");
  const { user } = useUser();

  const testSlackNotification = async (acronym: string = "TEST") => {
    setLoading(true);
    setResult("");
    
    try {
      const payload = {
        type: 'quick_post',
        data: {
          carrier: "Test Carrier",
          product: "Test Product",
          premium: 1000,
          acronym: acronym,
          userName: user ? getBestUserName(user) : "Test User"
        }
      };

      const response = await fetch('/api/slack-notification', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const data = await response.json();
      
      if (response.ok) {
        setResult(`✅ Success! Slack quick post sent.`);
      } else {
        setResult(`❌ Error: ${data.error || 'Unknown error'}\n${data.details || ''}`);
      }
    } catch (error) {
      setResult(`❌ Network error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-3xl font-bold mb-8">Test Slack Integration</h1>
        
        {user && (
          <div className="bg-white rounded-lg p-6 mb-6 shadow">
            <h2 className="text-xl font-semibold mb-4">Current User</h2>
            <div className="flex items-center space-x-4">
              {user.imageUrl && (
                <Image 
                  src={user.imageUrl} 
                  alt={getBestUserName(user)}
                  width={64}
                  height={64}
                  className="w-16 h-16 rounded-full"
                />
              )}
              <div>
                <p className="font-medium">{getBestUserName(user)}</p>
                <p className="text-gray-600">{user.emailAddresses[0]?.emailAddress}</p>
              </div>
            </div>
          </div>
        )}
        
        <div className="bg-white rounded-lg p-6 shadow">
          <h2 className="text-xl font-semibold mb-4">Test Quick Post</h2>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Test Acronym
              </label>
              <input
                type="text"
                defaultValue="TEST"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                id="test-acronym"
                placeholder="Enter test acronym (e.g., WIN, SALE)"
              />
            </div>
            
            <button
              onClick={() => {
                const acronym = (document.getElementById('test-acronym') as HTMLInputElement)?.value || 'TEST';
                testSlackNotification(acronym);
              }}
              disabled={loading || !user}
              className="w-full px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
            >
              {loading ? 'Sending...' : '⚡ Test Quick Post'}
            </button>
          </div>
          
          {result && (
            <div className={`mt-6 p-4 rounded-lg ${result.includes('✅') ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'}`}>
              <pre className="whitespace-pre-wrap text-sm">{result}</pre>
            </div>
          )}
          
          {!user && (
            <p className="mt-4 text-gray-600 text-center">Please sign in to test Slack notifications</p>
          )}
        </div>
        
        <div className="mt-8 bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <h3 className="font-semibold text-yellow-800 mb-2">⚠️ Configuration Required</h3>
          <p className="text-yellow-700 text-sm">
            Make sure you have set the following environment variables:
          </p>
          <ul className="list-disc list-inside mt-2 text-yellow-700 text-sm">
            <li>SLACK_BOT_TOKEN</li>
            <li>SLACK_CHANNEL_ID</li>
          </ul>
        </div>
      </div>
    </div>
  );
} 
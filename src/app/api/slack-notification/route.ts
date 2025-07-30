import { auth } from "@clerk/nextjs";
import { clerkClient } from "@clerk/nextjs";
import { NextRequest, NextResponse } from "next/server";
import { sendQuickPost, sendReconciliationAlert, sendCancellationCommissionAlert, sendReconciliationAlertV2 } from "@/lib/slack";

export async function POST(request: NextRequest) {
  try {
    const { userId } = auth();
    
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { type, data } = body;

    // Get user details from Clerk including profile picture
    const user = await clerkClient.users.getUser(userId);
    const userImageUrl = user.imageUrl;
    const userName = user.firstName && user.lastName 
      ? `${user.firstName} ${user.lastName}`
      : user.firstName || user.username || user.emailAddresses[0]?.emailAddress || 'Unknown';

    // Handle different notification types
    if (type === 'quick_post') {
      const result = await sendQuickPost(
        data.carrier,
        data.premium,
        userName,
        userImageUrl,
        data.customMessage
      );

      if (result) {
        return NextResponse.json({ success: true });
      } else {
        return NextResponse.json({ error: "Failed to send Slack notification" }, { status: 500 });
      }
    } else if (type === 'reconciliation_alert') {
      // Handle reconciliation discrepancy alerts
      const result = await sendReconciliationAlert(
        data.discrepancies,
        userName,
        userImageUrl
      );

      if (result) {
        return NextResponse.json({ success: true });
      } else {
        return NextResponse.json({ error: "Failed to send reconciliation alert" }, { status: 500 });
      }
    } else if (type === 'cancellation_alert') {
      // Handle cancelled policy commission removal alerts
      const result = await sendCancellationCommissionAlert(
        data.policyNumber,
        data.client,
        data.carrier,
        data.commissionAmount,
        data.cancelledDate,
        userName,
        userImageUrl
      );

      if (result) {
        return NextResponse.json({ success: true });
      } else {
        return NextResponse.json({ error: "Failed to send cancellation alert" }, { status: 500 });
      }
    } else if (type === 'reconciliation_alert_v2') {
      // Handle improved reconciliation alerts with grouped notifications
      const result = await sendReconciliationAlertV2(
        data.groups,
        data.paymentPeriod,
        userName,
        userImageUrl
      );

      if (result) {
        return NextResponse.json({ success: true });
      } else {
        return NextResponse.json({ error: "Failed to send reconciliation alert v2" }, { status: 500 });
      }
    } else {
      return NextResponse.json({ error: "Unsupported notification type" }, { status: 400 });
    }

  } catch (error) {
    console.error("Error in Slack notification API:", error);
    return NextResponse.json(
      { error: "Internal server error", details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
} 
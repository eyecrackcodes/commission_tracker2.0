import { auth } from "@clerk/nextjs";
import { clerkClient } from "@clerk/nextjs";
import { NextRequest, NextResponse } from "next/server";
import { sendQuickPolicyPost } from "@/lib/slack";

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

    // Only handle quick posts now
    if (type === 'quick_post') {
      const result = await sendQuickPolicyPost(
        data.carrier,
        data.product,
        data.premium,
        data.acronym || 'SALE',
        userName,
        userImageUrl
      );

      if (result) {
        return NextResponse.json({ success: true });
      } else {
        return NextResponse.json({ error: "Failed to send Slack notification" }, { status: 500 });
      }
    } else {
      return NextResponse.json({ error: "Only quick_post type is supported" }, { status: 400 });
    }


  } catch (error) {
    console.error("Error in Slack notification API:", error);
    return NextResponse.json(
      { error: "Internal server error", details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
} 
import { NextResponse } from "next/server";
import { resetNotificationData } from "@/lib/notification-tracker-server";

export async function POST(request: Request) {
  try {
    const { userId } = await request.json();

    if (!userId) {
      return NextResponse.json(
        { error: "User ID is required" },
        { status: 400 }
      );
    }

    // Reset the notification data for this user
    resetNotificationData(userId);

    return NextResponse.json({
      message: "Notification date reset successfully",
      userId,
    });
  } catch (error) {
    console.error("Error resetting notification date:", error);
    return NextResponse.json(
      { error: "Failed to reset notification date" },
      { status: 500 }
    );
  }
}

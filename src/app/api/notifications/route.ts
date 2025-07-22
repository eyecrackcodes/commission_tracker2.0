import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { getAgentNotifications } from "@/lib/notifications";

// Initialize Supabase client with service role key for admin access
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  throw new Error("Missing Supabase URL or service role key");
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

// GET endpoint for fetching user notifications
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    if (!userId) {
      return NextResponse.json(
        { error: "User ID is required" },
        { status: 400 }
      );
    }

    // Fetch policies for the user
    const { data: policies, error: policiesError } = await supabase
      .from("policies")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    if (policiesError) {
      throw policiesError;
    }

    // Generate notifications
    const notifications = getAgentNotifications(policies || []);

    return NextResponse.json({
      success: true,
      notifications,
      count: notifications.length,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error("Error fetching notifications:", error);
    return NextResponse.json(
      { error: "Failed to fetch notifications" },
      { status: 500 }
    );
  }
}

// POST endpoint for daily notification processing (could be called by a cron job)
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { action } = body;

    if (action === 'daily_check') {
      // This would typically be called by a cron job or scheduled function
      
      // Get all users with policies
      const { data: users, error: usersError } = await supabase
        .from("policies")
        .select("user_id")
        .neq("user_id", null);

      if (usersError) {
        throw usersError;
      }

      // Get unique user IDs
      const uniqueUserIds = [...new Set(users?.map(u => u.user_id) || [])];

      const results = [];

      // Process notifications for each user
      for (const userId of uniqueUserIds) {
        const { data: policies, error: policiesError } = await supabase
          .from("policies")
          .select("*")
          .eq("user_id", userId);

        if (policiesError) {
          console.error(`Error fetching policies for user ${userId}:`, policiesError);
          continue;
        }

        const notifications = getAgentNotifications(policies || []);
        
        results.push({
          userId,
          notificationCount: notifications.length,
          notifications: notifications.map(n => ({
            type: n.type,
            priority: n.priority,
            clientName: n.clientName,
            policyId: n.policyId
          }))
        });

        // In a production environment, you might want to:
        // 1. Store notifications in a database table
        // 2. Send email/SMS alerts for urgent notifications
        // 3. Log notification events for auditing
      }

      return NextResponse.json({
        success: true,
        message: "Daily notification check completed",
        processedUsers: results.length,
        totalNotifications: results.reduce((sum, r) => sum + r.notificationCount, 0),
        results: results.filter(r => r.notificationCount > 0) // Only return users with notifications
      });

    } else if (action === 'mark_notification_seen') {
      // Handle marking notifications as seen
      const { notificationId, userId } = body;
      
      // In a full implementation, you'd store this in a notifications table
      console.log(`Marking notification ${notificationId} as seen for user ${userId}`);
      
      return NextResponse.json({
        success: true,
        message: "Notification marked as seen"
      });

    } else {
      return NextResponse.json(
        { error: "Invalid action" },
        { status: 400 }
      );
    }

  } catch (error) {
    console.error("Error processing notifications:", error);
    return NextResponse.json(
      { error: "Failed to process notifications" },
      { status: 500 }
    );
  }
}

// PUT endpoint for updating notification preferences or dismissing notifications
export async function PUT(request: Request) {
  try {
    const body = await request.json();
    const { action, userId, notificationId } = body;

    if (action === 'dismiss_notification') {
      // In a full implementation, you'd update a notifications table
      console.log(`Dismissing notification ${notificationId} for user ${userId}`);
      
      return NextResponse.json({
        success: true,
        message: "Notification dismissed"
      });

    } else if (action === 'snooze_notification') {
      const { snoozeUntil } = body;
      console.log(`Snoozing notification ${notificationId} until ${snoozeUntil}`);
      
      return NextResponse.json({
        success: true,
        message: "Notification snoozed"
      });

    } else {
      return NextResponse.json(
        { error: "Invalid action" },
        { status: 400 }
      );
    }

  } catch (error) {
    console.error("Error updating notification:", error);
    return NextResponse.json(
      { error: "Failed to update notification" },
      { status: 500 }
    );
  }
} 
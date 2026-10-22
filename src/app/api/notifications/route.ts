import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getAgentNotifications } from "@/lib/notifications";
import { getSupabaseAdmin } from "@/lib/admin";

// GET endpoint for fetching user notifications
export async function GET(request: Request) {
  try {
    const { userId: authenticatedUserId } = await auth();

    if (!authenticatedUserId) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const requestedUserId = searchParams.get('userId');

    // Users can only access their own notifications unless they're admin
    const supabase = getSupabaseAdmin();
    let effectiveUserId = authenticatedUserId;

    if (requestedUserId && requestedUserId !== authenticatedUserId) {
      // Check if user is admin
      const { data: profile } = await supabase
        .from("agent_profiles")
        .select("role")
        .eq("user_id", authenticatedUserId)
        .single();

      if (!profile || profile.role !== "admin") {
        return NextResponse.json(
          { error: "Forbidden - cannot access other users' notifications" },
          { status: 403 }
        );
      }
      effectiveUserId = requestedUserId;
    }

    // Fetch policies for the user
    const { data: policies, error: policiesError } = await supabase
      .from("policies")
      .select("*")
      .eq("user_id", effectiveUserId)
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
    const { userId: authenticatedUserId } = await auth();

    if (!authenticatedUserId) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Only admins can trigger daily checks
    const supabase = getSupabaseAdmin();
    const { data: profile } = await supabase
      .from("agent_profiles")
      .select("role")
      .eq("user_id", authenticatedUserId)
      .single();

    if (!profile || profile.role !== "admin") {
      return NextResponse.json(
        { error: "Forbidden - admin access required" },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { action } = body;

    if (action === 'daily_check') {
      // This would typically be called by a cron job or scheduled function
      const supabase = getSupabaseAdmin();

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

      // Validate input
      if (!notificationId || !userId) {
        return NextResponse.json(
          { error: "Missing required fields" },
          { status: 400 }
        );
      }

      // Users can only mark their own notifications
      if (userId !== authenticatedUserId) {
        const { data: adminProfile } = await supabase
          .from("agent_profiles")
          .select("role")
          .eq("user_id", authenticatedUserId)
          .single();

        if (!adminProfile || adminProfile.role !== "admin") {
          return NextResponse.json(
            { error: "Forbidden - cannot modify other users' notifications" },
            { status: 403 }
          );
        }
      }
      
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
    const { userId: authenticatedUserId } = await auth();

    if (!authenticatedUserId) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { action, userId, notificationId } = body;

    // Validate input
    if (!action || !userId || !notificationId) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    // Users can only modify their own notifications
    if (userId !== authenticatedUserId) {
      const supabase = getSupabaseAdmin();
      const { data: profile } = await supabase
        .from("agent_profiles")
        .select("role")
        .eq("user_id", authenticatedUserId)
        .single();

      if (!profile || profile.role !== "admin") {
        return NextResponse.json(
          { error: "Forbidden - cannot modify other users' notifications" },
          { status: 403 }
        );
      }
    }

    if (action === 'dismiss_notification') {
      // In a full implementation, you'd update a notifications table
      console.log(`Dismissing notification ${notificationId} for user ${userId}`);
      
      return NextResponse.json({
        success: true,
        message: "Notification dismissed"
      });

    } else if (action === 'snooze_notification') {
      const { snoozeUntil } = body;

      if (!snoozeUntil) {
        return NextResponse.json(
          { error: "snoozeUntil is required" },
          { status: 400 }
        );
      }

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
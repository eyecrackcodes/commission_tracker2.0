import fs from "fs";
import path from "path";

// Path to the notification tracking file
const NOTIFICATION_FILE_PATH = path.join(
  process.cwd(),
  "notification-tracker.json"
);

// Interface for notification tracking data
export interface NotificationData {
  [userId: string]: {
    lastNotificationDate: string;
    commissionRate: number;
  };
}

// Initialize the notification tracker file if it doesn't exist
function initializeNotificationFile() {
  if (!fs.existsSync(NOTIFICATION_FILE_PATH)) {
    fs.writeFileSync(NOTIFICATION_FILE_PATH, JSON.stringify({}));
  }
}

// Get all notification data
export function getNotificationData(): NotificationData {
  throw new Error("This function should only be called from server-side code");
}

// Check if a user has been notified recently (within the last 30 days)
export function hasBeenNotifiedRecently(userId: string): boolean {
  throw new Error("This function should only be called from server-side code");
}

// Record a notification for a user
export function recordNotification(
  userId: string,
  commissionRate: number
): void {
  throw new Error("This function should only be called from server-side code");
}

// Reset notification data for a user (for testing purposes)
export function resetNotificationData(userId: string): void {
  throw new Error("This function should only be called from server-side code");
}

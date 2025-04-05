import fs from "fs";
import path from "path";

// Path to the notification tracking file
const NOTIFICATION_FILE_PATH = path.join(
  process.cwd(),
  "notification-tracker.json"
);

// Interface for notification tracking data
interface NotificationData {
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
  initializeNotificationFile();
  try {
    const data = fs.readFileSync(NOTIFICATION_FILE_PATH, "utf8");
    return JSON.parse(data);
  } catch (error) {
    console.error("Error reading notification data:", error);
    return {};
  }
}

// Check if a user has been notified recently (within the last 30 days)
export function hasBeenNotifiedRecently(userId: string): boolean {
  const data = getNotificationData();
  const userData = data[userId];

  if (!userData || !userData.lastNotificationDate) {
    return false;
  }

  const lastNotificationDate = new Date(userData.lastNotificationDate);
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  return lastNotificationDate > thirtyDaysAgo;
}

// Record a notification for a user
export function recordNotification(
  userId: string,
  commissionRate: number
): void {
  const data = getNotificationData();

  data[userId] = {
    lastNotificationDate: new Date().toISOString(),
    commissionRate,
  };

  try {
    fs.writeFileSync(NOTIFICATION_FILE_PATH, JSON.stringify(data, null, 2));
  } catch (error) {
    console.error("Error writing notification data:", error);
  }
}

// Reset notification data for a user (for testing purposes)
export function resetNotificationData(userId: string): void {
  const data = getNotificationData();

  if (data[userId]) {
    delete data[userId];

    try {
      fs.writeFileSync(NOTIFICATION_FILE_PATH, JSON.stringify(data, null, 2));
    } catch (error) {
      console.error("Error resetting notification data:", error);
    }
  }
}

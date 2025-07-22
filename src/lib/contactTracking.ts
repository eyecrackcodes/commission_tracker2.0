// Simple contact tracking using localStorage until we have a proper database table

interface ContactAttempt {
  policyId: number;
  contactDate: string;
  userId: string;
}

// Get today's date as a string (YYYY-MM-DD)
function getTodayString(): string {
  return new Date().toISOString().split('T')[0];
}

// Get contact tracking key for localStorage
function getContactKey(userId: string): string {
  return `contact_attempts_${userId}`;
}

// Get all contact attempts for a user
export function getContactAttempts(userId: string): ContactAttempt[] {
  try {
    const stored = localStorage.getItem(getContactKey(userId));
    return stored ? JSON.parse(stored) : [];
  } catch (error) {
    console.error('Error reading contact attempts:', error);
    return [];
  }
}

// Log a contact attempt
export function logContactAttempt(policyId: number, userId: string): void {
  try {
    const attempts = getContactAttempts(userId);
    const today = getTodayString();
    
    // Check if already contacted today for this policy
    const existingAttempt = attempts.find(
      attempt => attempt.policyId === policyId && attempt.contactDate === today
    );
    
    if (!existingAttempt) {
      attempts.push({
        policyId,
        contactDate: today,
        userId
      });
      
      // Keep only last 30 days of attempts to prevent localStorage bloat
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      const cutoffDate = thirtyDaysAgo.toISOString().split('T')[0];
      
      const recentAttempts = attempts.filter(attempt => attempt.contactDate >= cutoffDate);
      
      localStorage.setItem(getContactKey(userId), JSON.stringify(recentAttempts));
      console.log(`Contact attempt logged for policy ${policyId}`);
    } else {
      console.log(`Already contacted policy ${policyId} today`);
    }
  } catch (error) {
    console.error('Error logging contact attempt:', error);
  }
}

// Check if a policy was contacted today
export function wasContactedToday(policyId: number, userId: string): boolean {
  try {
    const attempts = getContactAttempts(userId);
    const today = getTodayString();
    
    return attempts.some(
      attempt => attempt.policyId === policyId && attempt.contactDate === today
    );
  } catch (error) {
    console.error('Error checking contact status:', error);
    return false;
  }
}

// Get the last contact date for a policy
export function getLastContactDate(policyId: number, userId: string): string | null {
  try {
    const attempts = getContactAttempts(userId);
    const policyAttempts = attempts
      .filter(attempt => attempt.policyId === policyId)
      .sort((a, b) => b.contactDate.localeCompare(a.contactDate));
    
    return policyAttempts.length > 0 ? policyAttempts[0].contactDate : null;
  } catch (error) {
    console.error('Error getting last contact date:', error);
    return null;
  }
}

// Get contact count for a policy in the last 7 days
export function getRecentContactCount(policyId: number, userId: string): number {
  try {
    const attempts = getContactAttempts(userId);
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const cutoffDate = sevenDaysAgo.toISOString().split('T')[0];
    
    return attempts.filter(
      attempt => 
        attempt.policyId === policyId && 
        attempt.contactDate >= cutoffDate
    ).length;
  } catch (error) {
    console.error('Error getting contact count:', error);
    return 0;
  }
} 
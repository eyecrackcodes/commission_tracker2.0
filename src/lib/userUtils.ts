/**
 * Utility functions for user data processing
 */

/**
 * Extracts a user's name from their email address
 * @param email - The email address to parse
 * @returns A formatted name string
 */
export function parseNameFromEmail(email: string): string {
  if (!email) return 'Unknown User';
  
  // Extract the part before the @ symbol
  const localPart = email.split('@')[0];
  
  // Handle common email patterns
  if (localPart.includes('.')) {
    // Handle patterns like "john.doe@example.com" or "first.last@example.com"
    const parts = localPart.split('.');
    return parts
      .map(part => capitalizeFirstLetter(part))
      .join(' ');
  } else if (localPart.includes('_')) {
    // Handle patterns like "john_doe@example.com"
    const parts = localPart.split('_');
    return parts
      .map(part => capitalizeFirstLetter(part))
      .join(' ');
  } else if (localPart.includes('-')) {
    // Handle patterns like "john-doe@example.com"
    const parts = localPart.split('-');
    return parts
      .map(part => capitalizeFirstLetter(part))
      .join(' ');
  } else {
    // Handle single word emails like "johndoe@example.com"
    return capitalizeFirstLetter(localPart);
  }
}

/**
 * Capitalizes the first letter of a string and makes the rest lowercase
 * @param str - The string to capitalize
 * @returns The capitalized string
 */
function capitalizeFirstLetter(str: string): string {
  if (!str) return '';
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
}

/**
 * Gets the best available user name from Clerk user object
 * @param user - The Clerk user object
 * @returns The best available user name
 */
export function getBestUserName(user: {
  fullName?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  emailAddresses?: Array<{ emailAddress: string }>;
}): string {
  // Priority order: fullName > firstName lastName > firstName > parsed from email > fallback
  if (user.fullName) {
    return user.fullName;
  }
  
  if (user.firstName && user.lastName) {
    return `${user.firstName} ${user.lastName}`;
  }
  
  if (user.firstName) {
    return user.firstName;
  }
  
  // Try to parse from email
  if (user.emailAddresses && user.emailAddresses.length > 0) {
    const primaryEmail = user.emailAddresses[0].emailAddress;
    return parseNameFromEmail(primaryEmail);
  }
  
  return 'Unknown Agent';
}

/**
 * Gets the user's email address from Clerk user object
 * @param user - The Clerk user object
 * @returns The user's primary email address
 */
export function getUserEmail(user: {
  emailAddresses?: Array<{ emailAddress: string }>;
}): string {
  if (user.emailAddresses && user.emailAddresses.length > 0) {
    return user.emailAddresses[0].emailAddress;
  }
  return '';
} 
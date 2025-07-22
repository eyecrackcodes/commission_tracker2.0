// Utility classes for consistent dark mode styling
export const darkModeClasses = {
  // Backgrounds
  card: "bg-white dark:bg-gray-800",
  cardBorder: "border-gray-200 dark:border-gray-700",
  cardShadow: "shadow dark:shadow-gray-900/50",
  
  // Text
  textPrimary: "text-gray-900 dark:text-gray-100",
  textSecondary: "text-gray-600 dark:text-gray-400",
  textTertiary: "text-gray-500 dark:text-gray-500",
  
  // Inputs
  input: "bg-gray-50 dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100 focus:ring-blue-500 focus:border-blue-500",
  inputHover: "hover:bg-gray-100 dark:hover:bg-gray-600",
  
  // Tables
  tableHeader: "bg-gray-50 dark:bg-gray-700",
  tableBody: "bg-white dark:bg-gray-800",
  tableRow: "hover:bg-gray-50 dark:hover:bg-gray-700",
  tableBorder: "divide-gray-200 dark:divide-gray-700",
  
  // Buttons
  buttonPrimary: "bg-blue-500 hover:bg-blue-600 dark:bg-blue-600 dark:hover:bg-blue-700 text-white",
  buttonSecondary: "bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300",
  buttonDanger: "bg-red-500 hover:bg-red-600 dark:bg-red-600 dark:hover:bg-red-700 text-white",
  
  // Modals
  modalBackdrop: "bg-black/50 dark:bg-black/70",
  modalContent: "bg-white dark:bg-gray-800",
  
  // Charts (for Recharts)
  chartText: "fill-gray-600 dark:fill-gray-400",
  chartGrid: "stroke-gray-200 dark:stroke-gray-700",
};

// Helper function to combine classes
export function cn(...classes: string[]) {
  return classes.filter(Boolean).join(" ");
} 
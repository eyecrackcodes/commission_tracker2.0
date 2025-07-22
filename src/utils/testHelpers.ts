// Test helper functions for manual testing in browser console

export const testDateFiltering = () => {
  console.log("=== Date Filtering Test ===");
  
  // Test current month calculation
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  
  console.log("Current month range:");
  console.log("Start:", startOfMonth.toISOString());
  console.log("End:", endOfMonth.toISOString());
  
  // Test edge cases
  const testDates = [
    new Date(), // Today
    new Date(now.getFullYear(), now.getMonth(), 1), // First of month
    new Date(now.getFullYear(), now.getMonth() + 1, 0), // Last of month
    new Date(now.getFullYear(), now.getMonth() - 1, 15), // Last month
    new Date(now.getFullYear(), now.getMonth() + 1, 15), // Next month
  ];
  
  testDates.forEach((date, index) => {
    const isInRange = date >= startOfMonth && date <= endOfMonth;
    console.log(`Test date ${index + 1}: ${date.toISOString()} - In range: ${isInRange}`);
  });
};

export const testTenureCalculation = (startDate: string) => {
  console.log("=== Tenure Calculation Test ===");
  
  const start = new Date(startDate);
  const today = new Date();
  
  console.log("Start date:", start.toISOString());
  console.log("Today:", today.toISOString());
  
  // Validate date
  if (isNaN(start.getTime())) {
    console.error("Invalid start date!");
    return;
  }
  
  if (start > today) {
    console.warn("Start date is in the future!");
    return;
  }
  
  const months = Math.floor((today.getTime() - start.getTime()) / (1000 * 60 * 60 * 24 * 30.44));
  console.log("Months of tenure:", months);
  
  // Test commission rate calculation
  const baseRate = 0.05; // 5%
  let adjustedRate = baseRate;
  
  if (months >= 24) {
    adjustedRate = baseRate * 1.1; // 10% bonus
    console.log("2+ years bonus applied");
  } else if (months >= 12) {
    adjustedRate = baseRate * 1.05; // 5% bonus
    console.log("1+ year bonus applied");
  } else if (months >= 6) {
    adjustedRate = baseRate * 1.02; // 2% bonus
    console.log("6+ months bonus applied");
  } else {
    console.log("Base rate (no bonus)");
  }
  
  console.log(`Base rate: ${(baseRate * 100).toFixed(2)}%`);
  console.log(`Adjusted rate: ${(adjustedRate * 100).toFixed(2)}%`);
};

export const testFormValidation = () => {
  console.log("=== Form Validation Test Cases ===");
  
  const testCases = [
    { client: "", premium: 1000, rate: 0.05, valid: false, reason: "Empty client" },
    { client: "Test Client", premium: -1000, rate: 0.05, valid: false, reason: "Negative premium" },
    { client: "Test Client", premium: 1000, rate: -0.05, valid: false, reason: "Negative commission rate" },
    { client: "Test Client", premium: 0, rate: 0.05, valid: false, reason: "Zero premium" },
    { client: "Test Client", premium: 1000, rate: 0, valid: false, reason: "Zero commission rate" },
    { client: "Test Client", premium: 1000, rate: 2, valid: false, reason: "Commission rate > 100%" },
    { client: "Test Client", premium: 1000, rate: 0.05, valid: true, reason: "Valid data" },
  ];
  
  testCases.forEach((testCase, index) => {
    console.log(`Test ${index + 1}: ${testCase.reason}`);
    console.log(`  Data:`, testCase);
    console.log(`  Expected valid: ${testCase.valid}`);
    
    // Manual validation logic
    const isValid = 
      testCase.client.trim().length > 0 &&
      testCase.premium > 0 &&
      testCase.rate > 0 &&
      testCase.rate <= 1;
    
    console.log(`  Actual valid: ${isValid}`);
    console.log(`  ✓ ${isValid === testCase.valid ? 'PASS' : 'FAIL'}`);
    console.log("");
  });
};

export const testCommissionCalculation = () => {
  console.log("=== Commission Calculation Test ===");
  
  const testCases = [
    { premium: 1000, rate: 0.05, expected: 50 },
    { premium: 2500, rate: 0.08, expected: 200 },
    { premium: 5000, rate: 0.12, expected: 600 },
    { premium: 10000, rate: 0.15, expected: 1500 },
  ];
  
  testCases.forEach((testCase, index) => {
    const calculated = testCase.premium * testCase.rate;
    const passed = Math.abs(calculated - testCase.expected) < 0.01;
    
    console.log(`Test ${index + 1}:`);
    console.log(`  Premium: $${testCase.premium}`);
    console.log(`  Rate: ${(testCase.rate * 100)}%`);
    console.log(`  Expected: $${testCase.expected}`);
    console.log(`  Calculated: $${calculated}`);
    console.log(`  ✓ ${passed ? 'PASS' : 'FAIL'}`);
    console.log("");
  });
};

// To use in browser console:
// import { testDateFiltering, testTenureCalculation } from './src/utils/testHelpers.ts'
// testDateFiltering()
// testTenureCalculation('2022-01-15')

export const runAllTests = () => {
  testDateFiltering();
  console.log("\n");
  testTenureCalculation('2022-01-15'); // Test with ~2 years tenure
  console.log("\n");
  testFormValidation();
  console.log("\n");
  testCommissionCalculation();
}; 
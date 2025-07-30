/**
 * Product Normalization Utility
 * 
 * Ensures consistent product naming across the application, regardless of 
 * whether the database has been updated with normalized names or not.
 * 
 * This provides backward compatibility and real-time normalization.
 */

export interface ProductMapping {
  carrier: string;
  originalPattern: string;
  normalizedName: string;
}

// Master list of product normalizations
const PRODUCT_MAPPINGS: ProductMapping[] = [
  // GTL normalizations
  { carrier: 'gtl', originalPattern: 'luminary life preferred', normalizedName: 'Preferred' },
  { carrier: 'gtl', originalPattern: 'luminary life standard', normalizedName: 'Standard' },
  { carrier: 'gtl', originalPattern: 'luminary life graded', normalizedName: 'Graded' },
  { carrier: 'gtl', originalPattern: 'guaranteed issue', normalizedName: 'Guaranteed Issue' },
  
  // Royal Neighbors of America normalizations
  { carrier: 'royal neighbors', originalPattern: 'whole life preferred', normalizedName: 'Preferred' },
  { carrier: 'royal neighbors', originalPattern: 'whole life standard', normalizedName: 'Standard' },
  { carrier: 'royal neighbors', originalPattern: 'whole life graded', normalizedName: 'Graded' },
  { carrier: 'royal neighbors', originalPattern: 'guaranteed issue', normalizedName: 'Guaranteed Issue' },
  { carrier: 'royal neighbors', originalPattern: 'term', normalizedName: 'Term' },
  
  // American Amicable normalizations
  { carrier: 'american amicable', originalPattern: 'whole life immediate', normalizedName: 'Immediate' },
  { carrier: 'american amicable', originalPattern: 'whole life graded', normalizedName: 'Graded' },
  { carrier: 'american amicable', originalPattern: 'rop', normalizedName: 'ROP' },
];

/**
 * Normalize a product name based on carrier and current product name
 * 
 * @param carrier - The insurance carrier name
 * @param product - The current product name (potentially non-normalized)
 * @returns Normalized product name
 */
export function normalizeProductName(carrier: string, product: string): string {
  if (!carrier || !product) {
    return product || 'Other';
  }

  const carrierLower = carrier.toLowerCase();
  const productLower = product.toLowerCase();
  
  // Check specific carrier + product mappings first
  for (const mapping of PRODUCT_MAPPINGS) {
    if (carrierLower.includes(mapping.carrier) && 
        productLower.includes(mapping.originalPattern)) {
      return mapping.normalizedName;
    }
  }
  
  // Generic fallback patterns (for edge cases and unknown combinations)
  const genericMappings = [
    { pattern: 'preferred', normalized: 'Preferred' },
    { pattern: 'standard', normalized: 'Standard' },
    { pattern: 'graded', normalized: 'Graded' },
    { pattern: 'guaranteed issue', normalized: 'Guaranteed Issue' },
    { pattern: 'immediate', normalized: 'Immediate' },
    { pattern: 'modified', normalized: 'Modified' },
    { pattern: 'term', normalized: 'Term' },
    { pattern: 'rop', normalized: 'ROP' },
  ];
  
  for (const mapping of genericMappings) {
    if (productLower.includes(mapping.pattern)) {
      return mapping.normalized;
    }
  }
  
  // If no match found, return original product name (properly capitalized)
  return product.charAt(0).toUpperCase() + product.slice(1).toLowerCase();
}

/**
 * Normalize an array of policies with consistent product names
 * 
 * @param policies - Array of policy objects with carrier and product fields
 * @returns Array of policies with normalized product names
 */
export function normalizePolicyProducts<T extends { carrier: string; product: string }>(
  policies: T[]
): T[] {
  return policies.map(policy => ({
    ...policy,
    product: normalizeProductName(policy.carrier, policy.product)
  }));
}

/**
 * Get a mapping of all current product variations to their normalized forms
 * 
 * @param policies - Array of policies to analyze
 * @returns Map of original product names to normalized names
 */
export function getProductNormalizationMap<T extends { carrier: string; product: string }>(
  policies: T[]
): Map<string, string> {
  const normalizationMap = new Map<string, string>();
  
  policies.forEach(policy => {
    const key = `${policy.carrier}|${policy.product}`;
    const normalized = normalizeProductName(policy.carrier, policy.product);
    normalizationMap.set(key, normalized);
  });
  
  return normalizationMap;
}

/**
 * Analyze which products need normalization (for debugging/reporting)
 * 
 * @param policies - Array of policies to analyze
 * @returns Analysis of normalization needs
 */
export function analyzeProductNormalization<T extends { carrier: string; product: string }>(
  policies: T[]
): {
  totalPolicies: number;
  uniqueProducts: number;
  normalizedProducts: number;
  needsNormalization: Array<{ carrier: string; product: string; normalized: string; count: number }>;
} {
  const productCounts = new Map<string, number>();
  const normalizationNeeds: Array<{ carrier: string; product: string; normalized: string; count: number }> = [];
  
  // Count occurrences of each carrier+product combination
  policies.forEach(policy => {
    const key = `${policy.carrier}|${policy.product}`;
    productCounts.set(key, (productCounts.get(key) || 0) + 1);
  });
  
  // Analyze normalization needs
  productCounts.forEach((count, key) => {
    const [carrier, product] = key.split('|');
    const normalized = normalizeProductName(carrier, product);
    
    if (normalized !== product) {
      normalizationNeeds.push({ carrier, product, normalized, count });
    }
  });
  
  return {
    totalPolicies: policies.length,
    uniqueProducts: productCounts.size,
    normalizedProducts: productCounts.size - normalizationNeeds.length,
    needsNormalization: normalizationNeeds.sort((a, b) => b.count - a.count)
  };
}
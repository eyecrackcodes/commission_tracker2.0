// Carrier and product configurations
export interface CarrierProduct {
  carrier: string;
  products: string[];
}

export const carriers: CarrierProduct[] = [
  {
    carrier: "GTL - Guarantee Trust Life",
    products: ["Preferred", "Standard", "Graded", "Guaranteed Issue"],
  },
  // Add more carriers here as needed
];

// Helper function to get products for a specific carrier
export function getProductsByCarrier(carrierName: string): string[] {
  const carrier = carriers.find((c) => c.carrier === carrierName);
  return carrier ? carrier.products : [];
}

// Get all carrier names for dropdown
export function getCarrierNames(): string[] {
  return carriers.map((c) => c.carrier);
}

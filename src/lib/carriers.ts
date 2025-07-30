export interface CarrierProduct {
  name: string;
  products: string[];
}

export const carriers: CarrierProduct[] = [
  {
    name: "GTL",
    products: ["Luminary Life Preferred", "Luminary Life Standard", "Luminary Life Graded", "Luminary Life Guaranteed Issue"],
  },
  {
    name: "Royal Neighbors of America",
    products: ["Graded", "Guaranteed Issue", "Standard", "Preferred", "Term"],
  },
  {
    name: "American Amicable",
    products: ["Senior Choice Immediate", "Senior Choice Graded", "Senior Choice ROP"],
  },
  {
    name: "SBLI",
    products: ["Preferred", "Standard", "Modified"],
  },
  {
    name: "Other",
    products: ["Other"],
  },
];

export function getProductOptions(carrier: string): string[] {
  const carrierData = carriers.find(
    (c) => c.name.toLowerCase() === carrier.toLowerCase()
  );
  return carrierData?.products || ["Other"];
}

export function getCarrierOptions(): string[] {
  return carriers.map((c) => c.name);
} 

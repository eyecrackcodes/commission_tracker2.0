export interface CarrierProduct {
  name: string;
  products: string[];
}

export const carriers: CarrierProduct[] = [
  {
    name: "GTL",
    products: ["Preferred", "Standard", "Graded", "Guaranteed Issue"],
  },
  {
    name: "Royal Neighbors of America",
    products: ["Graded", "Guaranteed Issue", "Standard", "Preferred", "Term"],
  },
  {
    name: "American Amicable",
    products: ["Immediate", "Graded", "ROP"],
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
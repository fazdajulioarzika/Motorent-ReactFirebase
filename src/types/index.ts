export interface MotorType {
  id: string;
  name: string;
  slug: string;
  brand: string;
  category: "scooter" | "sport" | "matic" | "bebek" | "trail";
  description?: string;
  dailyPrice: number;
  specifications: Record<string, string>;
  images: string[];
  isActive: boolean;
}

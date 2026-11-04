export type CategoryId = string;
export type Category = {
  id: string;
  name: string;
  description: string;
  illustration: Illustration;
  active?: boolean;
};
export type Illustration = "rice" | "sugar" | "potatoes";
export type Product = {
  id: string;
  productId?: string;
  version?: number;
  name: string;
  hindiName: string;
  category: CategoryId;
  weight: number;
  unit: "kg" | "g" | "L";
  price: number;
  image: string;
  illustration: Illustration;
  tone: "green" | "ochre" | "plum" | "blue" | "cream";
  description: string;
  available: boolean;
  badge?: string;
};

export const formatPrice = (amount: number) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
    minimumFractionDigits: 0,
  }).format(amount);
export const formatUnitPrice = (amount: number) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
    minimumFractionDigits: 0,
  }).format(amount);

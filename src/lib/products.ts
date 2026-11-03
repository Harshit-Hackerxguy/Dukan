export type Category = {
  id: string;
  name: string;
  description: string;
  illustration: Illustration;
};
export const categories: Category[] = [
  {
    id: "rice",
    name: "Rice & grains",
    description: "Everyday staples, by the bag",
    illustration: "rice",
  },
  {
    id: "essentials",
    name: "Sugar & essentials",
    description: "The pantry must-haves",
    illustration: "sugar",
  },
  {
    id: "produce",
    name: "Fresh produce",
    description: "Goodness from the ground",
    illustration: "potatoes",
  },
];

export type CategoryId = string;
export type Illustration = "rice" | "sugar" | "potatoes";
export type Product = {
  id: string;
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

export const initialProducts: Product[] = [
  {
    id: "regular-rice",
    name: "Regular Rice",
    hindiName: "साधारण चावल",
    category: "rice",
    weight: 50,
    unit: "kg",
    price: 1000,
    image: "",
    illustration: "rice",
    tone: "green",
    description:
      "A dependable everyday rice for comforting home-cooked meals. Supplied in a convenient bulk bag.",
    available: true,
    badge: "Bestseller",
  },
  {
    id: "premium-rice",
    name: "Premium Rice",
    hindiName: "प्रीमियम चावल",
    category: "rice",
    weight: 50,
    unit: "kg",
    price: 1200,
    image: "",
    illustration: "rice",
    tone: "ochre",
    description:
      "Beautiful, carefully selected grains for everyday meals and special occasions. A versatile pantry essential.",
    available: true,
    badge: "Popular choice",
  },
  {
    id: "super-premium-rice",
    name: "Super Premium Rice",
    hindiName: "सुपर प्रीमियम चावल",
    category: "rice",
    weight: 50,
    unit: "kg",
    price: 1350,
    image: "",
    illustration: "rice",
    tone: "plum",
    description:
      "Our premium demo selection of rice, with long, elegant grains. Ideal when your menu calls for something special.",
    available: true,
  },
  {
    id: "rice-30",
    name: "Everyday Rice",
    hindiName: "रोज़ाना चावल",
    category: "rice",
    weight: 30,
    unit: "kg",
    price: 750,
    image: "",
    illustration: "rice",
    tone: "blue",
    description:
      "Your everyday rice in a smaller 30 kg bulk pack. Easy to stock and ready for your kitchen.",
    available: true,
    badge: "Smaller pack",
  },
  {
    id: "sugar",
    name: "White Sugar",
    hindiName: "चीनी",
    category: "essentials",
    weight: 50,
    unit: "kg",
    price: 2000,
    image: "",
    illustration: "sugar",
    tone: "cream",
    description:
      "White granulated sugar for tea, desserts, and everyday cooking. A bulk essential for well-stocked kitchens.",
    available: true,
  },
  {
    id: "potatoes",
    name: "Fresh Potatoes",
    hindiName: "आलू",
    category: "produce",
    weight: 50,
    unit: "kg",
    price: 900,
    image: "",
    illustration: "potatoes",
    tone: "ochre",
    description:
      "Versatile potatoes for all your kitchen favourites, supplied in a generous 50 kg sack.",
    available: true,
  },
];

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
export const categoryName = (id: CategoryId) =>
  categories.find((category) => category.id === id)?.name ?? id;

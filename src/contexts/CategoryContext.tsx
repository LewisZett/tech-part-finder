import { createContext, useContext, useState, useEffect, ReactNode } from "react";

export type Category = "phone" | "tv" | "computer" | "car";

interface CategoryConfig {
  id: Category;
  label: string;
  icon: string;
  heroText: string;
  heroSubtext: string;
  searchPlaceholder: string;
  quickActions: { label: string; type: "buyer" | "seller" }[];
}

export const categoryConfigs: Record<Category, CategoryConfig> = {
  phone: {
    id: "phone",
    label: "Phone Spare Parts",
    icon: "📱",
    heroText: "Phone Spare Parts Delivered Fast",
    heroSubtext: "Find screens, batteries, charging ports and more",
    searchPlaceholder: "Search phone spare parts… (e.g. A15 LCD, charging port)",
    quickActions: [
      { label: "Need LCD / Screen?", type: "buyer" },
      { label: "Have extra stock?", type: "seller" },
    ],
  },
  tv: {
    id: "tv",
    label: "TV Spare Parts",
    icon: "📺",
    heroText: "TV Panels, Boards & Remotes",
    heroSubtext: "LED panels, T-Con boards, power supplies and remotes",
    searchPlaceholder: "Search TV spare parts… (e.g. 43 inch panel, T-Con)",
    quickActions: [
      { label: "Need TV panel?", type: "buyer" },
      { label: "Selling main boards?", type: "seller" },
    ],
  },
  computer: {
    id: "computer",
    label: "Computer Spare Parts",
    icon: "🖥️",
    heroText: "Laptop Screens, Chargers, SSDs",
    heroSubtext: "Motherboards, RAM, SSDs, screens and chargers",
    searchPlaceholder: "Search computer spare parts… (e.g. i5 motherboard, 16GB RAM)",
    quickActions: [
      { label: "Need laptop screen?", type: "buyer" },
      { label: "Have RAM / SSD stock?", type: "seller" },
    ],
  },
  car: {
    id: "car",
    label: "Car Spare Parts",
    icon: "🚗",
    heroText: "Car & Kombi Spare Parts",
    heroSubtext: "Alternators, shocks, clutches, headlights and more",
    searchPlaceholder: "Search car spare parts… (e.g. Hilux clutch, headlight)",
    quickActions: [
      { label: "Need alternator / shocks?", type: "buyer" },
      { label: "Have spares to sell?", type: "seller" },
    ],
  },
};

interface CategoryContextType {
  selectedCategory: Category;
  setSelectedCategory: (category: Category) => void;
  config: CategoryConfig;
}

const CategoryContext = createContext<CategoryContextType | undefined>(undefined);

export function CategoryProvider({ children }: { children: ReactNode }) {
  const [selectedCategory, setSelectedCategory] = useState<Category>(() => {
    const saved = localStorage.getItem("preferredCategory");
    return (saved as Category) || "phone";
  });

  useEffect(() => {
    localStorage.setItem("preferredCategory", selectedCategory);
  }, [selectedCategory]);

  const config = categoryConfigs[selectedCategory];

  return (
    <CategoryContext.Provider value={{ selectedCategory, setSelectedCategory, config }}>
      {children}
    </CategoryContext.Provider>
  );
}

export function useCategory() {
  const context = useContext(CategoryContext);
  if (!context) {
    throw new Error("useCategory must be used within a CategoryProvider");
  }
  return context;
}

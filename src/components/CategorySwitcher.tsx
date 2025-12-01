import { useCategory, categoryConfigs, Category } from "@/contexts/CategoryContext";
import { cn } from "@/lib/utils";
import phonePartsThumbnail from "@/assets/phone-parts-thumbnail.png";
import computerPartsThumbnail from "@/assets/computer-parts-thumbnail.png";
import tvPartsThumbnail from "@/assets/tv-parts-thumbnail.png";
import carPartsThumbnail from "@/assets/car-parts-thumbnail.png";

const categories: Category[] = ["phone", "tv", "computer", "car"];

const categoryImages: Record<Category, string> = {
  phone: phonePartsThumbnail,
  tv: tvPartsThumbnail,
  computer: computerPartsThumbnail,
  car: carPartsThumbnail,
};

export function CategorySwitcher() {
  const { selectedCategory, setSelectedCategory } = useCategory();

  return (
    <div className="w-full bg-background/95 backdrop-blur-sm border-b border-border sticky top-0 z-40">
      <div className="overflow-x-auto scrollbar-hide">
        <div className="flex min-w-max md:grid md:grid-cols-4 md:min-w-0">
          {categories.map((category) => {
            const config = categoryConfigs[category];
            const isActive = selectedCategory === category;

            return (
              <button
                key={category}
                onClick={() => setSelectedCategory(category)}
                className={cn(
                  "flex items-center justify-center gap-2 px-4 py-3 text-sm font-medium transition-all whitespace-nowrap",
                  "min-w-[120px] md:min-w-0",
                  isActive
                    ? "bg-teal text-teal-foreground"
                    : "bg-sidebar text-sidebar-foreground hover:bg-sidebar-accent/50"
                )}
              >
                <img 
                  src={categoryImages[category]} 
                  alt={config.label}
                  className="w-6 h-6 rounded object-cover"
                />
                <span>{config.label}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

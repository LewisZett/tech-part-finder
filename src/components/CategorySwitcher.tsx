import { useCategory, categoryConfigs, Category } from "@/contexts/CategoryContext";
import { cn } from "@/lib/utils";

const categories: Category[] = ["phone", "tv", "computer", "car"];

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
                  "min-w-[140px] md:min-w-0",
                  isActive
                    ? "bg-teal text-white"
                    : "bg-sidebar text-sidebar-foreground hover:bg-sidebar-accent/50"
                )}
              >
                <span className="text-lg">{config.icon}</span>
                <span className="hidden sm:inline">{config.label}</span>
                <span className="sm:hidden">{config.label.split(" ")[0]}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

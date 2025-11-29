import { useCategory } from "@/contexts/CategoryContext";
import { Button } from "@/components/ui/button";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useNavigate } from "react-router-dom";

const categoryBackgrounds: Record<string, string> = {
  phone: "from-blue-900/90 via-blue-800/80 to-slate-900/90",
  tv: "from-purple-900/90 via-indigo-800/80 to-slate-900/90",
  computer: "from-emerald-900/90 via-teal-800/80 to-slate-900/90",
  car: "from-orange-900/90 via-red-800/80 to-slate-900/90",
};

export function CategoryHero() {
  const { selectedCategory, config } = useCategory();
  const navigate = useNavigate();

  const handleQuickAction = (type: "buyer" | "seller") => {
    if (type === "buyer") {
      navigate("/my-listings?action=create-request");
    } else {
      navigate("/my-listings");
    }
  };

  return (
    <section
      className={`relative bg-gradient-to-br ${categoryBackgrounds[selectedCategory]} py-12 md:py-16 transition-all duration-500`}
    >
      <div className="absolute inset-0 opacity-10">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-white/20 to-transparent" />
      </div>

      <div className="container relative z-10 max-w-4xl mx-auto px-4">
        <div className="text-5xl md:text-6xl mb-4">
          {config.icon}
        </div>

        <h1 className="font-orbitron text-3xl md:text-5xl font-bold text-white mb-3">
          {config.heroText}
        </h1>
        <p className="text-lg md:text-xl text-white/80 mb-6">
          {config.heroSubtext}
        </p>

        <div className="relative max-w-xl mx-auto mb-6">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
          <Input
            placeholder={config.searchPlaceholder}
            className="pl-12 h-14 text-base bg-background/95 border-0 shadow-lg rounded-xl"
            onFocus={() => navigate("/browse")}
          />
        </div>

        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          {config.quickActions.map((action, index) => (
            <Button
              key={index}
              onClick={() => handleQuickAction(action.type)}
              variant={action.type === "buyer" ? "default" : "outline"}
              size="lg"
              className={
                action.type === "buyer"
                  ? "bg-teal hover:bg-teal/90 text-teal-foreground border-0 shadow-lg"
                  : "bg-white/10 hover:bg-white/20 text-white border-white/30"
              }
            >
              {action.label}
            </Button>
          ))}
        </div>
      </div>
    </section>
  );
}

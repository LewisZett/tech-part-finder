import { Package } from "lucide-react";

interface PartImagePlaceholderProps {
  category?: string;
  className?: string;
}

const categoryIcons: Record<string, string> = {
  "Phone Spare Parts": "📱",
  "TV Spare Parts": "📺",
  "Computer Spare Parts": "🖥️",
  "Car Spare Parts": "🚗",
};

export function PartImagePlaceholder({ category, className = "" }: PartImagePlaceholderProps) {
  const icon = category ? categoryIcons[category] : null;

  return (
    <div className={`w-full h-48 bg-gradient-to-br from-muted to-muted/50 flex items-center justify-center ${className}`}>
      {icon ? (
        <span className="text-6xl opacity-30">{icon}</span>
      ) : (
        <Package className="h-16 w-16 text-muted-foreground/30" />
      )}
    </div>
  );
}

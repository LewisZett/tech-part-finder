import { Package } from "lucide-react";
import phonePartsThumbnail from "@/assets/phone-parts-thumbnail.png";

interface PartImagePlaceholderProps {
  category?: string;
  className?: string;
}

const categoryIcons: Record<string, string> = {
  "TV Spare Parts": "📺",
  "Computer Spare Parts": "🖥️",
  "Car Spare Parts": "🚗",
};

export function PartImagePlaceholder({ category, className = "" }: PartImagePlaceholderProps) {
  // Use custom thumbnail image for phone parts category
  if (category === "Phone Spare Parts") {
    return (
      <div className={`w-full h-48 overflow-hidden ${className}`}>
        <img 
          src={phonePartsThumbnail} 
          alt="Phone Spare Parts" 
          className="w-full h-full object-cover"
        />
      </div>
    );
  }

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

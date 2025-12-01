import { Package } from "lucide-react";
import phonePartsThumbnail from "@/assets/phone-parts-thumbnail.png";
import computerPartsThumbnail from "@/assets/computer-parts-thumbnail.png";
import tvPartsThumbnail from "@/assets/tv-parts-thumbnail.png";
import carPartsThumbnail from "@/assets/car-parts-thumbnail.png";

interface PartImagePlaceholderProps {
  category?: string;
  className?: string;
}

const categoryThumbnails: Record<string, string> = {
  "Phone Spare Parts": phonePartsThumbnail,
  "Computer Spare Parts": computerPartsThumbnail,
  "TV Spare Parts": tvPartsThumbnail,
  "Car Spare Parts": carPartsThumbnail,
};

export function PartImagePlaceholder({ category, className = "" }: PartImagePlaceholderProps) {
  // Use custom thumbnail image if available
  const thumbnail = category ? categoryThumbnails[category] : null;
  
  if (thumbnail) {
    return (
      <div className={`w-full h-48 overflow-hidden ${className}`}>
        <img 
          src={thumbnail} 
          alt={category} 
          className="w-full h-full object-cover"
        />
      </div>
    );
  }

  return (
    <div className={`w-full h-48 bg-gradient-to-br from-muted to-muted/50 flex items-center justify-center ${className}`}>
      <Package className="h-16 w-16 text-muted-foreground/30" />
    </div>
  );
}

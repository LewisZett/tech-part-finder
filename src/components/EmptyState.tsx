import { ReactNode } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Package, ShoppingCart, Search } from "lucide-react";

interface EmptyStateProps {
  type: "parts" | "requests" | "search";
  title?: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
  icon?: ReactNode;
}

const defaultConfig = {
  parts: {
    icon: <Package className="h-16 w-16 text-muted-foreground/50" />,
    title: "No spare parts listed yet",
    description: "Be the first to list spare parts in this category",
    actionLabel: "List a Part",
  },
  requests: {
    icon: <ShoppingCart className="h-16 w-16 text-muted-foreground/50" />,
    title: "No requests found",
    description: "No one is looking for parts in this category right now",
    actionLabel: "Post a Request",
  },
  search: {
    icon: <Search className="h-16 w-16 text-muted-foreground/50" />,
    title: "No results found",
    description: "Try adjusting your search or switching categories",
    actionLabel: "Clear Search",
  },
};

export function EmptyState({
  type,
  title,
  description,
  actionLabel,
  onAction,
  icon,
}: EmptyStateProps) {
  const config = defaultConfig[type];

  return (
    <Card className="border-dashed">
      <CardContent className="flex flex-col items-center justify-center py-16 text-center">
        <div className="mb-6 p-4 rounded-full bg-muted/50">
          {icon || config.icon}
        </div>
        <h3 className="text-lg font-semibold text-foreground mb-2">
          {title || config.title}
        </h3>
        <p className="text-muted-foreground text-sm max-w-sm mb-6">
          {description || config.description}
        </p>
        {onAction && (
          <Button onClick={onAction} variant="default">
            {actionLabel || config.actionLabel}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

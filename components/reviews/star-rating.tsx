import { Star } from "lucide-react";
import { cn } from "@/lib/utils";

const SIZE_MAP = { sm: "size-3", md: "size-3.5", lg: "size-5" };

export function StarRating({
  rating,
  size = "md",
  showNumber = false,
}: {
  rating: number;
  size?: "sm" | "md" | "lg";
  showNumber?: boolean;
}) {
  return (
    <div className="flex items-center gap-0.5" role="img" aria-label={`Rating ${rating} dari 5 bintang`}>
      {Array.from({ length: 5 }).map((_, i) => (
        <Star
          key={i}
          className={cn(SIZE_MAP[size], i < rating ? "fill-accent text-accent" : "fill-transparent text-border-strong")}
        />
      ))}
      {showNumber && <span className="ml-1 text-sm font-medium text-foreground">{rating.toFixed(1)}</span>}
    </div>
  );
}

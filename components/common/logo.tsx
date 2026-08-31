import Image from "next/image";
import { cn } from "@/lib/utils";

/**
 * Suka Shawarma brand mark. Two crops of the same source logo:
 * - "icon" (default): tight crop on the chef's face for small contexts
 *   (sidebar, mobile header) where the full illustration would be unreadable.
 * - "full": the complete circular badge + wordmark, for larger moments
 *   (login screen).
 */
export function Logo({
  className,
  size = 32,
  variant = "icon",
}: {
  className?: string;
  size?: number;
  variant?: "icon" | "full";
}) {
  const src = variant === "full" ? "/logo-suka-shawarma.png" : "/logo-icon.png";

  return (
    <Image
      src={src}
      alt="Suka Shawarma"
      width={size}
      height={size}
      className={cn("shrink-0", variant === "icon" ? "rounded-full object-cover" : "object-contain", className)}
      priority
    />
  );
}

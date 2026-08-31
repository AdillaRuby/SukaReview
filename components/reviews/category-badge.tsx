import { Badge } from "@/components/ui/badge";
import { CATEGORY_LABELS } from "@/lib/taxonomy";
import type { ReviewCategoryTag } from "@/types/database";

export function CategoryBadge({ category }: { category: ReviewCategoryTag }) {
  return <Badge variant="outline">{CATEGORY_LABELS[category]}</Badge>;
}

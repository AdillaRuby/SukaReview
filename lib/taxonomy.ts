import type { ReviewCategoryTag } from "@/types/database";

/**
 * Controlled category taxonomy. Gemini is instructed (lib/gemini/prompt.ts)
 * to only ever pick from this fixed list — never invent new categories.
 */
export const REVIEW_CATEGORIES: ReviewCategoryTag[] = [
  "RASA",
  "PELAYANAN",
  "KECEPATAN",
  "KEBERSIHAN",
  "HARGA",
  "PORSI",
  "PESANAN_SALAH",
  "STAFF",
  "TEMPAT",
  "DELIVERY",
  "KUALITAS_PRODUK",
  "LAINNYA",
];

export const CATEGORY_LABELS: Record<ReviewCategoryTag, string> = {
  RASA: "Rasa",
  PELAYANAN: "Pelayanan",
  KECEPATAN: "Kecepatan",
  KEBERSIHAN: "Kebersihan",
  HARGA: "Harga",
  PORSI: "Porsi",
  PESANAN_SALAH: "Pesanan Salah",
  STAFF: "Staff",
  TEMPAT: "Tempat",
  DELIVERY: "Delivery",
  KUALITAS_PRODUK: "Kualitas Produk",
  LAINNYA: "Lainnya",
};

export function isReviewCategory(value: string): value is ReviewCategoryTag {
  return (REVIEW_CATEGORIES as string[]).includes(value);
}

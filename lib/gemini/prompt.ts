import { REVIEW_CATEGORIES } from "@/lib/taxonomy";

interface PromptInput {
  outletName: string;
  rating: number;
  comment: string | null;
}

/**
 * Builds the Gemini prompt for a single review. Kept deliberately strict:
 * the model must only pick from the controlled taxonomy, never invent tags.
 */
export function buildAnalysisPrompt({ outletName, rating, comment }: PromptInput): string {
  return `Kamu adalah analis internal untuk brand F&B "Suka Shawarma". Analisis satu review Google berikut dari outlet "${outletName}".

Rating: ${rating}/5
Komentar: ${comment ? `"${comment}"` : "(tidak ada komentar, hanya rating)"}

Tugas:
1. Tentukan sentiment keseluruhan: "positive", "neutral", atau "negative".
2. Pilih 1-4 kategori yang PALING relevan HANYA dari daftar berikut (jangan buat kategori baru, gunakan persis nama ini):
${REVIEW_CATEGORIES.join(", ")}
3. Tulis summary singkat (maks 160 karakter) dalam Bahasa Indonesia.
4. Tentukan urgency operasional: "low", "medium", atau "high" (high = butuh tindakan segera, misalnya keluhan keamanan pangan, pelayanan sangat buruk, atau pesanan salah berulang).
5. Untuk tiap kategori yang dipilih, tentukan aspect_sentiment spesifik untuk kategori itu (bisa berbeda dari sentiment keseluruhan, contoh: rasa enak tapi pelayanan lambat).

Jika komentar kosong (hanya rating), tentukan sentiment berdasarkan rating saja (5=positive, 4=positive, 3=neutral, 1-2=negative), kategori boleh ["LAINNYA"], dan summary singkat seperti "Rating tanpa komentar".

Jawab HANYA dalam format JSON sesuai schema yang diberikan.`;
}

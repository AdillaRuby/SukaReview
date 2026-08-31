import { z } from "zod";
import { REVIEW_CATEGORIES } from "@/lib/taxonomy";
import type { ReviewCategoryTag } from "@/types/database";

const categoryEnum = z.enum(
  REVIEW_CATEGORIES as [ReviewCategoryTag, ...ReviewCategoryTag[]]
);

const sentimentEnum = z.enum(["positive", "neutral", "negative"]);

export const geminiAnalysisSchema = z.object({
  sentiment: sentimentEnum,
  categories: z.array(categoryEnum).min(1).max(4),
  summary: z.string().min(1).max(160),
  urgency: z.enum(["low", "medium", "high"]),
  aspects: z
    .array(
      z.object({
        category: categoryEnum,
        sentiment: sentimentEnum,
      })
    )
    .max(4),
});

export type GeminiAnalysisResult = z.infer<typeof geminiAnalysisSchema>;

/** The raw JSON schema handed to Gemini's structured-output config. */
export const geminiResponseJsonSchema = {
  type: "object",
  properties: {
    sentiment: { type: "string", enum: ["positive", "neutral", "negative"] },
    categories: {
      type: "array",
      items: { type: "string", enum: REVIEW_CATEGORIES },
      minItems: 1,
      maxItems: 4,
    },
    summary: { type: "string" },
    urgency: { type: "string", enum: ["low", "medium", "high"] },
    aspects: {
      type: "array",
      items: {
        type: "object",
        properties: {
          category: { type: "string", enum: REVIEW_CATEGORIES },
          sentiment: { type: "string", enum: ["positive", "neutral", "negative"] },
        },
        required: ["category", "sentiment"],
      },
      maxItems: 4,
    },
  },
  required: ["sentiment", "categories", "summary", "urgency", "aspects"],
} as const;

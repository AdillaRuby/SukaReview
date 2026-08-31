import { GoogleGenAI } from "@google/genai";
import { buildAnalysisPrompt } from "./prompt";
import { geminiAnalysisSchema, geminiResponseJsonSchema, type GeminiAnalysisResult } from "./schema";

const MODEL = "gemini-2.5-flash";

let client: GoogleGenAI | null = null;

function getClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not configured");
  }
  if (!client) {
    client = new GoogleGenAI({ apiKey });
  }
  return client;
}

export interface AnalyzeReviewInput {
  outletName: string;
  rating: number;
  comment: string | null;
}

/**
 * Runs Gemini structured-output analysis for a single review.
 * Throws on any failure (network, invalid JSON, schema mismatch) — the
 * caller (lib/gemini/analyze-review.ts) is responsible for marking the
 * review's analysis_status as "failed" rather than losing the review.
 */
export async function analyzeReviewWithGemini(
  input: AnalyzeReviewInput
): Promise<GeminiAnalysisResult> {
  const ai = getClient();

  const response = await ai.models.generateContent({
    model: MODEL,
    contents: buildAnalysisPrompt(input),
    config: {
      responseMimeType: "application/json",
      responseJsonSchema: geminiResponseJsonSchema,
      temperature: 0.2,
    },
  });

  const text = response.text;
  if (!text) {
    throw new Error("Gemini returned an empty response");
  }

  const parsed = JSON.parse(text);
  return geminiAnalysisSchema.parse(parsed);
}

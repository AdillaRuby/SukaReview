/**
 * Seeds demo data: all DEMO_OUTLETS + ~80 realistic reviews spread over the
 * last 90 days, with pre-baked Gemini-shaped analysis (no API key needed).
 * One outlet is deliberately given a recent negative burst so the
 * "Outlet Butuh Perhatian" panel and Alerts page aren't empty on first run.
 *
 * Usage: npm run seed
 */
import { config } from "dotenv";
import { existsSync } from "fs";
import { createClient } from "@supabase/supabase-js";
import {
  DEMO_OUTLETS,
  DEMO_REVIEW_TEMPLATES,
  pickRandom,
  randomReviewerName,
} from "../lib/google/demo-data";

const envFile = existsSync(".env.local") ? ".env.local" : ".env";
config({ path: envFile });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error(
    "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.\n" +
      `Checked ${envFile} — copy .env.example to .env.local and fill in your Supabase project keys first.`
  );
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/suka shawarma/i, "")
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function randomTimestamp(daysAgo: number): string {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  d.setHours(8 + Math.floor(Math.random() * 13), Math.floor(Math.random() * 60));
  return d.toISOString();
}

async function main() {
  console.log(`Seeding SukaReview demo data into ${SUPABASE_URL} ...`);

  console.log(`\n1/3 Upserting ${DEMO_OUTLETS.length} outlets...`);
  const outletIds: { id: string; name: string }[] = [];

  for (const seed of DEMO_OUTLETS) {
    const { data, error } = await supabase
      .from("outlets")
      .upsert(
        {
          google_location_id: seed.locationId,
          google_place_id: `ChIJdemo${seed.slug}`,
          name: seed.name,
          slug: slugify(seed.name) || seed.slug,
          address: seed.address,
          city: seed.city,
          latitude: seed.latitude,
          longitude: seed.longitude,
        },
        { onConflict: "google_location_id" }
      )
      .select("id, name")
      .single();

    if (error) {
      console.error(`  ✗ ${seed.name}: ${error.message}`);
      continue;
    }
    outletIds.push(data);
  }
  console.log(`  ✓ ${outletIds.length} outlets ready`);

  console.log("\n2/3 Generating reviews...");
  const troubledOutlet = outletIds[0]; // Suka Shawarma Cibubur — gets a deliberate negative burst.
  let totalReviews = 0;

  for (const outlet of outletIds) {
    const reviewCount = 3 + Math.floor(Math.random() * 6);

    for (let i = 0; i < reviewCount; i++) {
      const template = pickRandom(DEMO_REVIEW_TEMPLATES);
      const daysAgo = Math.floor(Math.random() ** 2 * 90);
      await insertReview(outlet.id, template, randomTimestamp(daysAgo));
      totalReviews += 1;
    }
  }

  // Deliberate negative burst on one outlet in the last 20 hours, so the
  // NEGATIVE_SPIKE / LOW_RATING_REVIEW alert rules have something to fire on.
  if (troubledOutlet) {
    const negativeTemplates = DEMO_REVIEW_TEMPLATES.filter((t) => t.sentiment === "negative");
    for (let i = 0; i < 4; i++) {
      const template = pickRandom(negativeTemplates);
      const hoursAgo = i * 4 + 1;
      const d = new Date();
      d.setHours(d.getHours() - hoursAgo);
      await insertReview(troubledOutlet.id, template, d.toISOString());
      totalReviews += 1;
    }
    console.log(`  ✓ added negative burst to ${troubledOutlet.name} (for alert demo)`);
  }

  console.log(`  ✓ ${totalReviews} reviews inserted`);

  console.log("\n3/3 Recomputing outlet stats + alerts...");
  for (const outlet of outletIds) {
    await recomputeStats(outlet.id);
  }
  if (troubledOutlet) {
    await evaluateAlerts(troubledOutlet.id, troubledOutlet.name);
  }

  console.log("\nDone. Run `npm run dev` and open /dashboard.");
}

async function insertReview(
  outletId: string,
  template: (typeof DEMO_REVIEW_TEMPLATES)[number],
  createdAt: string
) {
  const googleReviewId = `demo-seed-${outletId}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

  const { data: review, error } = await supabase
    .from("reviews")
    .insert({
      google_review_id: googleReviewId,
      outlet_id: outletId,
      reviewer_name: randomReviewerName(),
      rating: template.rating,
      comment: template.comment,
      google_created_at: createdAt,
      google_updated_at: createdAt,
      sentiment: template.sentiment,
      ai_summary: template.summary,
      urgency: template.urgency,
      analysis_status: "completed",
      synced_at: new Date().toISOString(),
    })
    .select("id")
    .single();

  if (error || !review) {
    console.error(`  ✗ failed to insert review: ${error?.message}`);
    return;
  }

  if (template.categories.length > 0) {
    await supabase.from("review_categories").insert(
      template.categories.map((category) => ({
        review_id: review.id,
        category,
        aspect_sentiment: template.aspects[category] ?? template.sentiment,
      }))
    );
  }
}

async function recomputeStats(outletId: string) {
  const { data: reviews } = await supabase.from("reviews").select("rating").eq("outlet_id", outletId);
  const total = reviews?.length ?? 0;
  const avg = total > 0 ? Math.round((reviews!.reduce((s, r) => s + r.rating, 0) / total) * 10) / 10 : 0;

  const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { count: neg24h } = await supabase
    .from("reviews")
    .select("id", { count: "exact", head: true })
    .eq("outlet_id", outletId)
    .lte("rating", 2)
    .gte("google_created_at", since24h);

  let status: "good" | "watch" | "attention" | "critical" = "good";
  if ((neg24h ?? 0) >= 4) status = "critical";
  else if ((neg24h ?? 0) >= 2) status = "attention";
  else if (avg > 0 && avg < 4.0) status = "watch";

  await supabase.from("outlets").update({ current_rating: avg, total_reviews: total, status }).eq("id", outletId);
}

async function evaluateAlerts(outletId: string, outletName: string) {
  const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { count } = await supabase
    .from("reviews")
    .select("id", { count: "exact", head: true })
    .eq("outlet_id", outletId)
    .lte("rating", 2)
    .gte("google_created_at", since24h);

  if ((count ?? 0) >= 3) {
    await supabase.from("alerts").insert({
      outlet_id: outletId,
      type: "NEGATIVE_SPIKE",
      severity: (count ?? 0) >= 4 ? "critical" : "high",
      title: outletName,
      message: `${count} review rating ≤2⭐ masuk dalam 24 jam.`,
      status: "active",
    });
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

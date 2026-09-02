/**
 * Resolves each outlet in scripts/places-outlets.ts to a Google Place ID via
 * Places API Text Search, confirms the match interactively, then upserts it
 * into `outlets` (conflict key: slug). Run once, or whenever outlets change.
 *
 * Usage: npm run resolve-places
 */
import { config } from "dotenv";
import { existsSync } from "fs";
import { createInterface } from "readline/promises";
import { createClient } from "@supabase/supabase-js";
import { searchPlaceText } from "../lib/places/client";
import { slugify } from "../lib/google/slugify";
import { REAL_OUTLETS } from "./places-outlets";

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

const scrapeMode = process.env.GOOGLE_PLACES_MODE === "scrape";

if (!scrapeMode && !process.env.GOOGLE_PLACES_API_KEY) {
  console.error("Missing GOOGLE_PLACES_API_KEY in your environment.");
  process.exit(1);
}

if (scrapeMode && !process.env.PUPPETEER_EXECUTABLE_PATH) {
  console.error(
    "GOOGLE_PLACES_MODE=scrape but PUPPETEER_EXECUTABLE_PATH is not set — this script runs locally, " +
      "point it at your installed Chrome (see .env.example)."
  );
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
const rl = createInterface({ input: process.stdin, output: process.stdout });

async function main() {
  if (REAL_OUTLETS.length === 0) {
    console.error("scripts/places-outlets.ts is empty — add your real outlets to REAL_OUTLETS first.");
    process.exit(1);
  }

  let resolved = 0;
  let skipped = 0;
  let failed = 0;

  for (const outlet of REAL_OUTLETS) {
    console.log(`\nSearching: "${outlet.searchQuery}"...`);

    let candidate;
    try {
      candidate = await searchPlaceText(outlet.searchQuery);
    } catch (err) {
      console.error(`  Search failed: ${err instanceof Error ? err.message : err}`);
      failed += 1;
      continue;
    }

    if (!candidate) {
      console.log(`  No match found — skipping.`);
      skipped += 1;
      continue;
    }

    console.log(`  Found: ${candidate.name}`);
    console.log(`    Place ID: ${candidate.placeId}`);
    console.log(`    Address:  ${candidate.address ?? "(none)"}`);
    console.log(`    Rating:   ${candidate.rating ?? "-"} (${candidate.userRatingCount ?? 0} reviews)`);

    const answer = (await rl.question(`  Use this for "${outlet.name}"? [y/N] `)).trim().toLowerCase();
    if (answer !== "y") {
      console.log("  Skipped.");
      skipped += 1;
      continue;
    }

    const { error } = await supabase.from("outlets").upsert(
      {
        slug: slugify(outlet.name),
        name: outlet.name,
        city: outlet.city,
        address: candidate.address,
        latitude: candidate.latitude,
        longitude: candidate.longitude,
        google_place_id: candidate.placeId,
      },
      { onConflict: "slug" }
    );

    if (error) {
      console.error(`  Failed to save: ${error.message}`);
      failed += 1;
      continue;
    }

    console.log("  Saved.");
    resolved += 1;
  }

  rl.close();
  console.log(`\nDone. Resolved: ${resolved}, skipped: ${skipped}, failed: ${failed}.`);
}

main();

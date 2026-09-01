import puppeteerCore from "puppeteer-core";
import { addExtra } from "puppeteer-extra";
import StealthPlugin from "puppeteer-extra-plugin-stealth";
import type { PlaceDetails, PlaceSearchResult } from "@/types/places";
import type { GoogleReview } from "@/types/google";
import { parseAggregateRating, parseReviewStars, parseRelativeTimeToISO } from "./scrape-parse";

// Deliberately does NOT `import "server-only"` — same reasoning as
// lib/places/client.ts: nothing here needs to run outside Next, but
// keeping the whole lib/places/ directory consistent avoids surprises if
// a future script imports this module too.

const puppeteer = addExtra(puppeteerCore);
puppeteer.use(StealthPlugin());

async function launchBrowser() {
  if (process.env.VERCEL) {
    const chromium = (await import("@sparticuz/chromium")).default;
    return puppeteer.launch({
      args: chromium.args,
      executablePath: await chromium.executablePath(),
      headless: true,
    });
  }

  const localExecutablePath = process.env.PUPPETEER_EXECUTABLE_PATH;
  if (!localExecutablePath) {
    throw new Error(
      "PUPPETEER_EXECUTABLE_PATH is not set. For local development, set it in .env.local to your " +
        'installed Chrome\'s path (e.g. "C:\\\\Program Files\\\\Google\\\\Chrome\\\\Application\\\\chrome.exe" ' +
        'on Windows, "/usr/bin/google-chrome" on Linux, or ' +
        '"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" on macOS).'
    );
  }
  return puppeteer.launch({ executablePath: localExecutablePath, headless: true });
}

type LaunchedBrowser = Awaited<ReturnType<typeof launchBrowser>>;
type LaunchedPage = Awaited<ReturnType<LaunchedBrowser["newPage"]>>;

async function withBrowser<T>(fn: (page: LaunchedPage) => Promise<T>): Promise<T> {
  const browser = await launchBrowser();
  try {
    const page = await browser.newPage();
    await page.setExtraHTTPHeaders({ "Accept-Language": "id-ID,id;q=0.9" });
    return await fn(page);
  } finally {
    await browser.close();
  }
}

interface PlacePageBasics {
  name: string;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  rating: number | null;
  userRatingCount: number | null;
}

/**
 * Extracts name/address/lat-lng/rating from whatever place page the given
 * Page is currently on. Shared by scrapeSearchPlaceText (after landing on
 * a search result) and scrapeGetPlaceDetails (after navigating directly to
 * a stored URL).
 */
async function scrapePlacePageBasics(page: LaunchedPage): Promise<PlacePageBasics | null> {
  const url = page.url();
  const latLngMatch = url.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);

  const raw = await page.evaluate(() => {
    const addressBtn = document.querySelector('[aria-label^="Alamat:"], [aria-label^="Address:"]');
    const ratingEl = document.querySelector(
      'span[role="img"][aria-label*="bintang"], span[role="img"][aria-label*="star"]'
    );
    return {
      title: document.title,
      address:
        addressBtn?.getAttribute("aria-label")?.replace(/^(Alamat|Address):\s*/i, "").trim() ?? null,
      ratingAriaLabel: ratingEl?.getAttribute("aria-label") ?? null,
    };
  });

  // Google sets the tab title to "<Place Name> - Google Maps" on a place
  // page — verified live during design, more reliable than hunting for a
  // specific heading element/class (which differs between a plain place
  // page and a place opened from a search-results split view).
  const name = raw.title.replace(/\s*-\s*Google Maps\s*$/i, "").trim();
  if (!name) return null;

  const aggregate = raw.ratingAriaLabel ? parseAggregateRating(raw.ratingAriaLabel) : null;

  return {
    name,
    address: raw.address,
    latitude: latLngMatch ? parseFloat(latLngMatch[1]) : null,
    longitude: latLngMatch ? parseFloat(latLngMatch[2]) : null,
    rating: aggregate?.rating ?? null,
    userRatingCount: aggregate?.reviewCount ?? null,
  };
}

/** Text-search bootstrap — used only by scripts/resolve-places.ts. */
export async function scrapeSearchPlaceText(query: string): Promise<PlaceSearchResult | null> {
  return withBrowser(async (page) => {
    const searchUrl = `https://www.google.com/maps/search/${encodeURIComponent(query)}`;
    await page.goto(searchUrl, { waitUntil: "networkidle2", timeout: 30000 });

    // A distinctive query often makes Google redirect straight to the
    // place page. Otherwise, click the first result in the results list.
    if (!page.url().includes("/maps/place/")) {
      const firstResult = await page.$('a[href*="/maps/place/"]');
      if (!firstResult) return null;
      await Promise.all([
        page.waitForNavigation({ waitUntil: "networkidle2", timeout: 30000 }).catch(() => {}),
        firstResult.click(),
      ]);
    }

    const basics = await scrapePlacePageBasics(page);
    if (!basics) return null;

    return {
      placeId: page.url(),
      name: basics.name,
      address: basics.address,
      latitude: basics.latitude,
      longitude: basics.longitude,
      rating: basics.rating,
      userRatingCount: basics.userRatingCount,
    };
  });
}

interface RawScrapedReview {
  reviewId: string;
  reviewerName: string;
  starAriaLabel: string | null;
  relativeTime: string | null;
  text: string | null;
}

/** Place details + reviews — placeUrl is a URL previously returned as `placeId`. */
export async function scrapeGetPlaceDetails(placeUrl: string): Promise<PlaceDetails> {
  return withBrowser(async (page) => {
    await page.goto(placeUrl, { waitUntil: "networkidle2", timeout: 30000 });

    const basics = await scrapePlacePageBasics(page);
    if (!basics) {
      throw new Error(`Blocked or CAPTCHA'd while scraping ${placeUrl} (no page title found)`);
    }

    const reviewsTab = await page.$('[aria-label^="Ulasan untuk"], [aria-label^="Reviews for"]');
    if (reviewsTab) {
      await reviewsTab.click();
      await page.waitForSelector("div[data-review-id]", { timeout: 15000 }).catch(() => {});
    }

    // Reviews lazy-load as the panel scrolls. A few scrolls is enough to
    // load well over 5 reviews (verified during design) without trying to
    // exhaustively paginate history — matches the API mode's own "up to a
    // handful per poll" character.
    for (let i = 0; i < 3; i++) {
      await page.evaluate(() => {
        const firstReview = document.querySelector("div[data-review-id]");
        const scrollable = firstReview?.closest('[role="main"]') ?? firstReview?.parentElement?.parentElement;
        scrollable?.scrollBy(0, 800);
      });
      await new Promise((resolve) => setTimeout(resolve, 800));
    }

    const rawReviews: RawScrapedReview[] = await page.evaluate(() => {
      return Array.from(document.querySelectorAll("div[data-review-id]")).map((el) => {
        const starEl = el.querySelector(
          'span[role="img"][aria-label$=" bintang"], span[role="img"][aria-label$=" star"], span[role="img"][aria-label$=" stars"]'
        );
        const timeEl = el.querySelector(".rsqaWe");
        const textEl = el.querySelector(".wiI7pd");
        return {
          reviewId: el.getAttribute("data-review-id") ?? "",
          reviewerName: el.getAttribute("aria-label") ?? "",
          starAriaLabel: starEl?.getAttribute("aria-label") ?? null,
          relativeTime: timeEl?.textContent?.trim() ?? null,
          text: textEl?.textContent?.trim() ?? null,
        };
      });
    });

    const reviews: GoogleReview[] = [];
    for (const raw of rawReviews) {
      if (!raw.reviewId || !raw.starAriaLabel) continue;
      const stars = parseReviewStars(raw.starAriaLabel);
      if (!stars) continue;

      const timestamp = (raw.relativeTime && parseRelativeTimeToISO(raw.relativeTime)) ?? new Date().toISOString();

      reviews.push({
        reviewId: raw.reviewId,
        locationId: placeUrl,
        reviewer: { displayName: raw.reviewerName || "Google User", photoUrl: null },
        starRating: stars,
        comment: raw.text,
        createTime: timestamp,
        updateTime: timestamp,
      });
    }

    return {
      rating: basics.rating,
      userRatingCount: basics.userRatingCount,
      reviews,
    };
  });
}

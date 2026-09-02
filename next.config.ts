import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // @sparticuz/chromium resolves its Brotli-compressed binary by runtime
  // filesystem path, and puppeteer-extra-plugin-stealth requires its
  // evasion modules dynamically — both need to run as plain Node code
  // rather than get bundled by webpack, which is what this option is for.
  // Only reached at runtime when GOOGLE_PLACES_MODE=scrape actually
  // imports lib/places/scrape-browser.ts.
  serverExternalPackages: [
    "@sparticuz/chromium",
    "puppeteer-core",
    "puppeteer-extra",
    "puppeteer-extra-plugin-stealth",
  ],
};

export default nextConfig;

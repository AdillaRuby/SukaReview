import { isLiveMode } from "./auth";
import { DEMO_OUTLETS, toGoogleLocation, demoAccount } from "./demo-data";
import type { GoogleLocation } from "@/types/google";

const BUSINESS_INFO_BASE = "https://mybusinessbusinessinformation.googleapis.com/v1";
const READ_MASK = "name,title,storefrontAddress,latlng,metadata";

interface RawLocationsResponse {
  locations?: Array<{
    name: string;
    title: string;
    storefrontAddress?: { addressLines?: string[]; locality?: string };
    latlng?: { latitude: number; longitude: number };
    metadata?: { placeId?: string };
  }>;
  nextPageToken?: string;
}

/** Lists every outlet (location) under a Business Profile account. */
export async function listGoogleLocations(
  accessToken: string,
  accountId: string
): Promise<GoogleLocation[]> {
  if (!isLiveMode()) {
    return DEMO_OUTLETS.map((seed) => toGoogleLocation(seed, demoAccount.accountId));
  }

  const locations: GoogleLocation[] = [];
  let pageToken: string | undefined;

  do {
    const url = new URL(`${BUSINESS_INFO_BASE}/accounts/${accountId}/locations`);
    url.searchParams.set("readMask", READ_MASK);
    url.searchParams.set("pageSize", "100");
    if (pageToken) url.searchParams.set("pageToken", pageToken);

    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
      cache: "no-store",
    });

    if (!res.ok) {
      throw new Error(`Google locations.list failed: ${res.status} ${await res.text()}`);
    }

    const data = (await res.json()) as RawLocationsResponse;

    for (const loc of data.locations ?? []) {
      locations.push({
        locationId: loc.name,
        accountId,
        name: loc.title,
        placeId: loc.metadata?.placeId ?? null,
        address: loc.storefrontAddress?.addressLines?.join(", ") ?? null,
        city: loc.storefrontAddress?.locality ?? null,
        latitude: loc.latlng?.latitude ?? null,
        longitude: loc.latlng?.longitude ?? null,
      });
    }

    pageToken = data.nextPageToken;
  } while (pageToken);

  return locations;
}

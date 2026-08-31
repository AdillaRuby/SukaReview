import { isLiveMode } from "./auth";
import { demoAccount } from "./demo-data";
import type { GoogleAccount } from "@/types/google";

const ACCOUNT_MGMT_BASE = "https://mybusinessaccountmanagement.googleapis.com/v1";

interface RawAccountsResponse {
  accounts?: Array<{ name: string; accountName: string; type: string }>;
}

/** Lists the Business Profile accounts the connected OAuth user can manage. */
export async function listGoogleAccounts(accessToken: string): Promise<GoogleAccount[]> {
  if (!isLiveMode()) {
    return [demoAccount];
  }

  const res = await fetch(`${ACCOUNT_MGMT_BASE}/accounts`, {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: "no-store",
  });

  if (!res.ok) {
    throw new Error(`Google accounts.list failed: ${res.status} ${await res.text()}`);
  }

  const data = (await res.json()) as RawAccountsResponse;

  return (data.accounts ?? []).map((account) => ({
    accountId: account.name.replace("accounts/", ""),
    accountName: account.accountName,
    type: account.type,
  }));
}

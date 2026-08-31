import { OAuth2Client } from "google-auth-library";
import type { GoogleOAuthTokens } from "@/types/google";

const SCOPES = ["https://www.googleapis.com/auth/business.manage"];

export function getGoogleMode(): "demo" | "live" {
  return process.env.GOOGLE_MODE === "live" ? "live" : "demo";
}

export function isLiveMode(): boolean {
  return getGoogleMode() === "live";
}

function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not configured`);
  return value;
}

export function createOAuthClient(): OAuth2Client {
  return new OAuth2Client(
    requiredEnv("GOOGLE_CLIENT_ID"),
    requiredEnv("GOOGLE_CLIENT_SECRET"),
    requiredEnv("GOOGLE_REDIRECT_URI")
  );
}

export function buildAuthorizationUrl(state: string): string {
  const client = createOAuthClient();
  return client.generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    scope: SCOPES,
    state,
  });
}

export async function exchangeCodeForTokens(code: string): Promise<GoogleOAuthTokens> {
  const client = createOAuthClient();
  const { tokens } = await client.getToken(code);

  if (!tokens.access_token || !tokens.expiry_date) {
    throw new Error("Google did not return a usable access token");
  }

  return {
    accessToken: tokens.access_token,
    refreshToken: tokens.refresh_token ?? null,
    expiresAt: new Date(tokens.expiry_date).toISOString(),
    scopes: (tokens.scope ?? SCOPES.join(" ")).split(" "),
  };
}

export async function refreshAccessToken(refreshToken: string): Promise<GoogleOAuthTokens> {
  const client = createOAuthClient();
  client.setCredentials({ refresh_token: refreshToken });
  const { credentials } = await client.refreshAccessToken();

  if (!credentials.access_token || !credentials.expiry_date) {
    throw new Error("Google did not return a refreshed access token");
  }

  return {
    accessToken: credentials.access_token,
    refreshToken: credentials.refresh_token ?? refreshToken,
    expiresAt: new Date(credentials.expiry_date).toISOString(),
    scopes: (credentials.scope ?? SCOPES.join(" ")).split(" "),
  };
}

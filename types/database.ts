// Hand-written mirror of sql/*.sql. If you regenerate this from a live
// Supabase project (`supabase gen types typescript`), keep the shape
// identical to what the app expects in lib/supabase/*.

export type ProfileRole = "owner" | "admin" | "viewer";

export type OutletStatus = "good" | "watch" | "attention" | "critical";

export type Sentiment = "positive" | "neutral" | "negative";

export type Urgency = "low" | "medium" | "high";

export type AnalysisStatus = "pending" | "completed" | "failed";

export type ReviewCategoryTag =
  | "RASA"
  | "PELAYANAN"
  | "KECEPATAN"
  | "KEBERSIHAN"
  | "HARGA"
  | "PORSI"
  | "PESANAN_SALAH"
  | "STAFF"
  | "TEMPAT"
  | "DELIVERY"
  | "KUALITAS_PRODUK"
  | "LAINNYA";

export type AlertType =
  | "LOW_RATING_REVIEW"
  | "RATING_DROP"
  | "NEGATIVE_SPIKE"
  | "LOW_OUTLET_RATING";

export type AlertSeverity = "low" | "medium" | "high" | "critical";

export type AlertStatus = "active" | "resolved";

export type GoogleConnectionStatus = "connected" | "disconnected" | "error" | "syncing";

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          full_name: string | null;
          email: string;
          role: ProfileRole;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["profiles"]["Row"]> & {
          id: string;
          email: string;
        };
        Update: Partial<Database["public"]["Tables"]["profiles"]["Row"]>;
      };
      google_connections: {
        Row: {
          id: string;
          account_id: string;
          account_name: string;
          status: GoogleConnectionStatus;
          encrypted_access_token: string | null;
          encrypted_refresh_token: string | null;
          token_expires_at: string | null;
          scopes: string[];
          locations_count: number;
          last_sync_at: string | null;
          last_sync_status: "idle" | "running" | "success" | "failed" | null;
          last_error: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["google_connections"]["Row"]> & {
          account_id: string;
          account_name: string;
        };
        Update: Partial<Database["public"]["Tables"]["google_connections"]["Row"]>;
      };
      outlets: {
        Row: {
          id: string;
          google_location_id: string;
          google_place_id: string | null;
          name: string;
          slug: string;
          address: string | null;
          city: string | null;
          latitude: number | null;
          longitude: number | null;
          current_rating: number;
          total_reviews: number;
          status: OutletStatus;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["outlets"]["Row"]> & {
          google_location_id: string;
          name: string;
          slug: string;
        };
        Update: Partial<Database["public"]["Tables"]["outlets"]["Row"]>;
      };
      reviews: {
        Row: {
          id: string;
          google_review_id: string;
          outlet_id: string;
          reviewer_name: string;
          reviewer_avatar: string | null;
          rating: number;
          comment: string | null;
          google_created_at: string;
          google_updated_at: string | null;
          sentiment: Sentiment | null;
          ai_summary: string | null;
          urgency: Urgency | null;
          analysis_status: AnalysisStatus;
          analysis_error: string | null;
          analysis_attempts: number;
          synced_at: string;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["reviews"]["Row"]> & {
          google_review_id: string;
          outlet_id: string;
          rating: number;
          google_created_at: string;
        };
        Update: Partial<Database["public"]["Tables"]["reviews"]["Row"]>;
      };
      review_categories: {
        Row: {
          id: string;
          review_id: string;
          category: ReviewCategoryTag;
          aspect_sentiment: Sentiment | null;
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["review_categories"]["Row"]> & {
          review_id: string;
          category: ReviewCategoryTag;
        };
        Update: Partial<Database["public"]["Tables"]["review_categories"]["Row"]>;
      };
      alerts: {
        Row: {
          id: string;
          outlet_id: string;
          review_id: string | null;
          type: AlertType;
          severity: AlertSeverity;
          title: string;
          message: string;
          status: AlertStatus;
          created_at: string;
          resolved_at: string | null;
          resolved_by: string | null;
        };
        Insert: Partial<Database["public"]["Tables"]["alerts"]["Row"]> & {
          outlet_id: string;
          type: AlertType;
          severity: AlertSeverity;
          title: string;
          message: string;
        };
        Update: Partial<Database["public"]["Tables"]["alerts"]["Row"]>;
      };
      notification_preferences: {
        Row: {
          id: string;
          user_id: string;
          sound_enabled: boolean;
          sound_volume: number;
          rating_trigger: number | null;
          browser_notification_enabled: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["notification_preferences"]["Row"]> & {
          user_id: string;
        };
        Update: Partial<Database["public"]["Tables"]["notification_preferences"]["Row"]>;
      };
    };
  };
}

export type Tables<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Row"];

import type {
  AlertSeverity,
  AlertStatus,
  AlertType,
  AnalysisStatus,
  OutletStatus,
  ReviewCategoryTag,
  Sentiment,
  Urgency,
} from "./database";

/** Review joined with its outlet + category tags — the shape most UI reads. */
export interface ReviewWithRelations {
  id: string;
  googleReviewId: string;
  outletId: string;
  outletName: string;
  outletSlug: string;
  outletCity: string | null;
  reviewerName: string;
  reviewerAvatar: string | null;
  rating: number;
  comment: string | null;
  googleCreatedAt: string;
  googleUpdatedAt: string | null;
  sentiment: Sentiment | null;
  aiSummary: string | null;
  urgency: Urgency | null;
  analysisStatus: AnalysisStatus;
  categories: ReviewCategoryTag[];
  aspects: Partial<Record<ReviewCategoryTag, Sentiment>>;
  createdAt: string;
}

export interface OutletSummary {
  id: string;
  googleLocationId: string | null;
  name: string;
  slug: string;
  city: string | null;
  address: string | null;
  currentRating: number;
  totalReviews: number;
  reviewsToday: number;
  negativeReviewsToday: number;
  status: OutletStatus;
  isActive: boolean;
}

export interface AlertWithOutlet {
  id: string;
  outletId: string;
  outletName: string;
  outletSlug: string;
  reviewId: string | null;
  type: AlertType;
  severity: AlertSeverity;
  title: string;
  message: string;
  status: AlertStatus;
  createdAt: string;
  resolvedAt: string | null;
}

export interface DashboardKpis {
  overallRating: number;
  overallRatingDeltaWeek: number | null;
  totalOutlets: number;
  reviewsToday: number;
  reviewsTodayDeltaYesterday: number | null;
  negativeToday: number;
}

export interface RatingTrendPoint {
  date: string;
  rating: number;
  reviewCount: number;
}

export interface SentimentBreakdown {
  positive: number;
  neutral: number;
  negative: number;
}

export interface CategoryFrequency {
  category: ReviewCategoryTag;
  count: number;
  percentage: number;
}

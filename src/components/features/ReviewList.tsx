import Card from "@/components/ui/Card";
import UserAvatar from "@/components/ui/UserAvatar";
import { getTranslations, getLocale } from "next-intl/server";
import { formatDate } from "@/lib/i18n/date";

interface ReviewItem {
  id: string;
  rating: number;
  comment: string | null;
  created_at: string;
  reviewer: {
    id: string;
    display_name: string | null;
    avatar_url: string | null;
  };
}

interface Props {
  reviews: ReviewItem[];
}

function StarRating({ rating }: { rating: number }) {
  return (
    <span className="text-base tracking-wider">
      {Array.from({ length: 5 }, (_, i) => (
        <span
          key={i}
          className={
            i < rating
              ? "text-dq-gold"
              : "text-dq-text-muted"
          }
        >
          {i < rating ? "★" : "☆"}
        </span>
      ))}
    </span>
  );
}

export default async function ReviewList({ reviews }: Props) {
  const [t, tCommon, locale] = await Promise.all([
    getTranslations("Knowledge"),
    getTranslations("Common"),
    getLocale(),
  ]);

  if (reviews.length === 0) {
    return (
      <p className="py-4 text-sm text-dq-text-muted">
        {t("noReviews")}
      </p>
    );
  }

  return (
    <div className="space-y-4">
      {reviews.map((review) => (
        <Card key={review.id} padding="md">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-2">
              <UserAvatar userId={review.reviewer.id} displayName={review.reviewer.display_name} avatarUrl={review.reviewer.avatar_url} size="sm" />
              <div>
                <p className="text-sm font-medium text-dq-text">
                  {review.reviewer.display_name || tCommon("anonymous")}
                </p>
                <p className="text-xs text-dq-text-muted">
                  {formatDate(review.created_at, locale)}
                </p>
              </div>
            </div>
            <StarRating rating={review.rating} />
          </div>
          {review.comment && (
            <p className="mt-2 text-sm leading-relaxed text-dq-text-sub">
              {review.comment}
            </p>
          )}
        </Card>
      ))}
    </div>
  );
}

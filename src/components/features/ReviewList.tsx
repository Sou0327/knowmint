import Card from "@/components/ui/Card";

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
              ? "text-amber-400"
              : "text-zinc-300 dark:text-zinc-600"
          }
        >
          {i < rating ? "★" : "☆"}
        </span>
      ))}
    </span>
  );
}

export default function ReviewList({ reviews }: Props) {
  if (reviews.length === 0) {
    return (
      <p className="py-4 text-sm text-zinc-500 dark:text-zinc-400">
        まだレビューはありません
      </p>
    );
  }

  return (
    <div className="space-y-4">
      {reviews.map((review) => (
        <Card key={review.id} padding="md" className="transition-shadow hover:shadow-sm">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-zinc-100 to-zinc-200 text-xs font-bold text-zinc-600 dark:from-zinc-700 dark:to-zinc-800 dark:text-zinc-400">
                {(review.reviewer.display_name || "?")[0].toUpperCase()}
              </div>
              <div>
                <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                  {review.reviewer.display_name || "匿名"}
                </p>
                <p className="text-xs text-zinc-400">
                  {new Date(review.created_at).toLocaleDateString("ja-JP")}
                </p>
              </div>
            </div>
            <StarRating rating={review.rating} />
          </div>
          {review.comment && (
            <p className="mt-2 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
              {review.comment}
            </p>
          )}
        </Card>
      ))}
    </div>
  );
}

export type ReviewItem = {
  productId: string;
  userId: string;
  rating: number;
  title: string;
  body: string;
};

export function ReviewList({ reviews }: { reviews: ReviewItem[] }) {
  if (reviews.length === 0) {
    return <p className="text-graphite">No reviews yet. Be the first.</p>;
  }
  return (
    <ul className="divide-y divide-hairline border-y border-hairline">
      {reviews.map((r, i) => (
        <li key={i} className="py-4">
          <div className="flex items-center justify-between gap-4">
            <h4 className="font-display font-medium text-ink">{r.title}</h4>
            <span aria-label={`${r.rating} out of 5`} className="shrink-0 text-accent">
              {'★'.repeat(r.rating)}
              <span className="text-hairline">{'★'.repeat(5 - r.rating)}</span>
            </span>
          </div>
          <p className="mt-1 text-sm text-graphite">{r.body}</p>
        </li>
      ))}
    </ul>
  );
}

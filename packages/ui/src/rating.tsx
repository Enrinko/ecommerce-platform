import { cn } from './cn';

export function Rating({
  avg,
  count,
  className,
}: {
  avg: number;
  count: number;
  className?: string;
}) {
  if (count === 0) {
    return <span className={cn('text-sm text-graphite', className)}>No reviews yet</span>;
  }
  const filled = Math.round(avg);
  return (
    <span className={cn('inline-flex items-center gap-2 text-sm', className)}>
      <span aria-hidden className="text-accent">
        {'★'.repeat(filled)}
        <span className="text-hairline">{'★'.repeat(5 - filled)}</span>
      </span>
      <span className="font-mono text-ink">{avg.toFixed(1)}</span>
      <span className="text-graphite">
        {count} review{count === 1 ? '' : 's'}
      </span>
    </span>
  );
}

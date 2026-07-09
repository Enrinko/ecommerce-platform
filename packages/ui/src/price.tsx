import { cn } from './cn';

const SYMBOLS: Record<string, string> = { USD: '$', EUR: '€', GBP: '£' };

export function Price({
  cents,
  currency,
  className,
}: {
  cents: number;
  currency: string;
  className?: string;
}) {
  const symbol = SYMBOLS[currency] ?? `${currency} `;
  return (
    <span className={cn('font-mono tabular-nums text-ink', className)}>
      {symbol}
      {(cents / 100).toFixed(2)}
    </span>
  );
}

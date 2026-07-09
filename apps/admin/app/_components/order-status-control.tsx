'use client';

import { useState } from 'react';
import { nextStatuses, type OrderStatusValue } from '@repo/types';
import { Button } from '@repo/ui';

export function OrderStatusControl({
  status,
  onChange,
  pending,
  error,
}: {
  status: OrderStatusValue;
  onChange: (next: OrderStatusValue) => void;
  pending?: boolean;
  error?: string | null;
}) {
  const options = nextStatuses(status);
  const [next, setNext] = useState<OrderStatusValue | ''>('');

  if (options.length === 0) {
    return <p className="text-sm text-graphite">This order is in a final state ({status}).</p>;
  }
  return (
    <div className="flex items-center gap-3">
      <select
        aria-label="New status"
        value={next}
        onChange={(e) => setNext(e.target.value as OrderStatusValue)}
        className="rounded-sm border border-hairline bg-surface px-3 py-2 text-sm text-ink"
      >
        <option value="" disabled>
          Change status…
        </option>
        {options.map((s) => (
          <option key={s} value={s}>
            {s}
          </option>
        ))}
      </select>
      <Button disabled={pending || !next} onClick={() => next && onChange(next)}>
        Apply
      </Button>
      {error && <span className="text-sm text-accent">{error}</span>}
    </div>
  );
}

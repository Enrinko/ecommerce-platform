const SYMBOLS: Record<string, string> = { USD: '$', EUR: '€', GBP: '£' };

export function formatPrice(cents: number, currency: string): string {
  const symbol = SYMBOLS[currency] ?? `${currency} `;
  return `${symbol}${(cents / 100).toFixed(2)}`;
}

export function formatCount(n: number, noun: string): string {
  if (n === 0) return `No ${noun}s`;
  return `${n} ${noun}${n === 1 ? '' : 's'}`;
}

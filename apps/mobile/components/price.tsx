import { Text, type TextStyle } from 'react-native';

const SYMBOLS: Record<string, string> = { USD: '$', EUR: '€', GBP: '£' };

export function Price({
  cents,
  currency,
  style,
}: {
  cents: number;
  currency: string;
  style?: TextStyle;
}) {
  const symbol = SYMBOLS[currency];
  const amount = (cents / 100).toFixed(2);
  return (
    <Text style={[{ fontVariant: ['tabular-nums'], color: '#17171B' }, style]}>
      {symbol ? `${symbol}${amount}` : `${currency} ${amount}`}
    </Text>
  );
}

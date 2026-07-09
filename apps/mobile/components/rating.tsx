import { Text } from 'react-native';

export function Rating({ avg, count }: { avg: number; count: number }) {
  if (count === 0) {
    return <Text style={{ color: '#70707A', fontSize: 13 }}>No reviews yet</Text>;
  }
  return (
    <Text style={{ color: '#70707A', fontSize: 13 }}>
      ★ {avg.toFixed(1)} ({count})
    </Text>
  );
}

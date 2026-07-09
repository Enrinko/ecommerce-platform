import { Pressable, Text, View } from 'react-native';
import type { Product } from '@repo/types';
import { Price } from './price';

export function ProductCard({ product, onPress }: { product: Product; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      style={{
        borderWidth: 1,
        borderColor: '#DAD8D1',
        borderRadius: 6,
        padding: 16,
        marginBottom: 12,
        backgroundColor: '#FFFFFF',
      }}
    >
      <Text style={{ fontSize: 16, fontWeight: '600', color: '#17171B' }}>{product.title}</Text>
      {product.category ? (
        <Text style={{ fontSize: 12, color: '#70707A', marginTop: 2 }}>{product.category.name}</Text>
      ) : null}
      <View style={{ marginTop: 8 }}>
        <Price cents={product.priceCents} currency={product.currency} />
      </View>
    </Pressable>
  );
}

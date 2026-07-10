import { ActivityIndicator, ScrollView, Text, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { Price } from '@/components/price';
import { Rating } from '@/components/rating';
import { AddToCart } from '@/components/add-to-cart';
import { useProduct, useReviews } from '@/lib/catalog';

export default function ProductScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const product = useProduct(slug);
  const reviews = useReviews(product.data?.id ?? '');

  if (product.isLoading) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator />
      </View>
    );
  }
  if (product.isError || !product.data) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ color: '#70707A' }}>Product not found.</Text>
      </View>
    );
  }
  const p = product.data;

  return (
    <ScrollView style={{ backgroundColor: '#EFEEE9' }} contentContainerStyle={{ padding: 16 }}>
      <Text style={{ fontSize: 22, fontWeight: '700', color: '#17171B' }}>{p.title}</Text>
      <View style={{ marginTop: 8 }}>
        <Price cents={p.priceCents} currency={p.currency} style={{ fontSize: 18 }} />
      </View>
      <View style={{ marginTop: 4 }}>
        <Rating avg={p.rating.avg} count={p.rating.count} />
      </View>
      <Text style={{ marginTop: 16, color: '#17171B', lineHeight: 20 }}>{p.description}</Text>

      <View style={{ marginTop: 16 }}>
        <AddToCart product={p} />
      </View>

      <Text style={{ marginTop: 24, fontSize: 16, fontWeight: '600', color: '#17171B' }}>
        Reviews
      </Text>
      {(reviews.data?.items ?? []).length === 0 ? (
        <Text style={{ marginTop: 8, color: '#70707A' }}>No reviews yet.</Text>
      ) : (
        (reviews.data?.items ?? []).map((r, i) => (
          <View
            key={i}
            style={{ marginTop: 12, borderTopWidth: 1, borderTopColor: '#DAD8D1', paddingTop: 12 }}
          >
            <Text style={{ fontWeight: '600', color: '#17171B' }}>
              {r.title} · {r.rating}★
            </Text>
            <Text style={{ marginTop: 2, color: '#70707A' }}>{r.body}</Text>
          </View>
        ))
      )}
    </ScrollView>
  );
}

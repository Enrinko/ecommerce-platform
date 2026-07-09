import { useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, Text, TextInput, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { parseCatalogParams } from '@/lib/catalog-params';
import { useCategories, useProducts } from '@/lib/catalog';
import { ProductCard } from '@/components/product-card';

export default function ShopScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const query = parseCatalogParams(params as Record<string, string | string[] | undefined>);
  const products = useProducts(query);
  const categories = useCategories();
  const [term, setTerm] = useState(query.q ?? '');

  const items = products.data?.items ?? [];
  const total = products.data?.total ?? 0;
  const lastPage = Math.max(1, Math.ceil(total / query.limit));

  return (
    <View style={{ flex: 1, padding: 16 }}>
      <TextInput
        accessibilityLabel="Search products"
        placeholder="Search products"
        value={term}
        onChangeText={setTerm}
        onSubmitEditing={() => router.setParams({ q: term || undefined, page: '1' })}
        style={{
          borderWidth: 1,
          borderColor: '#DAD8D1',
          borderRadius: 6,
          paddingHorizontal: 12,
          paddingVertical: 10,
          marginBottom: 12,
        }}
      />
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
        {(categories.data ?? []).map((c) => (
          <Pressable
            key={c.id}
            onPress={() =>
              router.setParams({
                category: query.category === c.slug ? undefined : c.slug,
                page: '1',
              })
            }
            style={{
              borderWidth: 1,
              borderColor: query.category === c.slug ? '#2440F0' : '#DAD8D1',
              borderRadius: 999,
              paddingHorizontal: 12,
              paddingVertical: 6,
            }}
          >
            <Text style={{ color: query.category === c.slug ? '#2440F0' : '#70707A' }}>
              {c.name}
            </Text>
          </Pressable>
        ))}
      </View>

      {products.isLoading ? (
        <ActivityIndicator />
      ) : products.isError ? (
        <Text style={{ color: '#2440F0' }}>Failed to load products.</Text>
      ) : items.length === 0 ? (
        <Text style={{ color: '#70707A' }}>No products found.</Text>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(p) => p.id}
          renderItem={({ item }) => (
            <ProductCard product={item} onPress={() => router.push(`/shop/${item.slug}`)} />
          )}
          ListFooterComponent={
            lastPage > 1 ? (
              <View
                style={{
                  flexDirection: 'row',
                  justifyContent: 'space-between',
                  paddingVertical: 12,
                }}
              >
                <Pressable
                  disabled={query.page <= 1}
                  onPress={() => router.setParams({ page: String(query.page - 1) })}
                >
                  <Text style={{ color: query.page <= 1 ? '#B0B0B8' : '#2440F0' }}>Previous</Text>
                </Pressable>
                <Text style={{ color: '#70707A' }}>
                  Page {query.page} of {lastPage}
                </Text>
                <Pressable
                  disabled={query.page >= lastPage}
                  onPress={() => router.setParams({ page: String(query.page + 1) })}
                >
                  <Text style={{ color: query.page >= lastPage ? '#B0B0B8' : '#2440F0' }}>Next</Text>
                </Pressable>
              </View>
            ) : null
          }
        />
      )}
    </View>
  );
}

import { useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, Text, TextInput, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { parseCatalogParams } from '@/lib/catalog-params';
import { useCategories, useProducts } from '@/lib/catalog';
import { ProductCard } from '@/components/product-card';
import { CategoryFilter } from '@/components/category-filter';

export default function ShopScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const query = parseCatalogParams(params as Record<string, string | string[] | undefined>);
  const products = useProducts(query);
  const categories = useCategories();
  const [term, setTerm] = useState(query.q ?? '');
  const [filterOpen, setFilterOpen] = useState(false);

  const items = products.data?.items ?? [];
  const total = products.data?.total ?? 0;
  const lastPage = Math.max(1, Math.ceil(total / query.limit));
  const selectedCat = (categories.data ?? []).find((c) => c.slug === query.category);

  return (
    <View style={{ flex: 1, backgroundColor: '#EFEEE9', padding: 16 }}>
      <View style={{ flexDirection: 'row', gap: 8, marginBottom: 12 }}>
        <TextInput
          accessibilityLabel="Search products"
          placeholder="Search products"
          placeholderTextColor="#B0B0B8"
          value={term}
          onChangeText={setTerm}
          onSubmitEditing={() => router.setParams({ q: term || undefined, page: '1' })}
          style={{
            flex: 1,
            borderWidth: 1,
            borderColor: '#DAD8D1',
            borderRadius: 6,
            paddingHorizontal: 12,
            paddingVertical: 10,
            backgroundColor: '#FFFFFF',
            color: '#17171B',
          }}
        />
        <Pressable
          accessibilityRole="button"
          onPress={() => setFilterOpen(true)}
          style={{
            borderWidth: 1,
            borderColor: selectedCat ? '#2440F0' : '#DAD8D1',
            borderRadius: 6,
            paddingHorizontal: 14,
            justifyContent: 'center',
            backgroundColor: '#FFFFFF',
            maxWidth: 140,
          }}
        >
          <Text style={{ color: selectedCat ? '#2440F0' : '#70707A' }} numberOfLines={1}>
            {selectedCat ? selectedCat.name : 'Filter'}
          </Text>
        </Pressable>
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
          showsVerticalScrollIndicator={false}
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

      <CategoryFilter
        categories={categories.data ?? []}
        selected={query.category}
        onSelect={(slug) => router.setParams({ category: slug, page: '1' })}
        visible={filterOpen}
        onClose={() => setFilterOpen(false)}
      />
    </View>
  );
}

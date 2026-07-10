import { Modal, Pressable, ScrollView, Text, View } from 'react-native';
import type { Category } from '@repo/types';

const row = {
  paddingVertical: 14,
  borderBottomWidth: 1,
  borderBottomColor: '#DAD8D1',
} as const;

export function CategoryFilter({
  categories,
  selected,
  onSelect,
  visible,
  onClose,
}: {
  categories: Category[];
  selected: string | undefined;
  onSelect: (slug: string | undefined) => void;
  visible: boolean;
  onClose: () => void;
}) {
  const choose = (slug: string | undefined) => {
    onSelect(slug);
    onClose();
  };
  const label = (active: boolean) => ({
    fontSize: 16,
    color: active ? '#2440F0' : '#17171B',
    fontWeight: active ? ('600' as const) : ('400' as const),
  });

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(23,23,27,0.35)' }}>
        <View
          style={{
            backgroundColor: '#FFFFFF',
            borderTopLeftRadius: 16,
            borderTopRightRadius: 16,
            maxHeight: '70%',
            paddingHorizontal: 16,
            paddingTop: 16,
            paddingBottom: 32,
          }}
        >
          <View
            style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: 8,
            }}
          >
            <Text style={{ fontSize: 18, fontWeight: '700', color: '#17171B' }}>Categories</Text>
            <Pressable onPress={onClose} hitSlop={8}>
              <Text style={{ color: '#2440F0', fontSize: 16 }}>Done</Text>
            </Pressable>
          </View>
          <ScrollView>
            <Pressable style={row} onPress={() => choose(undefined)}>
              <Text style={label(selected === undefined)}>All products</Text>
            </Pressable>
            {categories.map((c) => (
              <Pressable key={c.id} style={row} onPress={() => choose(c.slug)}>
                <Text style={label(selected === c.slug)}>{c.name}</Text>
              </Pressable>
            ))}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

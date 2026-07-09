import { Text, TextInput, View, type TextInputProps } from 'react-native';

export function Field({
  label,
  error,
  ...props
}: TextInputProps & { label: string; error?: string }) {
  return (
    <View style={{ marginBottom: 12 }}>
      <Text style={{ color: '#70707A', fontSize: 13, marginBottom: 4 }}>{label}</Text>
      <TextInput
        accessibilityLabel={label}
        style={{
          borderWidth: 1,
          borderColor: '#DAD8D1',
          borderRadius: 4,
          paddingHorizontal: 12,
          paddingVertical: 10,
          color: '#17171B',
        }}
        placeholderTextColor="#B0B0B8"
        {...props}
      />
      {error ? <Text style={{ color: '#2440F0', fontSize: 12, marginTop: 4 }}>{error}</Text> : null}
    </View>
  );
}

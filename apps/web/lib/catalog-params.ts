import { productListQuery, type ProductListQuery } from '@repo/types';

type RawParams = Record<string, string | string[] | undefined>;

// Validate incoming searchParams against the shared contract; on any invalid
// field, fall back to the schema defaults rather than 500ing a public page.
export function parseCatalogParams(sp: RawParams): ProductListQuery {
  const flat: Record<string, string> = {};
  for (const [k, v] of Object.entries(sp)) {
    if (typeof v === 'string') flat[k] = v;
    else if (Array.isArray(v) && typeof v[0] === 'string') flat[k] = v[0];
  }
  const parsed = productListQuery.safeParse(flat);
  return parsed.success ? parsed.data : productListQuery.parse({});
}

export function catalogHref(params: Partial<ProductListQuery>): string {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== '') qs.set(k, String(v));
  }
  const s = qs.toString();
  return s ? `/products?${s}` : '/products';
}

import { productListQuery, type ProductListQuery } from '@repo/types';

type RawParams = Record<string, string | string[] | undefined>;

// Validate incoming params against the shared contract; on any invalid field,
// fall back to the schema defaults rather than crashing the screen.
export function parseCatalogParams(sp: RawParams): ProductListQuery {
  const flat: Record<string, string> = {};
  for (const [k, v] of Object.entries(sp)) {
    if (typeof v === 'string') flat[k] = v;
    else if (Array.isArray(v) && typeof v[0] === 'string') flat[k] = v[0];
  }
  const parsed = productListQuery.safeParse(flat);
  return parsed.success ? parsed.data : productListQuery.parse({});
}

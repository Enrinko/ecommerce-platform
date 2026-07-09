import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { ApiError, getProduct, listReviews } from '@repo/api-client';
import { Price, Rating } from '@repo/ui';
import { ReviewList } from '@/app/_components/review-list';
import { AddToCart } from '@/app/_components/add-to-cart';

export const dynamic = 'force-dynamic';

async function load(slug: string) {
  try {
    const product = await getProduct(slug);
    // Reviews are keyed by product id (uuid), not slug.
    const reviews = await listReviews(product.id).catch(() => null);
    return { product, reviews };
  } catch (e) {
    if (e instanceof ApiError && e.status === 404) return null;
    throw e;
  }
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const data = await load(slug);
  if (!data) return { title: 'Not found' };
  return { title: data.product.title, description: data.product.description };
}

export default async function ProductPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const data = await load(slug);
  if (!data) notFound();
  const { product, reviews } = data;

  return (
    <main className="mx-auto max-w-4xl px-4 py-8">
      <div className="grid gap-8 md:grid-cols-2">
        <div className="aspect-square border border-hairline bg-surface">
          {product.images[0] ? (
            <img
              src={product.images[0]}
              alt={product.title}
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="flex h-full items-center justify-center font-mono text-xs uppercase tracking-widest text-graphite">
              no image
            </div>
          )}
        </div>
        <div>
          {product.category && (
            <p className="font-mono text-xs uppercase tracking-widest text-graphite">
              {product.category.name}
            </p>
          )}
          <h1 className="mt-1 font-display text-3xl font-semibold text-ink">{product.title}</h1>
          <div className="mt-2">
            <Rating avg={product.rating.avg} count={product.rating.count} />
          </div>
          <Price cents={product.priceCents} currency={product.currency} className="mt-4 block text-xl" />
          <p className="mt-4 text-graphite">{product.description}</p>
          <div className="mt-6">
            <AddToCart product={product} />
          </div>
        </div>
      </div>

      <section className="mt-12">
        <h2 className="font-display text-xl font-semibold text-ink">Reviews</h2>
        <div className="mt-4">
          <ReviewList reviews={reviews?.items ?? []} />
        </div>
      </section>
    </main>
  );
}

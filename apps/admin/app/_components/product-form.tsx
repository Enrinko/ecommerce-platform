'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  createProductInput,
  currency as currencyEnum,
  type Category,
  type CreateProductInput,
} from '@repo/types';
import { Button } from '@repo/ui';

const field = 'mt-1 w-full rounded-sm border border-hairline bg-surface px-3 py-2 text-ink';
const labelText = 'block text-sm text-graphite';

export function ProductForm({
  categories,
  defaultValues,
  submitting,
  submitLabel = 'Save product',
  error,
  onSubmit,
}: {
  categories: Category[];
  defaultValues?: Partial<CreateProductInput>;
  submitting?: boolean;
  submitLabel?: string;
  error?: string | null;
  onSubmit: (values: CreateProductInput) => void;
}) {
  const [imagesText, setImagesText] = useState((defaultValues?.images ?? []).join('\n'));
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<CreateProductInput>({
    resolver: zodResolver(createProductInput),
    defaultValues: {
      currency: 'USD',
      stock: 0,
      images: [],
      isActive: true,
      ...defaultValues,
    },
  });

  const submit = handleSubmit((values) =>
    onSubmit({
      ...values,
      images: imagesText
        .split('\n')
        .map((s) => s.trim())
        .filter(Boolean),
    }),
  );

  return (
    <form onSubmit={submit} className="mt-6 max-w-2xl space-y-4">
      <label className={labelText}>
        Title
        <input {...register('title')} className={field} />
        {errors.title && <span className="text-sm text-accent">{errors.title.message}</span>}
      </label>
      <label className={labelText}>
        Slug
        <input {...register('slug')} className={field} />
        {errors.slug && <span className="text-sm text-accent">{errors.slug.message}</span>}
      </label>
      <label className={labelText}>
        Description
        <textarea rows={3} {...register('description')} className={field} />
        {errors.description && (
          <span className="text-sm text-accent">{errors.description.message}</span>
        )}
      </label>
      <div className="grid grid-cols-3 gap-4">
        <label className={labelText}>
          Price, cents
          <input
            type="number"
            {...register('priceCents', { valueAsNumber: true })}
            className={field}
          />
          {errors.priceCents && (
            <span className="text-sm text-accent">{errors.priceCents.message}</span>
          )}
        </label>
        <label className={labelText}>
          Currency
          <select {...register('currency')} className={field}>
            {currencyEnum.options.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </label>
        <label className={labelText}>
          Stock
          <input type="number" {...register('stock', { valueAsNumber: true })} className={field} />
          {errors.stock && <span className="text-sm text-accent">{errors.stock.message}</span>}
        </label>
      </div>
      <label className={labelText}>
        Category
        <select
          {...register('categoryId')}
          className={field}
          defaultValue={defaultValues?.categoryId ?? ''}
        >
          <option value="" disabled>
            Select a category…
          </option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        {errors.categoryId && <span className="text-sm text-accent">A category is required.</span>}
      </label>
      <label className={labelText}>
        Image URLs (one per line)
        <textarea
          rows={3}
          value={imagesText}
          onChange={(e) => setImagesText(e.target.value)}
          className={`${field} font-mono text-xs`}
        />
      </label>
      <label className="flex items-center gap-2 text-sm text-graphite">
        <input type="checkbox" {...register('isActive')} />
        Active (visible on the storefront)
      </label>
      {error && <p className="text-sm text-accent">{error}</p>}
      <Button type="submit" disabled={submitting}>
        {submitLabel}
      </Button>
    </form>
  );
}

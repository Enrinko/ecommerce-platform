'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  createCategoryInput,
  type Category,
  type CreateCategoryInput,
  type UpdateCategoryInput,
} from '@repo/types';
import { Button } from '@repo/ui';

const field = 'w-full rounded-sm border border-hairline bg-surface px-3 py-2 text-ink';
const action = 'text-graphite hover:text-accent';

export function CategoriesManager({
  categories,
  onCreate,
  onUpdate,
  onDelete,
  creating,
  error,
}: {
  categories: Category[];
  onCreate: (input: CreateCategoryInput) => void;
  onUpdate: (id: string, input: UpdateCategoryInput) => void;
  onDelete: (id: string) => void;
  creating?: boolean;
  error?: string | null;
}) {
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<CreateCategoryInput>({ resolver: zodResolver(createCategoryInput) });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');

  const submit = handleSubmit((values) => {
    onCreate(values);
    reset({ name: '', slug: '' });
  });

  return (
    <div className="mt-6 max-w-2xl space-y-6">
      {error && <p className="text-sm text-accent">{error}</p>}

      <form onSubmit={submit} className="grid grid-cols-[1fr_1fr_auto] items-end gap-3">
        <label className="block text-sm text-graphite">
          Name
          <input {...register('name')} className={field} />
          {errors.name && <span className="text-xs text-accent">{errors.name.message}</span>}
        </label>
        <label className="block text-sm text-graphite">
          Slug
          <input {...register('slug')} className={field} />
          {errors.slug && <span className="text-xs text-accent">{errors.slug.message}</span>}
        </label>
        <Button type="submit" disabled={creating}>
          Add category
        </Button>
      </form>

      <ul className="divide-y divide-hairline border-y border-hairline">
        {categories.map((c) => (
          <li key={c.id} className="flex items-center justify-between gap-4 py-2 text-sm">
            {editingId === c.id ? (
              <>
                <input
                  aria-label={`Rename ${c.name}`}
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className={field}
                />
                <div className="space-x-3 whitespace-nowrap">
                  <button
                    className={action}
                    onClick={() => {
                      onUpdate(c.id, { name: editName });
                      setEditingId(null);
                    }}
                  >
                    Save
                  </button>
                  <button className={action} onClick={() => setEditingId(null)}>
                    Cancel
                  </button>
                </div>
              </>
            ) : (
              <>
                <span>
                  {c.name} <span className="font-mono text-xs text-graphite">/{c.slug}</span>
                </span>
                <div className="space-x-3 whitespace-nowrap">
                  <button
                    className={action}
                    onClick={() => {
                      setEditingId(c.id);
                      setEditName(c.name);
                    }}
                  >
                    Edit
                  </button>
                  <button className={action} onClick={() => onDelete(c.id)}>
                    Delete
                  </button>
                </div>
              </>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

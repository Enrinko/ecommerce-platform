import { PrismaClient } from '@prisma/client';
import * as argon2 from 'argon2';

const prisma = new PrismaClient();

const categories = [
  { name: 'Audio', slug: 'audio' },
  { name: 'Wearables', slug: 'wearables' },
  { name: 'Accessories', slug: 'accessories' },
];

async function main(): Promise<void> {
  const bySlug: Record<string, string> = {};
  for (const c of categories) {
    const row = await prisma.category.upsert({
      where: { slug: c.slug },
      update: { name: c.name },
      create: c,
    });
    bySlug[c.slug] = row.id;
  }

  const products = [
    { title: 'Wireless Headphones', slug: 'wireless-headphones', priceCents: 12900, stock: 25, cat: 'audio' },
    { title: 'Studio Earbuds', slug: 'studio-earbuds', priceCents: 8900, stock: 40, cat: 'audio' },
    { title: 'Portable Speaker', slug: 'portable-speaker', priceCents: 5900, stock: 30, cat: 'audio' },
    { title: 'Smart Watch', slug: 'smart-watch', priceCents: 19900, stock: 15, cat: 'wearables' },
    { title: 'Fitness Band', slug: 'fitness-band', priceCents: 4900, stock: 50, cat: 'wearables' },
    { title: 'VR Headset', slug: 'vr-headset', priceCents: 29900, stock: 8, cat: 'wearables' },
    { title: 'USB-C Cable', slug: 'usb-c-cable', priceCents: 1200, stock: 200, cat: 'accessories' },
    { title: 'Laptop Sleeve', slug: 'laptop-sleeve', priceCents: 3400, stock: 60, cat: 'accessories' },
    { title: 'Wireless Charger', slug: 'wireless-charger', priceCents: 2600, stock: 45, cat: 'accessories' },
    { title: 'Phone Stand', slug: 'phone-stand', priceCents: 1500, stock: 80, cat: 'accessories' },
    { title: 'Noise-Cancelling Headset', slug: 'nc-headset', priceCents: 17900, stock: 12, cat: 'audio' },
    { title: 'Travel Adapter', slug: 'travel-adapter', priceCents: 2200, stock: 90, cat: 'accessories' },
  ];

  for (const p of products) {
    const { cat, ...rest } = p;
    await prisma.product.upsert({
      where: { slug: p.slug },
      update: { priceCents: p.priceCents, stock: p.stock },
      create: {
        ...rest,
        description: `${p.title} — demo catalog item.`,
        images: [],
        categoryId: bySlug[cat],
      },
    });
  }

  const adminEmail = process.env.ADMIN_EMAIL;
  const adminPassword = process.env.ADMIN_PASSWORD;
  if (adminEmail && adminPassword) {
    await prisma.user.upsert({
      where: { email: adminEmail },
      update: { role: 'ADMIN' },
      create: { email: adminEmail, passwordHash: await argon2.hash(adminPassword), role: 'ADMIN' },
    });
    console.log(`Seeded admin: ${adminEmail}`);
  } else {
    console.log('Admin seed skipped (ADMIN_EMAIL/ADMIN_PASSWORD not set)');
  }

  const [c, pc] = [await prisma.category.count(), await prisma.product.count()];
  console.log(`Seeded: ${c} categories, ${pc} products`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

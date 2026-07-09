/** @type {import('next').NextConfig} */
const nextConfig = {
  // Workspace packages are shipped as source; Next must transpile them.
  transpilePackages: ['@repo/ui', '@repo/api-client', '@repo/types'],
  // Lint is a separate Turbo task (`pnpm lint`); don't run it during build.
  eslint: { ignoreDuringBuilds: true },
};

export default nextConfig;

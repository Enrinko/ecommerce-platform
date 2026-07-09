/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ['@repo/ui', '@repo/api-client', '@repo/types'],
  eslint: { ignoreDuringBuilds: true },
};

export default nextConfig;

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: 'standalone',
  images: {
    unoptimized: true
  },
  experimental: {
    // Ensure compatibility with Edge runtime where possible
    // We'll keep default; API route will specify runtime
  }
};

module.exports = nextConfig;



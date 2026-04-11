/** @type {import('next').NextConfig} */
const nextConfig = {
  // Three.js / R3F transpile
  transpilePackages: ['three'],
  images: {
    remotePatterns: [],
  },
  experimental: {
    // App Router is stable in Next 14, no extra flag needed
  },
};

module.exports = nextConfig;

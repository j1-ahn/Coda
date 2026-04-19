/** @type {import('next').NextConfig} */

// Backend origin — driven by .env.local (see frontend/.env.example).
// Falls back to localhost:8000 to preserve current defaults.
const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000';

const nextConfig = {
  // Three.js / R3F transpile
  transpilePackages: ['three'],
  images: {
    remotePatterns: [],
  },
  experimental: {
    // App Router is stable in Next 14, no extra flag needed
  },
  // 대용량 오디오 파일 업로드를 위해 body size limit 해제
  api: {
    bodyParser: {
      sizeLimit: '500mb',
    },
    responseLimit: false,
  },
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: `${BACKEND_URL}/api/:path*`,
      },
    ];
  },
};

module.exports = nextConfig;

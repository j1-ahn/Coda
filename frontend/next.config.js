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
        destination: 'http://localhost:8000/api/:path*',
      },
    ];
  },
};

module.exports = nextConfig;

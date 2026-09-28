/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    domains: [
      'lh3.googleusercontent.com',
      'avatars.githubusercontent.com',
      'images.unsplash.com',
    ],
  },
  async rewrites() {
    const backendUrl = process.env.BACKEND_INTERNAL_URL || process.env.NEXT_PUBLIC_API_URL;
    if (backendUrl && backendUrl !== 'http://localhost:8000') {
      return [
        {
          source: '/api/tickets/:path*',
          destination: `${backendUrl}/api/tickets/:path*`,
        },
        {
          source: '/api/admin/:path*',
          destination: `${backendUrl}/api/admin/:path*`,
        },
        {
          source: '/api/reviewer/:path*',
          destination: `${backendUrl}/api/reviewer/:path*`,
        },
        {
          source: '/api/categories/:path*',
          destination: `${backendUrl}/api/categories/:path*`,
        },
        {
          source: '/api/departments/:path*',
          destination: `${backendUrl}/api/departments/:path*`,
        },
        {
          source: '/api/policies/:path*',
          destination: `${backendUrl}/api/policies/:path*`,
        },
      ];
    }
    return [];
  },
};

module.exports = nextConfig;

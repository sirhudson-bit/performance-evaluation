/** @type {import('next').NextConfig} */
const API_URL = process.env.API_URL || 'http://127.0.0.1:4000';

const nextConfig = {
  reactStrictMode: true,
  // Transpile the workspace TypeScript packages that ship source.
  transpilePackages: ['@pe/shared', '@pe/validation', '@pe/ui'],
  experimental: {
    // Tree-shake large icon/chart barrels for faster dev compile and smaller bundles.
    optimizePackageImports: ['lucide-react', 'recharts'],
  },
  eslint: {
    // Lint is run explicitly at the repo root; keep `next build` focused.
    ignoreDuringBuilds: true,
  },
  // The workspace TS packages use explicit `.js` specifiers in relative imports
  // (correct ESM). Map them back to the `.ts` sources for webpack.
  webpack(config) {
    config.resolve = config.resolve || {};
    config.resolve.extensionAlias = {
      '.js': ['.ts', '.tsx', '.js'],
      '.mjs': ['.mts', '.mjs'],
    };
    return config;
  },
  // The browser talks only to the Next.js origin for API calls; the versioned
  // API is proxied to the standalone Express service. This keeps the session
  // cookie same-site (SameSite=Lax) in development and mirrors the reverse-proxy
  // layout used in production.
  async rewrites() {
    return [{ source: '/api/v1/:path*', destination: `${API_URL}/api/v1/:path*` }];
  },
};

export default nextConfig;

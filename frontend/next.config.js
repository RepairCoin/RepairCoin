/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  compress: true,
  output: 'standalone',

  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  transpilePackages: ['thirdweb', '@scure/bip39'],
  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        net: false,
        tls: false,
        crypto: false,
      };
    }

    // Handle @scure/bip39 wordlist files
    config.module.rules.push({
      test: /\.js$/,
      include: /node_modules\/@scure\/bip39/,
      type: 'javascript/auto',
    });

    return config;
  },
  compiler: {
    removeConsole: process.env.NODE_ENV === 'production' ? {
      exclude: ['error', 'warn'],
    } : false,
  },
  images: {
    formats: ['image/webp', 'image/avif'],
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**',
      },
    ],
  },
  // Ignore warnings from @scure/bip39
  onDemandEntries: {
    maxInactiveAge: 25 * 1000,
    pagesBufferLength: 2,
  },

  // Performance: cache visited pages so back/forward nav is instant
  experimental: {
    staleTimes: {
      dynamic: 30,   // Cache dynamic pages for 30 seconds
      static: 180,   // Cache static pages for 3 minutes
    },
    optimizePackageImports: ['lucide-react', 'recharts', '@radix-ui/react-icons', 'framer-motion'],
  },
};

module.exports = nextConfig;

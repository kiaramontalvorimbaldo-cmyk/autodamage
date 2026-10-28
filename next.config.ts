import type { NextConfig } from 'next';
import path from 'node:path';
import { securityHeaders } from './src/lib/security-headers';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  distDir: process.env.AUTODAMAGE_BUILD_DIR ?? '.next',
  outputFileTracingRoot: path.resolve(__dirname),
  ...(process.env.AUTODAMAGE_SERIAL_BUILD === '1'
    ? { experimental: { webpackBuildWorker: false, cpus: 1 } }
    : {}),
  async headers() {
    return [
      { source: '/(.*)', headers: securityHeaders },
      {
        source: '/sw.js',
        headers: [{ key: 'Cache-Control', value: 'no-cache, no-store, must-revalidate' }],
      },
    ];
  },
};

export default nextConfig;

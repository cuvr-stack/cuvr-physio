/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ['@physio-vr/shared-types'],
  // Required for WebXR — must be served over HTTPS in production
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
          { key: 'Cross-Origin-Embedder-Policy', value: 'require-corp' },
        ],
      },
    ];
  },
};

module.exports = nextConfig;

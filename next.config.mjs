/** @type {import('next').NextConfig} */
const nextConfig = {
  // The launchpad SDKs (and Anchor) are Node-only and ship CJS that the
  // bundler mangles; load them with plain require at runtime instead.
  serverExternalPackages: [
    '@pump-fun/pump-sdk',
    '@pump-fun/pump-swap-sdk',
    '@pump-fun/agent-payments-sdk',
    '@raydium-io/raydium-sdk-v2',
    '@meteora-ag/dynamic-bonding-curve-sdk',
    '@meteora-ag/cp-amm-sdk',
    '@coral-xyz/anchor',
    'postgres',
  ],
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'dd.dexscreener.com' },
      { protocol: 'https', hostname: 'cdn.dexscreener.com' },
      { protocol: 'https', hostname: '**.ipfs.io' },
      { protocol: 'https', hostname: 'ipfs.io' },
    ],
  },
};
export default nextConfig;

/** @type {import('next').NextConfig} */
// NEXT_OUTPUT=export produces a fully static site for Cloudflare Pages.
// Default ("standalone") keeps server-side features for Node hosts.
const isExport = process.env.NEXT_OUTPUT === 'export';

const nextConfig = {
  output: isExport ? 'export' : 'standalone',

  images: {
    unoptimized: true,
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**',
      },
    ],
  },

  // Type + lint errors fail the build. CI runs the same gates (tsc/lint) so
  // regressions never ship green. Flipped 2026-06-01 after clearing the
  // pre-existing AppShell prop-passthrough + test type errors.
  eslint: {
    ignoreDuringBuilds: false,
  },

  typescript: {
    ignoreBuildErrors: false,
  },

  experimental: {
    // Barrel-optimize the big icon/animation packages so only the icons/exports
    // actually imported are bundled (lucide-react and simple-icons each ship
    // thousands of named exports).
    optimizePackageImports: ["lucide-react", "simple-icons", "framer-motion"],
  },
};

export default nextConfig;

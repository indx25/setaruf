import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  /* config options here */
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
  experimental: {
    optimizePackageImports: [
      "lucide-react",
      "date-fns",
      "sonner"
    ],
  },
  modularizeImports: {
    "lucide-react": {
      transform: "lucide-react/icons/{{kebabCase member}}",
      skipDefaultConversion: true
    }
  },
  env: {
    NEXTAUTH_URL:
      process.env.NODE_ENV === "production"
        ? "https://setaruf.vercel.app"
        : "http://localhost:3000",
  },
};

export default nextConfig;

import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  /* config options here */
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
  env: {
    NEXTAUTH_URL:
      process.env.NODE_ENV === "production"
        ? "https://setaruf.vercel.app"
        : "http://localhost:3000",
  },
};

export default nextConfig;

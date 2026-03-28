import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "http",
        hostname: "tech.intellozene.com",
        pathname: "/**",
      },
      {
        protocol: "http",
        hostname: "www.tech.intellozene.com",
        pathname: "/**",
      },
      {
        protocol: "http",
        hostname: "www.ecraftindia.intellozene.com",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "tech.intellozene.com",
        pathname: "/**",
      },
    ],
  },
};

export default nextConfig;

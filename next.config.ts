import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "cdn.shopify.com",
        port: "",
        pathname: "/s/files/**",
      },
      {
        protocol: "https",
        hostname: "allgoodpetfood.co.nz",
        port: "",
        pathname: "/cdn/shop/**",
      },
    ],
  },
};

export default nextConfig;

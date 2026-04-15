import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Allow images from IPFS Pinata gateway
  images: {
    domains: ["gateway.pinata.cloud", "ipfs.io"],
  },
};

export default nextConfig;

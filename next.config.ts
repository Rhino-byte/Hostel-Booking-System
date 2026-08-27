import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Keep firebase-admin out of the Next bundler so jwks-rsa/jose load correctly on Vercel
  serverExternalPackages: ["firebase-admin", "prisma", "@prisma/client"],
};

export default nextConfig;

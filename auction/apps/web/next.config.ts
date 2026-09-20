import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Native/ws-using packages the API route pulls in; let Node require them at runtime.
  serverExternalPackages: ["@neondatabase/serverless", "pdf-lib"],
};
export default nextConfig;

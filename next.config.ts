import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: 'standalone',
  serverExternalPackages: ['knex', 'sqlite3', 'pg'],
  allowedDevOrigins: ['192.168.1.6', '192.168.1.10', '10.50.5.5']
};

export default nextConfig;

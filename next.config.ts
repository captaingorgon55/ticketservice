import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  // Render health check — don't let middleware block it
  serverExternalPackages: ["mongoose", "bcryptjs", "nodemailer"],
};

export default nextConfig;

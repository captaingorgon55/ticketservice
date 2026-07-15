import { NextResponse } from "next/server";

/**
 * GET /api/health — Health check endpoint for Render
 * Render pings this endpoint periodically to verify the service is alive.
 */
export async function GET() {
  return NextResponse.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
}

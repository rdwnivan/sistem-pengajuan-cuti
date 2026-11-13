import { NextResponse } from "next/server";

// Retired public paths must never bypass domain authorization, including old files.
export function middleware() {
  return new NextResponse(null, { status: 404, headers: { "Cache-Control": "no-store" } });
}
export const config = { matcher: ["/uploads/:path*"] };

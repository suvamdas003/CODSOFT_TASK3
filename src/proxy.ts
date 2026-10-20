import { NextResponse, type NextRequest } from "next/server";

const SESSION_COOKIE = "ch_session";

/**
 * Optimistic redirect for signed-out visitors on protected pages. This only
 * checks that a session cookie is present; real authentication and role
 * checks run on the server in every page, server action and route handler.
 */
export function proxy(request: NextRequest) {
  if (!request.cookies.get(SESSION_COOKIE)?.value && request.method === "GET") {
    const url = new URL("/login", request.url);
    url.searchParams.set("next", `${request.nextUrl.pathname}${request.nextUrl.search}`);
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/candidate/:path*", "/recruiter/:path*", "/admin/:path*", "/notifications", "/account"],
};

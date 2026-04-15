import { NextRequest, NextResponse } from "next/server";

/**
 * Route protection middleware.
 *
 * We cannot call Firebase from Edge middleware (no Node APIs), so we use
 * a lightweight approach: the role is stored in a cookie (`grievance_role`)
 * that the frontend sets after a successful verify-token call.
 *
 * The cookie is NOT trusted for security — the backend always validates the
 * Firebase ID token on every API request. The cookie is only used here to
 * redirect users to the correct dashboard and prevent flash-of-wrong-page.
 */

const ROLE_ROUTES: Record<string, string> = {
  student:   "/student/dashboard",
  committee: "/committee/dashboard",
  hod:       "/hod/dashboard",
  principal: "/principal/dashboard",
  admin:     "/admin/dashboard",
};

const PROTECTED_PREFIXES = [
  "/student",
  "/committee",
  "/hod",
  "/principal",
  "/admin",
];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const role = request.cookies.get("grievance_role")?.value ?? "";

  const isProtected = PROTECTED_PREFIXES.some((p) => pathname.startsWith(p));

  // Unauthenticated user hitting a protected route → redirect to login
  if (isProtected && !role) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  // Authenticated user hitting / or /login → redirect to their dashboard
  if (role && (pathname === "/" || pathname === "/login")) {
    const dest = ROLE_ROUTES[role] ?? "/student/dashboard";
    return NextResponse.redirect(new URL(dest, request.url));
  }

  // Wrong role accessing another role's area → redirect to own dashboard
  if (role && isProtected) {
    const ownPrefix = `/${role}`;
    if (!pathname.startsWith(ownPrefix) && role !== "admin") {
      return NextResponse.redirect(new URL(ROLE_ROUTES[role], request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/",
    "/login",
    "/student/:path*",
    "/committee/:path*",
    "/hod/:path*",
    "/principal/:path*",
    "/admin/:path*",
  ],
};

import { NextResponse } from 'next/server'

// Route access matrix by role
const ROLE_PERMISSIONS = {
  CUSTOMER: ['/customer'],
  AGENT:    ['/agent'],
  REVIEWER: ['/reviewer'],
  MANAGER:  ['/reviewer'],
  ADMIN:    ['/admin', '/agent', '/reviewer', '/customer'],
}

const DASHBOARD_REDIRECTS = {
  CUSTOMER: '/customer/dashboard',
  AGENT:    '/agent/workspace',
  REVIEWER: '/reviewer/queue',
  MANAGER:  '/reviewer/queue',
  ADMIN:    '/admin/dashboard',
}

export function middleware(request) {
  const { pathname } = request.nextUrl

  // 1. Allow public auth pages, login page, static assets, Next.js internal requests
  if (
    pathname.startsWith('/login') ||
    pathname.startsWith('/auth') ||
    pathname.startsWith('/api') ||
    pathname.startsWith('/_next') ||
    pathname.startsWith('/favicon.ico') ||
    pathname === '/'
  ) {
    return NextResponse.next()
  }

  // Retrieve user session cookies
  const roleCookie = request.cookies.get('user_role')?.value
  const userStatus = request.cookies.get('user_status')?.value

  // 2. STRICT AUTH CHECK: If user is not logged in (no role cookie), force redirect to /login
  if (!roleCookie) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  // 3. ACCOUNT STATUS CHECK: If user account is INACTIVE, destroy session and force redirect to /login
  if (userStatus === 'INACTIVE') {
    const response = NextResponse.redirect(new URL('/login?error=account_deactivated', request.url))
    response.cookies.delete('user_role')
    response.cookies.delete('user_status')
    return response
  }

  // 4. TEMPORARY PASSWORD CHECK: Force change password before dashboard access
  if (userStatus === 'MUST_CHANGE_PASSWORD' && !pathname.startsWith('/auth/change-password')) {
    return NextResponse.redirect(new URL('/auth/change-password', request.url))
  }

  // 5. ROLE AUTHORIZATION GUARD: Verify if user role has permission to access target path
  const userRole = roleCookie.toUpperCase()
  const allowedPrefixes = ROLE_PERMISSIONS[userRole] || []
  const hasPermission = allowedPrefixes.some(prefix => pathname.startsWith(prefix))

  if (!hasPermission) {
    // Redirect unauthorized attempt to user's assigned role dashboard
    const fallbackDashboard = DASHBOARD_REDIRECTS[userRole] || '/login'
    return NextResponse.redirect(new URL(fallbackDashboard, request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/customer/:path*', '/agent/:path*', '/reviewer/:path*', '/admin/:path*'],
}

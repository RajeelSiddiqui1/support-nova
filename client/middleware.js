import { NextResponse } from 'next/server'

// Role-based route authorization matrix
const ROLE_PERMISSIONS = {
  CUSTOMER: ['/customer'],
  AGENT:    ['/agent'],
  REVIEWER: ['/reviewer', '/agent'],
  MANAGER:  ['/reviewer', '/agent'],
  ADMIN:    ['/admin', '/agent', '/reviewer', '/customer'],
}

// Default role dashboard fallbacks
const DASHBOARD_REDIRECTS = {
  CUSTOMER: '/customer/dashboard',
  AGENT:    '/agent/workspace',
  REVIEWER: '/reviewer/queue',
  MANAGER:  '/reviewer/queue',
  ADMIN:    '/admin/dashboard',
}

export function middleware(request) {
  const { pathname, searchParams } = request.nextUrl

  // 1. Always allow API routes, Next.js internal assets, static files, and password reset auth pages
  if (
    pathname.startsWith('/api') ||
    pathname.startsWith('/_next') ||
    pathname.startsWith('/favicon.ico') ||
    pathname.startsWith('/auth/forgot-password')
  ) {
    return NextResponse.next()
  }

  // Retrieve user session cookies
  const roleCookie = request.cookies.get('user_role')?.value
  const userStatus = request.cookies.get('user_status')?.value
  const isLogout = searchParams.get('logout') === 'true'

  // 2. LOGOUT HANDLING: Clear all session cookies if logout parameter is passed
  if (isLogout) {
    const response = NextResponse.redirect(new URL('/login', request.url))
    response.cookies.delete('user_role')
    response.cookies.delete('user_status')
    response.cookies.delete('user_id')
    response.cookies.delete('user_email')
    response.cookies.delete('user_name')
    return response
  }

  // 3. ACCOUNT STATUS CHECK: If user is deactivated, force logout and redirect to login
  if (roleCookie && userStatus === 'INACTIVE') {
    const response = NextResponse.redirect(new URL('/login?error=account_deactivated', request.url))
    response.cookies.delete('user_role')
    response.cookies.delete('user_status')
    response.cookies.delete('user_id')
    response.cookies.delete('user_email')
    response.cookies.delete('user_name')
    return response
  }

  // 4. ALREADY LOGGED IN: If user visits /login or / with active valid session, redirect to their role dashboard
  const userRole = roleCookie ? roleCookie.toUpperCase() : null
  if (userRole && (pathname === '/login' || pathname === '/')) {
    if (userStatus === 'MUST_CHANGE_PASSWORD') {
      return NextResponse.redirect(new URL('/auth/change-password', request.url))
    }
    const targetDashboard = DASHBOARD_REDIRECTS[userRole] || '/customer/dashboard'
    return NextResponse.redirect(new URL(targetDashboard, request.url))
  }

  // 5. PUBLIC ROOT & LOGIN ACCESS: Allow unauthenticated visitors to view / or /login
  if (pathname === '/login' || pathname === '/') {
    return NextResponse.next()
  }

  // 6. AUTHENTICATION GUARD: Unauthenticated users trying to access protected dashboards
  if (!userRole) {
    const loginUrl = new URL('/login', request.url)
    loginUrl.searchParams.set('redirect', pathname)
    return NextResponse.redirect(loginUrl)
  }

  // 7. MUST CHANGE PASSWORD GUARD: Force temporary password users to change password first
  if (userStatus === 'MUST_CHANGE_PASSWORD' && !pathname.startsWith('/auth/change-password')) {
    return NextResponse.redirect(new URL('/auth/change-password', request.url))
  }

  // Allow change-password page for users requiring password reset
  if (pathname.startsWith('/auth/change-password')) {
    return NextResponse.next()
  }

  // 8. ROLE AUTHORIZATION GUARD: Enforce role-based route permissions
  const allowedPrefixes = ROLE_PERMISSIONS[userRole] || []
  const hasPermission = allowedPrefixes.some(prefix => pathname.startsWith(prefix))

  if (!hasPermission) {
    const fallbackDashboard = DASHBOARD_REDIRECTS[userRole] || '/login'
    return NextResponse.redirect(new URL(fallbackDashboard, request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/', '/login', '/customer/:path*', '/agent/:path*', '/reviewer/:path*', '/admin/:path*', '/auth/:path*'],
}

import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Pages that need SharedArrayBuffer (for MP3 conversion)
  const needsSharedArrayBuffer = [
    '/premium/create',
    '/premium/edit',
    '/create',
    '/artist',
    '/album',
  ]

  // Check if this route needs the headers
  const needsHeaders = needsSharedArrayBuffer.some(route => pathname.startsWith(route))

  // Don't apply headers to login/dashboard/signup pages
  const excludePaths = ['/login', '/dashboard', '/signup', '/forgot-password']
  const shouldExclude = excludePaths.some(path => pathname === path || pathname.startsWith(path + '/'))

  if (needsHeaders && !shouldExclude) {
    const response = NextResponse.next()

    // Set headers for SharedArrayBuffer support
    response.headers.set('Cross-Origin-Opener-Policy', 'same-origin')
    response.headers.set('Cross-Origin-Embedder-Policy', 'require-corp')

    return response
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
  ],
}


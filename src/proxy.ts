import { NextResponse, type NextRequest } from 'next/server'

// 临时：网络问题无法连接 Supabase，完全跳过登录校验
// 恢复登录时，取消下面 updateSession 的注释即可
// import { updateSession } from '@/lib/supabase/proxy'

// 公开路由白名单：无需登录即可访问（分流入口）
const PUBLIC_PREFIXES = ['/r/', '/t/']

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl

  // 分流入口直接放行，不做登录校验
  if (PUBLIC_PREFIXES.some((prefix) => pathname.startsWith(prefix))) {
    return NextResponse.next()
  }

  // return updateSession(request)
  return NextResponse.next()
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}

import { NextResponse, type NextRequest } from 'next/server'

// 临时：网络问题无法连接 Supabase，完全跳过登录校验
// 恢复登录时，取消下面 updateSession 的注释即可
// import { updateSession } from '@/lib/supabase/middleware'

export async function middleware(_request: NextRequest) {
  // return updateSession(request)
  return NextResponse.next()
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}

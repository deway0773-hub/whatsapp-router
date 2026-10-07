import { NextResponse, type NextRequest } from 'next/server'

// 临时模拟数据：网络恢复后替换为真实数据库查询
// code -> 默认 WhatsApp 号码
const mockLinks: Record<string, string> = {
  demo1: '8613800138000',
  demo2: '8613900139000',
}

// 临时硬编码的智能分流规则：code -> (国家/地区 -> WhatsApp 号码)
// 网络恢复后替换为数据库中的分流规则表
const mockRoutingRules: Record<string, Record<string, string>> = {
  demo1: {
    cn: '8613800138000',
    us: '8613900139000',
  },
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ code: string }> },
) {
  const { code } = await params

  const defaultNumber = mockLinks[code]

  // code 不存在 -> 跳转回首页
  if (!defaultNumber) {
    return NextResponse.redirect(new URL('/', request.url))
  }

  // 获取用户所在国家/地区
  // 1) 优先读取 Vercel 注入的请求头（线上环境）
  // 2) 本地测试时用 query 参数模拟，例如 /r/demo1?country=us
  const country =
    request.headers.get('x-vercel-ip-country')?.toLowerCase() ??
    request.nextUrl.searchParams.get('country')?.toLowerCase() ??
    ''

  // 命中分流规则则使用对应号码，否则回退到默认号码
  const targetNumber = mockRoutingRules[code]?.[country] ?? defaultNumber

  // 302 临时重定向到 WhatsApp 会话
  return NextResponse.redirect(`https://wa.me/${targetNumber}`, 302)
}

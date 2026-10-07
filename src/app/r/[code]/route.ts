import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// 从请求头 / query 参数中解析访客所在国家/地区（大写，例如 CN、US）
function resolveCountry(request: NextRequest): string {
  const headerCountry = request.headers.get('x-vercel-ip-country')
  const queryCountry = request.nextUrl.searchParams.get('country')
  const raw = headerCountry ?? queryCountry ?? ''
  return raw.trim().toUpperCase()
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ code: string }> },
) {
  const { code } = await params
  const supabase = await createClient()

  // 1) 查询总链接（按 code）
  const { data: link, error: linkError } = await supabase
    .from('links')
    .select('id, code, whatsapp_number')
    .eq('code', code)
    .maybeSingle()

  if (linkError) {
    console.log('查询总链接失败：', linkError)
  }

  // 总链接不存在 -> 跳转到提示页（避免死循环）
  if (!link) {
    return NextResponse.redirect(new URL('/not-found', request.url), 302)
  }

  const country = resolveCountry(request)

  // 2) 优先查询该总链接下匹配国家的分流规则
  let targetNumber: string | null = null

  if (country) {
    const { data: rule, error: ruleError } = await supabase
      .from('routing_rules')
      .select('whatsapp_number')
      .eq('link_id', link.id)
      .eq('country', country)
      .maybeSingle()

    if (ruleError) {
      console.log('查询分流规则失败：', ruleError)
    }

    if (rule?.whatsapp_number) {
      targetNumber = rule.whatsapp_number
    }
  }

  // 3) 未命中分流规则 -> 回退到总链接的默认号码（可能为空）
  if (!targetNumber && link.whatsapp_number) {
    targetNumber = link.whatsapp_number
  }

  // 4) 两者都没有号码 -> 跳转到提示页（避免死循环）
  if (!targetNumber) {
    return NextResponse.redirect(
      new URL(`/not-found?code=${encodeURIComponent(code)}`, request.url),
      302,
    )
  }

  // 302 临时重定向到 WhatsApp 会话
  return NextResponse.redirect(`https://wa.me/${targetNumber}`, 302)
}

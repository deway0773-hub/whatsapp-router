import { NextResponse, type NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

type TotalLinkItem = {
  id: string
  total_link_id: string
  short_link_id: string
  weight: number
}

// 按权重随机挑选一个子链接项
function pickWeighted(items: TotalLinkItem[]): TotalLinkItem | null {
  const list = items.filter((item) => item.weight > 0)
  if (!list.length) {
    return null
  }

  const total = list.reduce((sum, item) => sum + item.weight, 0)
  let r = Math.random() * total

  for (const item of list) {
    if (r < item.weight) {
      return item
    }
    r -= item.weight
  }

  return list[0]
}

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
  const supabase = createAdminClient()
  const country = resolveCountry(request)

  // 1) 查询总链接（按 code）
  const { data: total, error: totalError } = await supabase
    .from('total_links')
    .select('*')
    .eq('code', code)
    .maybeSingle()

  if (totalError) {
    console.log('查询总链接失败：', totalError)
  }

  if (!total) {
    return new NextResponse(`总链接 /t/${code} 不存在`, { status: 404 })
  }

  // 2) 查询该总链接下的子链接项
  const { data: items, error: itemsError } = await supabase
    .from('total_link_items')
    .select('*')
    .eq('total_link_id', total.id)

  if (itemsError) {
    console.log('查询子链接失败：', itemsError)
  }

  if (!items?.length) {
    return new NextResponse('总链接还没配置短链接', { status: 200 })
  }

  // 3) 按权重随机挑选一个短链接
  const picked = pickWeighted(items as TotalLinkItem[])
  if (!picked) {
    return new NextResponse('总链接还没配置有效权重的短链接', { status: 200 })
  }

  const shortId = picked.short_link_id

  // 4) 优先按国家匹配分流规则
  let waNumber: string | null = null

  if (country) {
    const { data } = await supabase
      .from('routing_rules')
      .select('whatsapp_number')
      .or(`link_id.eq.${shortId},short_link_id.eq.${shortId}`)
      .eq('country', country)
      .limit(1)

    if (data?.[0]) {
      waNumber = data[0].whatsapp_number
    }
  }

  // 5) 未命中 -> 回退到短链接自身的默认号码
  if (!waNumber) {
    const { data: link } = await supabase
      .from('links')
      .select('whatsapp_number')
      .eq('id', shortId)
      .maybeSingle()

    waNumber = link?.whatsapp_number || null
  }

  // 6) 仍没有 -> 取该短链接的第一条分流规则
  if (!waNumber) {
    const { data } = await supabase
      .from('routing_rules')
      .select('whatsapp_number')
      .or(`link_id.eq.${shortId},short_link_id.eq.${shortId}`)
      .limit(1)

    waNumber = data?.[0]?.whatsapp_number || null
  }

  if (!waNumber) {
    return new NextResponse('短链接没配号码', { status: 200 })
  }

  // 7) 记录点击日志（失败不影响跳转）
  try {
    await supabase
      .from('click_logs')
      .insert({ link_id: shortId, short_link_id: shortId, country })
  } catch (error) {
    console.log('写入点击日志失败：', error)
  }

  // 302 临时重定向到 WhatsApp 会话
  return NextResponse.redirect(
    `https://wa.me/${waNumber.replace(/[^0-9]/g, '')}`,
    { status: 302 },
  )
}

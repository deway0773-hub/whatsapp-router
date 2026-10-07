import { NextResponse, type NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

type TotalLinkItem = {
  id: string
  total_link_id: string
  short_link_id: string
  weight: number
  daily_limit: number | null
  total_limit: number | null
}

// 从 WhatsApp 链接中提取纯号码
function extractNumber(url: string): string {
  return url.replace(/[^0-9]/g, '')
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

// 解析某个子链接（短链接）对应的 WhatsApp 号码：
// 1) 按国家匹配分流规则 -> 2) 短链接自身默认号码 -> 3) 第一条分流规则
async function resolveWhatsappNumber(
  supabase: ReturnType<typeof createAdminClient>,
  shortId: string,
  country: string,
): Promise<string | null> {
  if (country) {
    const { data } = await supabase
      .from('routing_rules')
      .select('whatsapp_number')
      .or(`link_id.eq.${shortId},short_link_id.eq.${shortId}`)
      .eq('country', country)
      .limit(1)

    if (data?.[0]?.whatsapp_number) {
      return data[0].whatsapp_number
    }
  }

  const { data: link } = await supabase
    .from('links')
    .select('whatsapp_number')
    .eq('id', shortId)
    .maybeSingle()

  if (link?.whatsapp_number) {
    return link.whatsapp_number
  }

  const { data } = await supabase
    .from('routing_rules')
    .select('whatsapp_number')
    .or(`link_id.eq.${shortId},short_link_id.eq.${shortId}`)
    .limit(1)

  return data?.[0]?.whatsapp_number || null
}

// 统计某个短链接的点击次数（clicks 表）：
// - daily：当天（UTC）点击次数
// - total：累计点击次数
async function countClicks(
  supabase: ReturnType<typeof createAdminClient>,
  shortId: string,
  mode: 'daily' | 'total',
): Promise<number> {
  let query = supabase
    .from('clicks')
    .select('id', { count: 'exact', head: true })
    .eq('link_id', shortId)

  if (mode === 'daily') {
    const startOfDay = new Date()
    startOfDay.setUTCHours(0, 0, 0, 0)
    query = query.gte('created_at', startOfDay.toISOString())
  }

  const { count, error } = await query
  if (error) {
    console.log('统计点击次数失败：', error)
    return 0
  }
  return count ?? 0
}

// 判断某个子链接项是否已超限（daily_limit / total_limit 为 0 表示不限）
async function isOverLimit(
  supabase: ReturnType<typeof createAdminClient>,
  item: TotalLinkItem,
): Promise<boolean> {
  const dailyLimit = Number(item.daily_limit ?? 0)
  const totalLimit = Number(item.total_limit ?? 0)

  if (dailyLimit > 0) {
    const usedToday = await countClicks(supabase, item.short_link_id, 'daily')
    if (usedToday >= dailyLimit) {
      return true
    }
  }

  if (totalLimit > 0) {
    const usedTotal = await countClicks(supabase, item.short_link_id, 'total')
    if (usedTotal >= totalLimit) {
      return true
    }
  }

  return false
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

  const allItems = items as TotalLinkItem[]

  // 3) 遍历子链接项，跳过已超限的，找到第一个可用的
  //    先按权重随机排序，保证随机切换的公平性
  const shuffled = [...allItems]
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
  }

  let picked: TotalLinkItem | null = null
  for (const item of shuffled) {
    if (item.weight <= 0) continue
    const over = await isOverLimit(supabase, item)
    if (!over) {
      picked = item
      break
    }
  }

  // 若全部超限，回退到按权重随机挑选（保证仍有跳转）
  if (!picked) {
    picked = pickWeighted(allItems)
  }

  if (!picked) {
    return new NextResponse('总链接还没配置有效权重的短链接', { status: 200 })
  }

  const shortId = picked.short_link_id

  // 4) 解析该子链接对应的 WhatsApp 号码
  const waNumber = await resolveWhatsappNumber(supabase, shortId, country)

  if (!waNumber) {
    return new NextResponse('短链接没配号码', { status: 200 })
  }

  // 5) 记录点击日志（失败不影响跳转）
  try {
    await supabase.from('click_logs').insert({
      link_id: shortId,
      short_link_id: shortId,
      country,
      whatsapp_number: extractNumber(waNumber),
    })
  } catch (error) {
    console.log('写入点击日志失败：', error)
  }

  // 6) 302 临时重定向到 WhatsApp 会话
  return NextResponse.redirect(
    `https://wa.me/${extractNumber(waNumber)}`,
    { status: 302 },
  )
}

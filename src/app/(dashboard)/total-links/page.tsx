'use client'

import Link from 'next/link'
import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { createClient } from '@/lib/supabase/client'

type TotalLinkItem = {
  id: string
  code: string
  display_name: string | null
  description: string | null
  domain: string | null
  switch_mode: string | null
  created_at: string
}

// 可选的子链接（来自 links 表）
type LinkOption = {
  id: string
  code: string
  description: string | null
  whatsapp_number: string | null
}

// 已选中的子链接：id + 每日上限 + 累计上限（0 = 不限）
type SelectedSubLink = { id: string; dailyLimit: number; totalLimit: number }

const DEFAULT_DAILY_LIMIT = 30
const DEFAULT_TOTAL_LIMIT = 0

// 子链接切换方式
 type SwitchMode = 'random' | 'sequential' | 'round_robin'

const DOMAIN_OPTIONS = ['5r8.cn', 'y41.cn']

const SWITCH_MODE_OPTIONS: { value: SwitchMode; label: string }[] = [
  { value: 'random', label: '随机切换' },
  { value: 'sequential', label: '顺序切换' },
  { value: 'round_robin', label: '轮训切换' },
]

// 固定格式的时间字符串：YYYY-MM-DD HH:mm:ss
function formatDateTime(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return value
  }
  return date.toISOString().slice(0, 19).replace('T', ' ')
}

export default function TotalLinksPage() {
  const [links, setLinks] = useState<TotalLinkItem[]>([])
  const [loading, setLoading] = useState(true)
  const [copiedCode, setCopiedCode] = useState<string | null>(null)

  // 仅在客户端挂载后才渲染时间，避免 SSR 与客户端时间不一致
  const [mounted, setMounted] = useState(false)

  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  // 总链接名称（给自己看的，支持中文）
  const [displayName, setDisplayName] = useState('')
  // 短链后缀（给客户看的，只能英文数字，作为 /t/xxx 路径）
  const [code, setCode] = useState('')
  const [domain, setDomain] = useState(DOMAIN_OPTIONS[0])
  const [switchMode, setSwitchMode] = useState<SwitchMode>('random')
  // 所有可选的子链接（来自 links 表）
  const [linkOptions, setLinkOptions] = useState<LinkOption[]>([])
  const [linkOptionsLoading, setLinkOptionsLoading] = useState(false)
  // 已勾选的子链接：id -> { dailyLimit, totalLimit }
  const [selectedSubLinks, setSelectedSubLinks] = useState<SelectedSubLink[]>([])
  // 子链接搜索关键字
  const [subLinkSearch, setSubLinkSearch] = useState('')
  const [saving, setSaving] = useState(false)

  // 轻量 toast 提示
  const [toast, setToast] = useState<string | null>(null)

  // 删除确认弹窗：保存待删除的记录，null 表示未打开
  const [deletingLink, setDeletingLink] = useState<TotalLinkItem | null>(null)
  const [deleting, setDeleting] = useState(false)

  // 按搜索关键字过滤后的可选子链接
  const filteredLinkOptions = linkOptions.filter((option) => {
    const keyword = subLinkSearch.trim().toLowerCase()
    if (!keyword) return true
    const name = (option.description ?? '').toLowerCase()
    const number = (option.whatsapp_number ?? '').toLowerCase()
    const code = option.code.toLowerCase()
    return name.includes(keyword) || number.includes(keyword) || code.includes(keyword)
  })

  const showToast = useCallback((message: string) => {
    setToast(message)
    setTimeout(() => setToast(null), 4000)
  }, [])

  // 查询所有总链接
  const loadLinks = useCallback(async () => {
    setLoading(true)
    const supabase = createClient()

    try {
      // 加超时保护：若 RLS 未放开导致请求挂起，避免页面一直卡在“加载中...”
      const query = supabase
        .from('total_links')
        .select('id, code, display_name, description, domain, switch_mode, created_at')
        .order('created_at', { ascending: false })

      const timeout = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('查询总链接超时（请检查 total_links 表的 RLS 策略）')), 5000),
      )

      const { data, error } = await Promise.race([query, timeout])

      if (error) {
        console.log('查询总链接列表失败：', error)
        setLinks([])
      } else {
        setLinks(data ?? [])
      }
    } catch (err) {
      console.log('查询总链接列表异常：', err)
      setLinks([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    setMounted(true)
    loadLinks()
  }, [loadLinks])

  // 加载所有可选的子链接（links 表）
  const loadLinkOptions = useCallback(async () => {
    setLinkOptionsLoading(true)
    const supabase = createClient()

    try {
      const query = supabase
        .from('links')
        .select('id, code, description, whatsapp_number')
        .order('created_at', { ascending: false })

      const timeout = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('查询子链接超时')), 5000),
      )

      const { data, error } = await Promise.race([query, timeout])

      if (error) {
        console.log('查询子链接列表失败：', error)
        setLinkOptions([])
      } else {
        setLinkOptions((data as LinkOption[]) ?? [])
      }
    } catch (err) {
      console.log('查询子链接列表异常：', err)
      setLinkOptions([])
    } finally {
      setLinkOptionsLoading(false)
    }
  }, [])

  async function handleCopy(linkCode: string) {
    const shortUrl = window.location.origin + '/t/' + linkCode
    try {
      await navigator.clipboard.writeText(shortUrl)
      setCopiedCode(linkCode)
      setTimeout(() => setCopiedCode(null), 2000)
    } catch {
      setCopiedCode(null)
    }
  }

  function openModal() {
    setEditingId(null)
    setDisplayName('')
    setCode('')
    setDomain(DOMAIN_OPTIONS[0])
    setSwitchMode('random')
    setSelectedSubLinks([])
    setSubLinkSearch('')
    setIsModalOpen(true)
    loadLinkOptions()
  }

  async function openEditModal(link: TotalLinkItem) {
    setEditingId(link.id)
    setDisplayName(link.display_name ?? '')
    setCode(link.code)
    setDomain(link.domain || DOMAIN_OPTIONS[0])
    setSwitchMode((link.switch_mode as SwitchMode) || 'random')
    setSubLinkSearch('')
    setIsModalOpen(true)

    // 加载可选子链接 + 该总链接已配置的子链接项
    loadLinkOptions()

    const supabase = createClient()
    const { data, error } = await supabase
      .from('total_link_items')
      .select('short_link_id, daily_limit, total_limit')
      .eq('total_link_id', link.id)

    if (error) {
      console.log('查询已配置子链接失败：', error)
      setSelectedSubLinks([])
      return
    }

    setSelectedSubLinks(
      (data ?? []).map((row) => ({
        id: row.short_link_id as string,
        dailyLimit:
          typeof row.daily_limit === 'number' ? row.daily_limit : DEFAULT_DAILY_LIMIT,
        totalLimit:
          typeof row.total_limit === 'number' ? row.total_limit : DEFAULT_TOTAL_LIMIT,
      })),
    )
  }

  function closeModal() {
    setIsModalOpen(false)
    setEditingId(null)
  }

  // 子链接勾选操作
  function toggleSubLink(id: string) {
    setSelectedSubLinks((prev) => {
      const exists = prev.some((item) => item.id === id)
      if (exists) {
        return prev.filter((item) => item.id !== id)
      }
      return [
        ...prev,
        { id, dailyLimit: DEFAULT_DAILY_LIMIT, totalLimit: DEFAULT_TOTAL_LIMIT },
      ]
    })
  }

  function updateSelectedDailyLimit(id: string, value: number) {
    setSelectedSubLinks((prev) =>
      prev.map((item) =>
        item.id === id
          ? { ...item, dailyLimit: Number.isNaN(value) ? DEFAULT_DAILY_LIMIT : value }
          : item,
      ),
    )
  }

  function updateSelectedTotalLimit(id: string, value: number) {
    setSelectedSubLinks((prev) =>
      prev.map((item) =>
        item.id === id
          ? { ...item, totalLimit: Number.isNaN(value) ? DEFAULT_TOTAL_LIMIT : value }
          : item,
      ),
    )
  }

  // 全选 / 反选（作用于当前搜索结果）
  function toggleSelectAll(filtered: LinkOption[]) {
    setSelectedSubLinks((prev) => {
      const allSelected =
        filtered.length > 0 && filtered.every((opt) => prev.some((item) => item.id === opt.id))

      if (allSelected) {
        const filteredIds = new Set(filtered.map((opt) => opt.id))
        return prev.filter((item) => !filteredIds.has(item.id))
      }

      const next = [...prev]
      for (const opt of filtered) {
        if (!next.some((item) => item.id === opt.id)) {
          next.push({
            id: opt.id,
            dailyLimit: DEFAULT_DAILY_LIMIT,
            totalLimit: DEFAULT_TOTAL_LIMIT,
          })
        }
      }
      return next
    })
  }

  // 点击“删除”时打开自定义确认弹窗
  function openDeleteModal(link: TotalLinkItem) {
    setDeletingLink(link)
  }

  function closeDeleteModal() {
    setDeletingLink(null)
  }

  // 确认删除：从数据库删除该记录，并同步内存状态
  async function confirmDelete() {
    if (!deletingLink) {
      return
    }

    setDeleting(true)
    const supabase = createClient()

    const { error } = await supabase
      .from('total_links')
      .delete()
      .eq('id', deletingLink.id)

    if (error) {
      console.log('删除总链接失败：', error)
      setDeleting(false)
      return
    }

    setLinks((prev) => prev.filter((item) => item.id !== deletingLink.id))
    setDeleting(false)
    setDeletingLink(null)
  }

  // 同步子链接项：把勾选的子链接 id 数组写入 total_link_items
  // - 已存在的项更新上限，新项插入，未勾选的删除
  async function syncSubLinkItems(
    supabase: ReturnType<typeof createClient>,
    totalLinkId: string,
    items: SelectedSubLink[],
  ): Promise<{ error: Error | null }> {
    // 1) 读取现有子链接项
    const { data: existing, error: existingError } = await supabase
      .from('total_link_items')
      .select('id, short_link_id')
      .eq('total_link_id', totalLinkId)

    if (existingError) {
      return { error: new Error(existingError.message) }
    }

    const existingByShortId = new Map<string, string>()
    for (const row of existing ?? []) {
      existingByShortId.set(row.short_link_id, row.id)
    }

    const keptItemIds = new Set<string>()

    for (const item of items) {
      const existingItemId = existingByShortId.get(item.id)
      if (existingItemId) {
        // 更新已有项的上限
        const { error: updateError } = await supabase
          .from('total_link_items')
          .update({
            daily_limit: item.dailyLimit,
            total_limit: item.totalLimit,
          })
          .eq('id', existingItemId)

        if (updateError) {
          return { error: new Error(updateError.message) }
        }
        keptItemIds.add(existingItemId)
      } else {
        // 插入新项
        const { data: inserted, error: insertError } = await supabase
          .from('total_link_items')
          .insert({
            total_link_id: totalLinkId,
            short_link_id: item.id,
            weight: 1,
            daily_limit: item.dailyLimit,
            total_limit: item.totalLimit,
          })
          .select('id')
          .single()

        if (insertError || !inserted) {
          return { error: new Error(insertError?.message ?? '添加子链接失败') }
        }
        keptItemIds.add(inserted.id)
      }
    }

    // 2) 删除本次未保留的旧项
    for (const row of existing ?? []) {
      if (!keptItemIds.has(row.id)) {
        const { error: deleteError } = await supabase
          .from('total_link_items')
          .delete()
          .eq('id', row.id)

        if (deleteError) {
          return { error: new Error(deleteError.message) }
        }
      }
    }

    return { error: null }
  }

  // 保存：新建写入数据库，编辑更新数据库
  async function handleSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const trimmedName = displayName.trim()
    const trimmedCode = code.trim().toLowerCase()
    const validSubLinks = selectedSubLinks.map((item) => ({
      id: item.id,
      dailyLimit:
        Number.isFinite(item.dailyLimit) && item.dailyLimit > 0
          ? Math.floor(item.dailyLimit)
          : DEFAULT_DAILY_LIMIT,
      totalLimit:
        Number.isFinite(item.totalLimit) && item.totalLimit > 0
          ? Math.floor(item.totalLimit)
          : DEFAULT_TOTAL_LIMIT,
    }))

    if (!trimmedName) {
      showToast('请输入总链接名称')
      return
    }

    if (!trimmedCode) {
      showToast('请输入短链后缀')
      return
    }

    if (!/^[a-z0-9-]+$/.test(trimmedCode)) {
      showToast('短链后缀只能包含英文、数字和中划线')
      return
    }

    if (validSubLinks.length === 0) {
      showToast('请至少勾选一个子链接')
      return
    }

    setSaving(true)
    const supabase = createClient()

    // 先检查 Supabase 是否可连，避免一直卡在“保存中...”
    try {
      const ping = supabase.from('total_links').select('id').limit(1)
      const timeout = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('连接 Supabase 超时')), 5000),
      )
      const { error: pingError } = await Promise.race([ping, timeout])
      if (pingError) {
        throw pingError
      }
    } catch (err) {
      console.log('Supabase 连接检查失败：', err)
      const message = err instanceof Error ? err.message : String(err)
      showToast(`保存失败：${message}`)
      setSaving(false)
      return
    }

    // 1) 保存总链接本身（名称 / 后缀 / 域名 / 切换方式）
    let totalLinkId = editingId

    if (editingId) {
      const { data, error } = await supabase
        .from('total_links')
        .update({
          code: trimmedCode,
          display_name: trimmedName,
          domain,
          switch_mode: switchMode,
        })
        .eq('id', editingId)
        .select('id, code, display_name, description, domain, switch_mode, created_at')
        .single()

      if (error) {
        console.log('更新总链接失败：', error)
        showToast(`保存失败：${error.message}`)
        setSaving(false)
        return
      }

      setLinks((prev) =>
        prev.map((item) => (item.id === editingId ? data : item)),
      )
    } else {
      const { data, error } = await supabase
        .from('total_links')
        .insert({
          code: trimmedCode,
          display_name: trimmedName,
          domain,
          switch_mode: switchMode,
        })
        .select('id, code, display_name, description, domain, switch_mode, created_at')
        .single()

      if (error) {
        console.log('创建总链接失败：', error)
        showToast(`创建失败：${error.message}`)
        setSaving(false)
        return
      }

      totalLinkId = data.id
      setLinks((prev) => [data, ...prev])
    }

    // 2) 同步子链接项（total_link_items）：按号码匹配已有短链接，写入每日/累计上限
    if (totalLinkId) {
      const { error: syncError } = await syncSubLinkItems(
        supabase,
        totalLinkId,
        validSubLinks,
      )
      if (syncError) {
        console.log('同步子链接失败：', syncError)
        showToast(`子链接保存失败：${syncError.message}`)
        setSaving(false)
        return
      }
    }

    setSaving(false)
    closeModal()
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">总链接</h1>
          <p className="text-sm text-neutral-600">
            管理你的总链接，详情页可配置子链接与权重
          </p>
        </div>
        <button
          type="button"
          onClick={openModal}
          className="rounded-md bg-black px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-neutral-800"
        >
          创建总链接
        </button>
      </div>

      <div className="overflow-x-auto rounded-md border border-neutral-200">
        <table className="w-full border-collapse text-left text-sm">
          <thead className="bg-neutral-50">
            <tr>
              <th className="border-b border-neutral-200 px-4 py-3 font-medium text-neutral-700">
                总链接名称
              </th>
              <th className="border-b border-neutral-200 px-4 py-3 font-medium text-neutral-700">
                短链域名
              </th>
              <th className="border-b border-neutral-200 px-4 py-3 font-medium text-neutral-700">
                切换方式
              </th>
              <th className="border-b border-neutral-200 px-4 py-3 font-medium text-neutral-700">
                子链接上限
              </th>
              <th className="border-b border-neutral-200 px-4 py-3 font-medium text-neutral-700">
                创建时间
              </th>
              <th className="border-b border-neutral-200 px-4 py-3 font-medium text-neutral-700">
                操作
              </th>
            </tr>
          </thead>
          <tbody>
            {links.map((link) => (
              <tr key={link.id} className="hover:bg-neutral-50">
                <td className="border-b border-neutral-200 px-4 py-3 text-black">
                  <Link
                    href={`/total-links/${link.code}`}
                    className="text-black underline-offset-4 transition-colors hover:text-blue-600 hover:underline"
                  >
                    {link.display_name || link.code}
                  </Link>
                </td>
                <td className="border-b border-neutral-200 px-4 py-3 text-neutral-700">
                  {link.domain || '—'}
                </td>
                <td className="border-b border-neutral-200 px-4 py-3 text-neutral-700">
                  {SWITCH_MODE_OPTIONS.find((o) => o.value === link.switch_mode)?.label || '随机切换'}
                </td>
                <td className="border-b border-neutral-200 px-4 py-3 text-neutral-700">
                  <Link
                    href={`/total-links/${link.code}`}
                    className="text-xs text-blue-600 underline-offset-4 transition-colors hover:underline"
                  >
                    在详情页配置
                  </Link>
                </td>
                <td className="border-b border-neutral-200 px-4 py-3 text-neutral-600">
                  {mounted ? formatDateTime(link.created_at) : '—'}
                </td>
                <td className="border-b border-neutral-200 px-4 py-3">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleCopy(link.code)}
                      className="w-20 rounded-md border border-neutral-300 px-2 py-1 text-center text-xs font-medium text-black transition-colors hover:bg-neutral-100"
                    >
                      {copiedCode === link.code ? '已复制' : '复制'}
                    </button>
                    <button
                      type="button"
                      onClick={() => openEditModal(link)}
                      className="rounded-md px-2 py-1 text-xs font-medium text-blue-600 transition-colors hover:bg-blue-50"
                    >
                      编辑
                    </button>
                    <button
                      type="button"
                      onClick={() => openDeleteModal(link)}
                      className="rounded-md px-2 py-1 text-xs font-medium text-red-600 transition-colors hover:bg-red-50"
                    >
                      删除
                    </button>
                  </div>
                </td>
              </tr>
            ))}

            {!loading && links.length === 0 && (
              <tr>
                <td
                  colSpan={6}
                  className="border-b border-neutral-200 px-4 py-8 text-center text-sm text-neutral-500"
                >
                  暂无总链接，点击右上角「创建总链接」开始。
                </td>
              </tr>
            )}

            {loading && (
              <tr>
                <td
                  colSpan={6}
                  className="border-b border-neutral-200 px-4 py-8 text-center text-sm text-neutral-500"
                >
                  加载中...
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {isModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={closeModal}
        >
          <div
            className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-lg bg-white p-6 shadow-xl"
            onClick={(event) => event.stopPropagation()}
          >
            <h2 className="text-lg font-semibold tracking-tight">
              {editingId ? '编辑活链接' : '创建活链接'}
            </h2>
            <p className="mt-1 text-sm text-neutral-600">
              配置总链接名称、短链后缀、短链域名与子链接
            </p>

            <form onSubmit={handleSave} className="mt-5 space-y-5">
              {/* 总链接名称（给自己看的） */}
              <div className="space-y-1">
                <label
                  htmlFor="displayName"
                  className="block text-sm font-medium text-black"
                >
                  <span className="text-red-500">*</span> 总链接名称
                </label>
                <input
                  id="displayName"
                  type="text"
                  required
                  value={displayName}
                  onChange={(event) => setDisplayName(event.target.value)}
                  className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm text-black outline-none focus:border-blue-500"
                  placeholder="例如：啊买家具"
                />
              </div>

              {/* 短链后缀（给客户看的） */}
              <div className="space-y-1">
                <label
                  htmlFor="code"
                  className="block text-sm font-medium text-black"
                >
                  <span className="text-red-500">*</span> 短链后缀
                </label>
                <input
                  id="code"
                  type="text"
                  required
                  value={code}
                  onChange={(event) =>
                    setCode(event.target.value.replace(/[^a-zA-Z0-9-]/g, ''))
                  }
                  className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm text-black outline-none focus:border-blue-500"
                  placeholder="例如：amujiaju"
                />
              </div>

              {/* 短链域名 */}
              <div className="space-y-1">
                <label
                  htmlFor="domain"
                  className="block text-sm font-medium text-black"
                >
                  短链域名
                </label>
                <select
                  id="domain"
                  value={domain}
                  onChange={(event) => setDomain(event.target.value)}
                  className="w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm text-black outline-none focus:border-blue-500"
                >
                  {DOMAIN_OPTIONS.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </div>

              {/* 子链接列表 */}
              <div className="space-y-2">
                <label className="block text-sm font-medium text-black">
                  <span className="text-red-500">*</span> 子链接列表
                  <span className="ml-2 text-xs font-normal text-neutral-500">
                    已选 {selectedSubLinks.length} 个
                  </span>
                </label>

                {/* 搜索框 */}
                <input
                  type="text"
                  value={subLinkSearch}
                  onChange={(event) => setSubLinkSearch(event.target.value)}
                  className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm text-black outline-none focus:border-blue-500"
                  placeholder="搜索备注名或号码"
                />

                {/* 全选 / 反选 */}
                <div className="flex items-center justify-between text-xs text-neutral-500">
                  <button
                    type="button"
                    onClick={() => toggleSelectAll(filteredLinkOptions)}
                    className="font-medium text-blue-600 hover:text-blue-700"
                  >
                    全选 / 反选
                  </button>
                  <span>共 {filteredLinkOptions.length} 个</span>
                </div>

                {/* 可下滑的勾选列表 */}
                <div className="max-h-56 overflow-y-auto rounded-md border border-neutral-200">
                  {linkOptionsLoading ? (
                    <p className="px-3 py-4 text-center text-sm text-neutral-500">
                      加载中...
                    </p>
                  ) : filteredLinkOptions.length === 0 ? (
                    <p className="px-3 py-4 text-center text-sm text-neutral-500">
                      {linkOptions.length === 0
                        ? '暂无子链接，请先去「子链接」页面创建'
                        : '没有匹配的子链接'}
                    </p>
                  ) : (
                    filteredLinkOptions.map((option) => {
                      const checked = selectedSubLinks.some(
                        (item) => item.id === option.id,
                      )
                      const fullUrl = option.whatsapp_number
                        ? `https://wa.me/${option.whatsapp_number.replace(/[^0-9]/g, '')}`
                        : ''
                      return (
                        <label
                          key={option.id}
                          title={fullUrl || option.code}
                          className="flex cursor-pointer items-center gap-2 border-b border-neutral-100 px-3 py-2 text-sm text-black last:border-b-0 hover:bg-neutral-50"
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => toggleSubLink(option.id)}
                            className="h-4 w-4 shrink-0 accent-blue-600"
                          />
                          <span className="truncate">
                            {option.description || option.code}
                          </span>
                        </label>
                      )
                    })
                  )}
                </div>
              </div>

              {/* 子链接切换方式 */}
              <div className="space-y-2">
                <label className="block text-sm font-medium text-black">
                  子链接切换方式
                </label>
                <div className="flex flex-wrap gap-2">
                  {SWITCH_MODE_OPTIONS.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => setSwitchMode(option.value)}
                      className={`rounded-md border px-3 py-2 text-sm font-medium transition-colors ${
                        switchMode === option.value
                          ? 'border-blue-500 bg-blue-50 text-blue-600'
                          : 'border-neutral-300 text-neutral-700 hover:bg-neutral-50'
                      }`}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={closeModal}
                  className="rounded-md border border-neutral-300 px-4 py-2 text-sm font-medium text-black transition-colors hover:bg-neutral-50"
                >
                  取消
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:opacity-50"
                >
                  {saving ? '创建中...' : '立即创建活链接'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {deletingLink && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={closeDeleteModal}
        >
          <div
            className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl"
            onClick={(event) => event.stopPropagation()}
          >
            <h2 className="text-lg font-semibold tracking-tight">确认删除</h2>
            <p className="mt-1 text-sm text-neutral-600">
              删除后不可恢复，确定要删除吗？
            </p>

            <div className="mt-4 space-y-2 rounded-md border border-neutral-200 bg-neutral-50 p-4">
              <div className="flex items-center justify-between gap-4">
                <span className="text-xs text-neutral-500">总链接名称</span>
                <span className="text-sm text-black">
                  {deletingLink.display_name || '—'}
                </span>
              </div>
              <div className="flex items-center justify-between gap-4">
                <span className="text-xs text-neutral-500">短链后缀</span>
                <span className="font-mono text-sm text-black">
                  {deletingLink.code}
                </span>
              </div>
              <div className="flex items-center justify-between gap-4">
                <span className="text-xs text-neutral-500">短链域名</span>
                <span className="text-sm text-black">
                  {deletingLink.domain || '—'}
                </span>
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                onClick={closeDeleteModal}
                className="rounded-md border border-neutral-300 px-4 py-2 text-sm font-medium text-black transition-colors hover:bg-neutral-50"
              >
                取消
              </button>
              <button
                type="button"
                onClick={confirmDelete}
                disabled={deleting}
                className="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-red-700 disabled:opacity-50"
              >
                {deleting ? '删除中...' : '确认删除'}
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div className="fixed bottom-6 left-1/2 z-[60] -translate-x-1/2 rounded-md bg-neutral-900 px-4 py-3 text-sm font-medium text-white shadow-lg">
          {toast}
        </div>
      )}
    </div>
  )
}

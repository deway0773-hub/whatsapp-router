'use client'

import Link from 'next/link'
import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { createClient } from '@/lib/supabase/client'

type TotalLinkItem = {
  id: string
  code: string
  description: string | null
  domain: string | null
  switch_mode: string | null
  limit_type: string | null
  created_at: string
}

// 子链接切换方式
 type SwitchMode = 'random' | 'sequential' | 'round_robin'
// 上限方式
type LimitType = 'total' | 'daily'

const DOMAIN_OPTIONS = ['5r8.cn', 'y41.cn']

const SWITCH_MODE_OPTIONS: { value: SwitchMode; label: string }[] = [
  { value: 'random', label: '随机切换' },
  { value: 'sequential', label: '顺序切换' },
  { value: 'round_robin', label: '轮训切换' },
]

const LIMIT_TYPE_OPTIONS: { value: LimitType; label: string }[] = [
  { value: 'total', label: '累计上限' },
  { value: 'daily', label: '每日上限' },
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
  const [code, setCode] = useState('')
  const [domain, setDomain] = useState(DOMAIN_OPTIONS[0])
  const [switchMode, setSwitchMode] = useState<SwitchMode>('random')
  const [limitType, setLimitType] = useState<LimitType>('total')
  // 子链接列表：每行一个 WhatsApp 链接
  const [subLinks, setSubLinks] = useState<string[]>([''])
  const [saving, setSaving] = useState(false)

  // 轻量 toast 提示
  const [toast, setToast] = useState<string | null>(null)

  // 删除确认弹窗：保存待删除的记录，null 表示未打开
  const [deletingLink, setDeletingLink] = useState<TotalLinkItem | null>(null)
  const [deleting, setDeleting] = useState(false)

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
        .select('id, code, description, domain, switch_mode, limit_type, created_at')
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
    setCode('')
    setDomain(DOMAIN_OPTIONS[0])
    setSwitchMode('random')
    setLimitType('total')
    setSubLinks([''])
    setIsModalOpen(true)
  }

  function openEditModal(link: TotalLinkItem) {
    setEditingId(link.id)
    setCode(link.code)
    setDomain(link.domain || DOMAIN_OPTIONS[0])
    setSwitchMode((link.switch_mode as SwitchMode) || 'random')
    setLimitType((link.limit_type as LimitType) || 'total')
    setSubLinks([''])
    setIsModalOpen(true)
  }

  function closeModal() {
    setIsModalOpen(false)
    setEditingId(null)
  }

  // 子链接行操作
  function updateSubLink(index: number, value: string) {
    setSubLinks((prev) => prev.map((item, i) => (i === index ? value : item)))
  }

  function addSubLink() {
    setSubLinks((prev) => [...prev, ''])
  }

  function removeSubLink(index: number) {
    setSubLinks((prev) =>
      prev.length <= 1 ? prev : prev.filter((_, i) => i !== index),
    )
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

  // 保存：新建写入数据库，编辑更新数据库
  async function handleSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const trimmedCode = code.trim()
    const validSubLinks = subLinks.map((item) => item.trim()).filter(Boolean)

    if (!trimmedCode) {
      showToast('请输入总链接名称')
      return
    }

    if (validSubLinks.length === 0) {
      showToast('请至少添加一个子链接')
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
      showToast('请先去 Supabase 后台 Restore 项目')
      setSaving(false)
      return
    }

    if (editingId) {
      // 编辑模式：更新对应记录
      const { data, error } = await supabase
        .from('total_links')
        .update({
          code: trimmedCode,
          domain,
          switch_mode: switchMode,
          limit_type: limitType,
        })
        .eq('id', editingId)
        .select('id, code, description, domain, switch_mode, limit_type, created_at')
        .single()

      if (error) {
        console.log('更新总链接失败：', error)
        showToast('保存失败，请检查 Supabase 连接')
        setSaving(false)
        return
      }

      setLinks((prev) =>
        prev.map((item) => (item.id === editingId ? data : item)),
      )
    } else {
      // 新建模式：写入数据库
      const { data, error } = await supabase
        .from('total_links')
        .insert({
          code: trimmedCode,
          domain,
          switch_mode: switchMode,
          limit_type: limitType,
        })
        .select('id, code, description, domain, switch_mode, limit_type, created_at')
        .single()

      if (error) {
        console.log('创建总链接失败：', error)
        showToast('创建失败，请检查 Supabase 连接')
        setSaving(false)
        return
      }

      setLinks((prev) => [data, ...prev])
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
                总链接名字
              </th>
              <th className="border-b border-neutral-200 px-4 py-3 font-medium text-neutral-700">
                短链域名
              </th>
              <th className="border-b border-neutral-200 px-4 py-3 font-medium text-neutral-700">
                切换方式
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
                <td className="border-b border-neutral-200 px-4 py-3 font-mono text-black">
                  <Link
                    href={`/total-links/${link.code}`}
                    className="text-black underline-offset-4 transition-colors hover:text-blue-600 hover:underline"
                  >
                    {link.code}
                  </Link>
                </td>
                <td className="border-b border-neutral-200 px-4 py-3 text-neutral-700">
                  {link.domain || '—'}
                </td>
                <td className="border-b border-neutral-200 px-4 py-3 text-neutral-700">
                  {SWITCH_MODE_OPTIONS.find((o) => o.value === link.switch_mode)?.label || '随机切换'}
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
                  colSpan={5}
                  className="border-b border-neutral-200 px-4 py-8 text-center text-sm text-neutral-500"
                >
                  暂无总链接，点击右上角「创建总链接」开始。
                </td>
              </tr>
            )}

            {loading && (
              <tr>
                <td
                  colSpan={5}
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
              配置总链接名称、短链域名与子链接
            </p>

            <form onSubmit={handleSave} className="mt-5 space-y-5">
              {/* 总链接名称 */}
              <div className="space-y-1">
                <label
                  htmlFor="code"
                  className="block text-sm font-medium text-black"
                >
                  <span className="text-red-500">*</span> 总链接名称
                </label>
                <input
                  id="code"
                  type="text"
                  required
                  value={code}
                  onChange={(event) => setCode(event.target.value)}
                  className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm text-black outline-none focus:border-blue-500"
                  placeholder="请输入总链接名称，如 aaa"
                />
                <p className="text-xs text-neutral-500">
                  英文数字，会作为 /t/xxx 路径
                </p>
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
                </label>
                <div className="space-y-2">
                  {subLinks.map((item, index) => (
                    <div key={index} className="flex items-center gap-2">
                      <input
                        type="text"
                        value={item}
                        onChange={(event) =>
                          updateSubLink(index, event.target.value)
                        }
                        className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm text-black outline-none focus:border-blue-500"
                        placeholder="请输入 WhatsApp 链接，如 https://wa.me/8613800138000"
                      />
                      <button
                        type="button"
                        onClick={() => removeSubLink(index)}
                        disabled={subLinks.length <= 1}
                        className="shrink-0 rounded-md border border-neutral-300 p-2 text-neutral-500 transition-colors hover:bg-red-50 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-40"
                        aria-label="删除子链接"
                      >
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          className="h-4 w-4"
                        >
                          <path d="M3 6h18" />
                          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
                          <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                          <line x1="10" y1="11" x2="10" y2="17" />
                          <line x1="14" y1="11" x2="14" y2="17" />
                        </svg>
                      </button>
                    </div>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={addSubLink}
                  className="rounded-md border border-dashed border-neutral-300 px-3 py-2 text-sm font-medium text-neutral-700 transition-colors hover:border-blue-500 hover:text-blue-600"
                >
                  + 添加子链接
                </button>
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

              {/* 上限方式 */}
              <div className="space-y-2">
                <label className="block text-sm font-medium text-black">
                  上限方式
                </label>
                <div className="flex flex-wrap gap-2">
                  {LIMIT_TYPE_OPTIONS.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => setLimitType(option.value)}
                      className={`rounded-md border px-3 py-2 text-sm font-medium transition-colors ${
                        limitType === option.value
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
                <span className="text-xs text-neutral-500">总链接名字</span>
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

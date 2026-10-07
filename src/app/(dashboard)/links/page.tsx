'use client'

import Link from 'next/link'
import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { createClient } from '@/lib/supabase/client'

type LinkItem = {
  id: string
  code: string
  description: string | null
  whatsapp_number?: string | null
  original_url?: string | null
  daily_limit?: number | null
  total_limit?: number | null
  created_at: string
}

const DEFAULT_DAILY_LIMIT = 30

// 从 WhatsApp 链接中提取纯号码
function extractNumber(url: string): string {
  return url.replace(/[^0-9]/g, '')
}

// 生成随机短链接代码（小写字母 + 数字，8 位）
function generateCode(length = 8): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789'
  let result = ''
  for (let i = 0; i < length; i += 1) {
    result += chars[Math.floor(Math.random() * chars.length)]
  }
  return result
}

// 取号码后 8 位用于列表展示
function tailNumber(value: string | null | undefined): string {
  const digits = extractNumber(String(value ?? ''))
  if (!digits) return '—'
  return digits.length > 8 ? `…${digits.slice(-8)}` : digits
}

// 固定格式的时间字符串：YYYY-MM-DD HH:mm:ss
function formatDateTime(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return value
  }
  return date.toISOString().slice(0, 19).replace('T', ' ')
}

export default function LinksPage() {
  const [links, setLinks] = useState<LinkItem[]>([])
  const [loading, setLoading] = useState(true)
  const [copiedCode, setCopiedCode] = useState<string | null>(null)

  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [originalUrl, setOriginalUrl] = useState('')
  const [dailyLimit, setDailyLimit] = useState(DEFAULT_DAILY_LIMIT)
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState<string | null>(null)

  // 删除确认弹窗：保存待删除的记录，null 表示未打开
  const [deletingLink, setDeletingLink] = useState<LinkItem | null>(null)
  const [deleting, setDeleting] = useState(false)

  // 查询所有子链接
  const loadLinks = useCallback(async () => {
    setLoading(true)
    const supabase = createClient()

    const { data, error } = await supabase
      .from('links')
      .select(
        'id, code, description, whatsapp_number, original_url, daily_limit, total_limit, created_at',
      )
      .order('created_at', { ascending: false })

    if (error) {
      console.log('查询子链接列表失败：', error)
      setLinks([])
    } else {
      setLinks(data ?? [])
    }

    setLoading(false)
  }, [])

  useEffect(() => {
    loadLinks()
  }, [loadLinks])

  async function handleCopy(linkCode: string) {
    const shortUrl = window.location.origin + '/r/' + linkCode
    try {
      await navigator.clipboard.writeText(shortUrl)
      setCopiedCode(linkCode)
      setTimeout(() => setCopiedCode(null), 2000)
    } catch {
      setCopiedCode(null)
    }
  }

  const showToast = useCallback((message: string) => {
    setToast(message)
    setTimeout(() => setToast(null), 4000)
  }, [])

  function openModal() {
    setEditingId(null)
    setName('')
    setOriginalUrl('')
    setDailyLimit(DEFAULT_DAILY_LIMIT)
    setIsModalOpen(true)
  }

  function openEditModal(link: LinkItem) {
    setEditingId(link.id)
    setName(link.description ?? '')
    setOriginalUrl(link.original_url ?? '')
    setDailyLimit(
      typeof link.daily_limit === 'number' ? link.daily_limit : DEFAULT_DAILY_LIMIT,
    )
    setIsModalOpen(true)
  }

  // 备注名统一存 description，code 仅作为短链接代码

  function closeModal() {
    setIsModalOpen(false)
    setEditingId(null)
  }

  // 点击“删除”时打开自定义确认弹窗（不再使用 window.confirm）
  function openDeleteModal(link: LinkItem) {
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
      .from('links')
      .delete()
      .eq('id', deletingLink.id)

    if (error) {
      console.log('删除短链接失败：', error)
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

    const trimmedName = name.trim()
    const trimmedUrl = originalUrl.trim()
    const number = extractNumber(trimmedUrl)
    const finalDailyLimit =
      Number.isFinite(dailyLimit) && dailyLimit > 0
        ? Math.floor(dailyLimit)
        : DEFAULT_DAILY_LIMIT

    if (!trimmedName) {
      showToast('请输入备注名')
      return
    }

    if (!trimmedUrl) {
      showToast('请输入 WhatsApp 链接')
      return
    }

    if (!number) {
      showToast('WhatsApp 链接中未找到有效号码')
      return
    }

    setSaving(true)
    const supabase = createClient()

    // 备注名存 description；code 仅作为短链接代码，编辑时保持不变
    const payload = {
      description: trimmedName,
      original_url: trimmedUrl,
      whatsapp_number: number,
      daily_limit: finalDailyLimit,
    }

    const selectColumns =
      'id, code, description, whatsapp_number, original_url, daily_limit, total_limit, created_at'

    if (editingId) {
      // 编辑模式：更新对应记录（不改 code）
      const { data, error } = await supabase
        .from('links')
        .update(payload)
        .eq('id', editingId)
        .select(selectColumns)
        .single()

      if (error) {
        console.log('更新子链接失败：', error)
        showToast(`保存失败：${error.message}`)
        setSaving(false)
        return
      }

      setLinks((prev) =>
        prev.map((item) => (item.id === editingId ? data : item)),
      )
    } else {
      // 新建模式：自动生成随机短码后写入数据库
      const { data, error } = await supabase
        .from('links')
        .insert({ ...payload, code: generateCode() })
        .select(selectColumns)
        .single()

      if (error) {
        console.log('创建子链接失败：', error)
        showToast(`保存失败：${error.message}`)
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
          <h1 className="text-2xl font-semibold tracking-tight">子链接</h1>
          <p className="text-sm text-neutral-600">
            管理你的子链接（WhatsApp 号码与分流上限）
          </p>
        </div>
        <button
          type="button"
          onClick={openModal}
          className="rounded-md bg-black px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-neutral-800"
        >
          创建子链接
        </button>
      </div>

      <div className="overflow-x-auto rounded-md border border-neutral-200">
        <table className="w-full border-collapse text-left text-sm">
          <thead className="bg-neutral-50">
            <tr>
              <th className="border-b border-neutral-200 px-4 py-3 font-medium text-neutral-700">
                备注名
              </th>
              <th className="border-b border-neutral-200 px-4 py-3 font-medium text-neutral-700">
                WhatsApp 链接
              </th>
              <th className="border-b border-neutral-200 px-4 py-3 font-medium text-neutral-700">
                每日上限
              </th>
              <th className="border-b border-neutral-200 px-4 py-3 font-medium text-neutral-700">
                状态
              </th>
              <th className="border-b border-neutral-200 px-4 py-3 font-medium text-neutral-700">
                操作
              </th>
            </tr>
          </thead>
          <tbody>
            {links.map((link) => {
              const daily = link.daily_limit ?? DEFAULT_DAILY_LIMIT
              const fullUrl =
                link.original_url ||
                (link.whatsapp_number
                  ? `https://wa.me/${extractNumber(link.whatsapp_number)}`
                  : '')

              return (
                <tr key={link.id} className="hover:bg-neutral-50">
                  <td className="border-b border-neutral-200 px-4 py-3 font-medium text-black">
                    <Link
                      href={`/links/${link.code}`}
                      className="text-black underline-offset-4 transition-colors hover:text-blue-600 hover:underline"
                    >
                      {link.description || link.code}
                    </Link>
                  </td>
                  <td
                    className="border-b border-neutral-200 px-4 py-3 font-mono text-neutral-700"
                    title={fullUrl || undefined}
                  >
                    {tailNumber(link.whatsapp_number || link.original_url)}
                  </td>
                  <td className="border-b border-neutral-200 px-4 py-3 text-neutral-700">
                    {daily > 0 ? `${daily} 次/天` : '不限'}
                  </td>
                  <td className="border-b border-neutral-200 px-4 py-3">
                    <span className="inline-flex items-center rounded-full bg-green-50 px-2 py-0.5 text-xs font-medium text-green-700">
                      启用
                    </span>
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
              )
            })}

            {!loading && links.length === 0 && (
              <tr>
                <td
                  colSpan={5}
                  className="border-b border-neutral-200 px-4 py-8 text-center text-sm text-neutral-500"
                >
                  暂无子链接，点击右上角「创建子链接」开始。
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
            className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl"
            onClick={(event) => event.stopPropagation()}
          >
            <h2 className="text-lg font-semibold tracking-tight">
              {editingId ? '编辑子链接' : '创建子链接'}
            </h2>
            <p className="mt-1 text-sm text-neutral-600">
              {editingId
                ? '修改备注名、WhatsApp 链接与分流上限'
                : '填写备注名与 WhatsApp 链接，设置分流上限'}
            </p>

            <form onSubmit={handleSave} className="mt-4 space-y-4">
              <div className="space-y-1">
                <label
                  htmlFor="name"
                  className="block text-sm font-medium text-black"
                >
                  备注名 <span className="text-red-500">*</span>
                </label>
                <input
                  id="name"
                  type="text"
                  required
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm text-black outline-none focus:border-black"
                  placeholder="如：美国1号"
                />
              </div>

              <div className="space-y-1">
                <label
                  htmlFor="originalUrl"
                  className="block text-sm font-medium text-black"
                >
                  WhatsApp 链接 <span className="text-red-500">*</span>
                </label>
                <input
                  id="originalUrl"
                  type="text"
                  required
                  value={originalUrl}
                  onChange={(event) => setOriginalUrl(event.target.value)}
                  className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm text-black outline-none focus:border-black"
                  placeholder="https://wa.me/..."
                />
              </div>

              <div className="space-y-1">
                <label
                  htmlFor="dailyLimit"
                  className="block text-sm font-medium text-black"
                >
                  每日上限
                </label>
                <input
                  id="dailyLimit"
                  type="number"
                  min={0}
                  value={dailyLimit}
                  onChange={(event) =>
                    setDailyLimit(Number(event.target.value))
                  }
                  className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm text-black outline-none focus:border-black"
                  placeholder="默认30，填0表示不限"
                />
                <p className="text-xs text-neutral-500">
                  每日上限填 0 表示不限，默认为每日 30 次。
                </p>
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
                  className="rounded-md bg-black px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-neutral-800 disabled:opacity-50"
                >
                  {saving ? '保存中...' : '保存'}
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
                <span className="text-xs text-neutral-500">备注名</span>
                <span className="font-mono text-sm text-black">
                  {deletingLink.description || deletingLink.code}
                </span>
              </div>
              <div className="flex items-center justify-between gap-4">
                <span className="text-xs text-neutral-500">WhatsApp 号码</span>
                <span className="font-mono text-sm text-black">
                  {deletingLink.whatsapp_number || '—'}
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
        <div className="fixed bottom-6 left-1/2 z-[60] -translate-x-1/2 rounded-md bg-black px-4 py-2 text-sm font-medium text-white shadow-lg">
          {toast}
        </div>
      )}
    </div>
  )
}

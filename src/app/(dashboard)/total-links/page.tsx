'use client'

import Link from 'next/link'
import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { createClient } from '@/lib/supabase/client'

type TotalLinkItem = {
  id: string
  code: string
  description: string | null
  created_at: string
}

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
  const [description, setDescription] = useState('')
  const [code, setCode] = useState('')
  const [saving, setSaving] = useState(false)

  // 删除确认弹窗：保存待删除的记录，null 表示未打开
  const [deletingLink, setDeletingLink] = useState<TotalLinkItem | null>(null)
  const [deleting, setDeleting] = useState(false)

  // 查询所有总链接
  const loadLinks = useCallback(async () => {
    setLoading(true)
    const supabase = createClient()

    try {
      // 加超时保护：若 RLS 未放开导致请求挂起，避免页面一直卡在“加载中...”
      const query = supabase
        .from('total_links')
        .select('id, code, description, created_at')
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
    setDescription('')
    setCode('')
    setIsModalOpen(true)
  }

  function openEditModal(link: TotalLinkItem) {
    setEditingId(link.id)
    setDescription(link.description ?? '')
    setCode(link.code)
    setIsModalOpen(true)
  }

  function closeModal() {
    setIsModalOpen(false)
    setEditingId(null)
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
    const trimmedDescription = description.trim()

    if (!trimmedCode) {
      return
    }

    setSaving(true)
    const supabase = createClient()

    if (editingId) {
      // 编辑模式：更新对应记录
      const { data, error } = await supabase
        .from('total_links')
        .update({
          code: trimmedCode,
          description: trimmedDescription || null,
        })
        .eq('id', editingId)
        .select('id, code, description, created_at')
        .single()

      if (error) {
        console.log('更新总链接失败：', error)
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
          description: trimmedDescription || null,
        })
        .select('id, code, description, created_at')
        .single()

      if (error) {
        console.log('创建总链接失败：', error)
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
                描述
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
                  {link.description || '—'}
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
                  colSpan={4}
                  className="border-b border-neutral-200 px-4 py-8 text-center text-sm text-neutral-500"
                >
                  暂无总链接，点击右上角「创建总链接」开始。
                </td>
              </tr>
            )}

            {loading && (
              <tr>
                <td
                  colSpan={4}
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
              {editingId ? '编辑总链接' : '创建总链接'}
            </h2>
            <p className="mt-1 text-sm text-neutral-600">
              {editingId ? '修改总链接名字与描述' : '填写总链接名字，可选描述'}
            </p>

            <form onSubmit={handleSave} className="mt-4 space-y-4">
              <div className="space-y-1">
                <label
                  htmlFor="code"
                  className="block text-sm font-medium text-black"
                >
                  总链接名字
                </label>
                <input
                  id="code"
                  type="text"
                  required
                  value={code}
                  onChange={(event) => setCode(event.target.value)}
                  className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm text-black outline-none focus:border-black"
                  placeholder="total1"
                />
                <p className="text-xs text-neutral-500">
                  建议使用英文或数字，将作为总链接路径
                </p>
              </div>

              <div className="space-y-1">
                <label
                  htmlFor="description"
                  className="block text-sm font-medium text-black"
                >
                  描述/备注（可选）
                </label>
                <textarea
                  id="description"
                  rows={3}
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  className="min-h-[80px] w-full resize-y rounded-md border border-neutral-300 px-3 py-2 text-sm text-black outline-none focus:border-black"
                  placeholder="美国销售团队"
                />
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
                <span className="text-xs text-neutral-500">总链接名字</span>
                <span className="font-mono text-sm text-black">
                  {deletingLink.code}
                </span>
              </div>
              <div className="flex items-center justify-between gap-4">
                <span className="text-xs text-neutral-500">描述</span>
                <span className="text-sm text-black">
                  {deletingLink.description || '—'}
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
    </div>
  )
}

'use client'

import Link from 'next/link'
import { useEffect, useState, type FormEvent } from 'react'

type LinkItem = {
  id: string
  code: string
  whatsapp_number: string
  description: string
  created_at: string
}

// 临时模拟数据：网络恢复后替换为真实数据库查询
// created_at 使用固定字符串，避免服务端与客户端渲染结果不一致（水合错误）
const initialLinks: LinkItem[] = [
  {
    id: '1',
    code: 'demo1',
    whatsapp_number: '8613800138000',
    description: '测试客服',
    created_at: '2026-10-07 15:20:00',
  },
  {
    id: '2',
    code: 'demo2',
    whatsapp_number: '8613900139000',
    description: '美国销售团队',
    created_at: '2026-10-07 15:25:00',
  },
]

// 固定格式的时间字符串：YYYY-MM-DD HH:mm:ss
function formatDateTime(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return value
  }
  return date.toISOString().slice(0, 19).replace('T', ' ')
}

export default function LinksPage() {
  const [links, setLinks] = useState<LinkItem[]>(initialLinks)
  const [copiedCode, setCopiedCode] = useState<string | null>(null)

  // 仅在客户端挂载后才渲染时间，避免 SSR 与客户端时间不一致
  const [mounted, setMounted] = useState(false)

  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [whatsappNumber, setWhatsappNumber] = useState('')
  const [description, setDescription] = useState('')
  const [code, setCode] = useState('')

  // 删除确认弹窗：保存待删除的记录，null 表示未打开
  const [deletingLink, setDeletingLink] = useState<LinkItem | null>(null)

  useEffect(() => {
    setMounted(true)
  }, [])

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

  function openModal() {
    setEditingId(null)
    setWhatsappNumber('')
    setDescription('')
    setCode('')
    setIsModalOpen(true)
  }

  function openEditModal(link: LinkItem) {
    setEditingId(link.id)
    setWhatsappNumber(link.whatsapp_number)
    setDescription(link.description)
    setCode(link.code)
    setIsModalOpen(true)
  }

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

  // 确认删除：从内存状态中移除该记录，并关闭弹窗
  function confirmDelete() {
    if (!deletingLink) {
      return
    }
    setLinks((prev) => prev.filter((item) => item.id !== deletingLink.id))
    setDeletingLink(null)
  }

  function handleSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    // 临时：不请求数据库，仅操作内存状态
    if (editingId) {
      // 编辑模式：更新原数组里对应 id 的记录，不新增
      setLinks((prev) =>
        prev.map((item) =>
          item.id === editingId
            ? {
                ...item,
                code: code.trim() || item.code,
                whatsapp_number: whatsappNumber.trim(),
                description: description.trim(),
              }
            : item,
        ),
      )
    } else {
      // 新建模式：追加新记录
      setLinks((prev) => [
        ...prev,
        {
          id: Date.now().toString(),
          code: code.trim() || `link${Date.now()}`,
          whatsapp_number: whatsappNumber.trim(),
          description: description.trim(),
          created_at: formatDateTime(new Date().toISOString()),
        },
      ])
    }

    closeModal()
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">短链接</h1>
          <p className="text-sm text-neutral-600">管理你的短链接</p>
        </div>
        <button
          type="button"
          onClick={openModal}
          className="rounded-md bg-black px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-neutral-800"
        >
          创建短链接
        </button>
      </div>

      <div className="overflow-x-auto rounded-md border border-neutral-200">
        <table className="w-full border-collapse text-left text-sm">
          <thead className="bg-neutral-50">
            <tr>
              <th className="border-b border-neutral-200 px-4 py-3 font-medium text-neutral-700">
                短链接名字
              </th>
              <th className="border-b border-neutral-200 px-4 py-3 font-medium text-neutral-700">
                WhatsApp 号码
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
                    href={`/links/${link.code}`}
                    className="text-black underline-offset-4 transition-colors hover:text-blue-600 hover:underline"
                  >
                    {link.code}
                  </Link>
                </td>
                <td className="border-b border-neutral-200 px-4 py-3 font-mono text-neutral-700">
                  {link.whatsapp_number}
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
              {editingId ? '编辑短链接' : '创建短链接'}
            </h2>
            <p className="mt-1 text-sm text-neutral-600">
              {editingId
                ? '修改短链接名字、WhatsApp 号码与描述'
                : '填写短链接名字与 WhatsApp 号码，可选描述'}
            </p>

            <form onSubmit={handleSave} className="mt-4 space-y-4">
              <div className="space-y-1">
                <label
                  htmlFor="code"
                  className="block text-sm font-medium text-black"
                >
                  短链接名字
                </label>
                <input
                  id="code"
                  type="text"
                  required
                  value={code}
                  onChange={(event) => setCode(event.target.value)}
                  className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm text-black outline-none focus:border-black"
                  placeholder="demo1"
                />
                <p className="text-xs text-neutral-500">
                  建议使用英文或数字，将作为短链接路径
                </p>
              </div>

              <div className="space-y-1">
                <label
                  htmlFor="whatsapp_number"
                  className="block text-sm font-medium text-black"
                >
                  WhatsApp 号码
                </label>
                <input
                  id="whatsapp_number"
                  type="tel"
                  required
                  value={whatsappNumber}
                  onChange={(event) => setWhatsappNumber(event.target.value)}
                  className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm text-black outline-none focus:border-black"
                  placeholder="8613800138000"
                />
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
                  className="rounded-md bg-black px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-neutral-800"
                >
                  保存
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
                <span className="text-xs text-neutral-500">短链接名字</span>
                <span className="font-mono text-sm text-black">
                  {deletingLink.code}
                </span>
              </div>
              <div className="flex items-center justify-between gap-4">
                <span className="text-xs text-neutral-500">WhatsApp 号码</span>
                <span className="font-mono text-sm text-black">
                  {deletingLink.whatsapp_number}
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
                className="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-red-700"
              >
                确认删除
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

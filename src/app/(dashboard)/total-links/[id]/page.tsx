'use client'

import Link from 'next/link'
import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { createClient } from '@/lib/supabase/client'

type TotalLinkRow = {
  id: string
  code: string
  description: string | null
  created_at: string
}

type ShortLinkOption = {
  id: string
  code: string
  description: string | null
}

type TotalLinkItem = {
  id: string
  total_link_id: string
  short_link_id: string
  weight: number
  created_at: string
  // 关联查询出来的短链接信息
  short_link: ShortLinkOption | null
}

export default function TotalLinkDetailPage() {
  const [code, setCode] = useState('')
  const [link, setLink] = useState<TotalLinkRow | null>(null)
  const [items, setItems] = useState<TotalLinkItem[]>([])
  const [shortLinks, setShortLinks] = useState<ShortLinkOption[]>([])
  const [loading, setLoading] = useState(true)

  // 权重调整中的记录 id 集合，用于禁用按钮
  const [updatingId, setUpdatingId] = useState<string | null>(null)

  const [isModalOpen, setIsModalOpen] = useState(false)
  const [selectedShortLinkId, setSelectedShortLinkId] = useState('')
  const [newWeight, setNewWeight] = useState(1)
  const [saving, setSaving] = useState(false)

  const [deletingId, setDeletingId] = useState<string | null>(null)

  // 从 URL 路径中解析总链接 code
  useEffect(() => {
    const segments = window.location.pathname.split('/').filter(Boolean)
    const last = segments[segments.length - 1]
    setCode(decodeURIComponent(last ?? ''))
  }, [])

  // 加载总链接信息、子链接项、以及可选的短链接列表
  const loadData = useCallback(async (linkCode: string) => {
    if (!linkCode) {
      return
    }

    setLoading(true)
    const supabase = createClient()

    // 1. 查询总链接
    const { data: linkData, error: linkError } = await supabase
      .from('total_links')
      .select('id, code, description, created_at')
      .eq('code', linkCode)
      .maybeSingle()

    if (linkError) {
      console.log('查询总链接失败：', linkError)
    }

    if (!linkData) {
      setLink(null)
      setItems([])
      setLoading(false)
      return
    }

    setLink(linkData)

    // 2. 查询该总链接下的子链接项（关联短链接信息）
    const { data: itemData, error: itemError } = await supabase
      .from('total_link_items')
      .select(
        'id, total_link_id, short_link_id, weight, created_at, short_link:links (id, code, description)',
      )
      .eq('total_link_id', linkData.id)
      .order('created_at', { ascending: true })

    if (itemError) {
      console.log('查询子链接失败：', itemError)
      setItems([])
    } else {
      setItems((itemData as unknown as TotalLinkItem[]) ?? [])
    }

    // 3. 查询所有可选的短链接
    const { data: shortData, error: shortError } = await supabase
      .from('links')
      .select('id, code, description')
      .order('created_at', { ascending: false })

    if (shortError) {
      console.log('查询短链接列表失败：', shortError)
      setShortLinks([])
    } else {
      setShortLinks(shortData ?? [])
    }

    setLoading(false)
  }, [])

  useEffect(() => {
    if (code) {
      loadData(code)
    }
  }, [code, loadData])

  function openModal() {
    setSelectedShortLinkId('')
    setNewWeight(1)
    setIsModalOpen(true)
  }

  function closeModal() {
    setIsModalOpen(false)
  }

  // 添加子链接项
  async function handleAddItem(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!link || !selectedShortLinkId) {
      return
    }

    setSaving(true)
    const supabase = createClient()

    const { data, error } = await supabase
      .from('total_link_items')
      .insert({
        total_link_id: link.id,
        short_link_id: selectedShortLinkId,
        weight: newWeight,
      })
      .select(
        'id, total_link_id, short_link_id, weight, created_at, short_link:links (id, code, description)',
      )
      .single()

    if (error) {
      console.log('添加子链接失败：', error)
      setSaving(false)
      return
    }

    setItems((prev) => [...prev, data as unknown as TotalLinkItem])
    setSaving(false)
    closeModal()
  }

  // 调整权重：delta 为 +1 或 -1，最小为 0
  async function adjustWeight(item: TotalLinkItem, delta: number) {
    const nextWeight = Math.max(0, item.weight + delta)
    if (nextWeight === item.weight) {
      return
    }

    setUpdatingId(item.id)
    const supabase = createClient()

    const { error } = await supabase
      .from('total_link_items')
      .update({ weight: nextWeight })
      .eq('id', item.id)

    if (error) {
      console.log('更新权重失败：', error)
      setUpdatingId(null)
      return
    }

    setItems((prev) =>
      prev.map((row) =>
        row.id === item.id ? { ...row, weight: nextWeight } : row,
      ),
    )
    setUpdatingId(null)
  }

  // 删除子链接项
  async function handleDeleteItem(itemId: string) {
    setDeletingId(itemId)
    const supabase = createClient()

    const { error } = await supabase
      .from('total_link_items')
      .delete()
      .eq('id', itemId)

    if (error) {
      console.log('删除子链接失败：', error)
      setDeletingId(null)
      return
    }

    setItems((prev) => prev.filter((row) => row.id !== itemId))
    setDeletingId(null)
  }

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/total-links"
          className="text-sm text-neutral-600 transition-colors hover:text-black"
        >
          ← 返回总链接列表
        </Link>
      </div>

      {loading ? (
        <div className="rounded-md border border-neutral-200 px-4 py-8 text-center text-sm text-neutral-500">
          加载中...
        </div>
      ) : !link ? (
        <div className="rounded-md border border-neutral-200 px-4 py-8 text-center text-sm text-neutral-500">
          未找到该总链接。
        </div>
      ) : (
        <>
          {/* 总链接基本信息 */}
          <div className="rounded-md border border-neutral-200 p-6">
            <h1 className="text-2xl font-semibold tracking-tight">
              {link.code}
            </h1>
            <dl className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <dt className="text-xs text-neutral-500">总链接名字</dt>
                <dd className="mt-1 font-mono text-sm text-black">
                  {link.code}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-neutral-500">描述</dt>
                <dd className="mt-1 text-sm text-black">
                  {link.description || '—'}
                </dd>
              </div>
            </dl>
          </div>

          {/* 子链接（权重）管理面板 */}
          <div className="rounded-md border border-neutral-200 p-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold tracking-tight">
                  子链接（权重）
                </h2>
                <p className="text-sm text-neutral-600">
                  添加短链接并设置权重，权重越高被选中的概率越大
                </p>
              </div>
              <button
                type="button"
                onClick={openModal}
                className="rounded-md bg-black px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-neutral-800"
              >
                添加子链接
              </button>
            </div>

            <div className="mt-4 space-y-3">
              {items.map((item) => (
                <div
                  key={item.id}
                  className="flex flex-wrap items-center justify-between gap-4 rounded-md border border-neutral-200 px-4 py-3"
                >
                  <div className="min-w-0">
                    <div className="font-mono text-sm text-black">
                      {item.short_link?.code ?? item.short_link_id}
                    </div>
                    <div className="text-xs text-neutral-500">
                      {item.short_link?.description || '—'}
                    </div>
                  </div>

                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-neutral-500">权重</span>
                      <button
                        type="button"
                        onClick={() => adjustWeight(item, -1)}
                        disabled={updatingId === item.id || item.weight <= 0}
                        className="flex h-7 w-7 items-center justify-center rounded-md border border-neutral-300 text-sm font-medium text-black transition-colors hover:bg-neutral-100 disabled:opacity-40"
                      >
                        −
                      </button>
                      <span className="w-8 text-center text-sm font-medium text-black">
                        {item.weight}
                      </span>
                      <button
                        type="button"
                        onClick={() => adjustWeight(item, 1)}
                        disabled={updatingId === item.id}
                        className="flex h-7 w-7 items-center justify-center rounded-md border border-neutral-300 text-sm font-medium text-black transition-colors hover:bg-neutral-100 disabled:opacity-40"
                      >
                        +
                      </button>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleDeleteItem(item.id)}
                      disabled={deletingId === item.id}
                      className="rounded-md px-2 py-1 text-xs font-medium text-red-600 transition-colors hover:bg-red-50 disabled:opacity-50"
                    >
                      {deletingId === item.id ? '删除中...' : '删除'}
                    </button>
                  </div>
                </div>
              ))}

              {items.length === 0 && (
                <div className="rounded-md border border-dashed border-neutral-300 px-4 py-8 text-center text-sm text-neutral-500">
                  暂无子链接，点击右上角「添加子链接」开始。
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {isModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={closeModal}
        >
          <div
            className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl"
            onClick={(event) => event.stopPropagation()}
          >
            <h2 className="text-lg font-semibold tracking-tight">添加子链接</h2>
            <p className="mt-1 text-sm text-neutral-600">
              选择短链接并设置初始权重
            </p>

            <form onSubmit={handleAddItem} className="mt-4 space-y-4">
              <div className="space-y-1">
                <label
                  htmlFor="shortLink"
                  className="block text-sm font-medium text-black"
                >
                  短链接
                </label>
                <select
                  id="shortLink"
                  required
                  value={selectedShortLinkId}
                  onChange={(event) => setSelectedShortLinkId(event.target.value)}
                  className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm text-black outline-none focus:border-black"
                >
                  <option value="">请选择短链接</option>
                  {shortLinks.map((option) => (
                    <option key={option.id} value={option.id}>
                      {option.code}
                      {option.description ? `（${option.description}）` : ''}
                    </option>
                  ))}
                </select>
                {shortLinks.length === 0 && (
                  <p className="text-xs text-neutral-500">
                    暂无可用短链接，请先到「短链接」页面创建。
                  </p>
                )}
              </div>

              <div className="space-y-1">
                <label
                  htmlFor="weight"
                  className="block text-sm font-medium text-black"
                >
                  初始权重
                </label>
                <input
                  id="weight"
                  type="number"
                  min={0}
                  value={newWeight}
                  onChange={(event) =>
                    setNewWeight(Math.max(0, Number(event.target.value) || 0))
                  }
                  className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm text-black outline-none focus:border-black"
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
                  disabled={saving || !selectedShortLinkId}
                  className="rounded-md bg-black px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-neutral-800 disabled:opacity-50"
                >
                  {saving ? '保存中...' : '保存'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

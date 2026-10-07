'use client'

import Link from 'next/link'
import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { createClient } from '@/lib/supabase/client'

// 总链接（links 表）
type LinkRow = {
  id: string
  code: string
  whatsapp_number: string | null
  description: string | null
  created_at: string
}

// 子链接 / 分流规则（routing_rules 表）
type RoutingRule = {
  id: string
  link_id: string
  country: string
  whatsapp_number: string
  created_at: string
}

// 可选的国家/地区（存国家代码，例如 CN、US）
const countryOptions = [
  { value: 'CN', label: '中国 (CN)' },
  { value: 'US', label: '美国 (US)' },
  { value: 'IN', label: '印度 (IN)' },
  { value: 'BR', label: '巴西 (BR)' },
  { value: 'GB', label: '英国 (GB)' },
  { value: 'OTHER', label: '其他 (OTHER)' },
] as const

export default function LinkDetailPage() {
  // 纯前端：在客户端从 URL 中安全获取 code，避免构建时静态预渲染报错
  const [code, setCode] = useState<string | null>(null)

  const [link, setLink] = useState<LinkRow | null>(null)
  const [rules, setRules] = useState<RoutingRule[]>([])
  const [loading, setLoading] = useState(true)

  // 添加/编辑子链接弹窗
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingRuleId, setEditingRuleId] = useState<string | null>(null)
  const [newCountry, setNewCountry] = useState<string>(countryOptions[0].value)
  const [newNumber, setNewNumber] = useState('')
  const [saving, setSaving] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  // 从 URL 中解析 code
  useEffect(() => {
    const segments = window.location.pathname.split('/').filter(Boolean)
    const last = segments[segments.length - 1] ?? ''
    setCode(decodeURIComponent(last))
  }, [])

  // 查询总链接基本信息 + 该总链接下的所有分流规则
  const loadData = useCallback(async (linkCode: string) => {
    setLoading(true)
    const supabase = createClient()

    // 1) 查询总链接
    const { data: linkData, error: linkError } = await supabase
      .from('links')
      .select('id, code, whatsapp_number, description, created_at')
      .eq('code', linkCode)
      .maybeSingle()

    if (linkError) {
      console.log('查询总链接失败：', linkError)
      setLink(null)
      setRules([])
      setLoading(false)
      return
    }

    if (!linkData) {
      setLink(null)
      setRules([])
      setLoading(false)
      return
    }

    setLink(linkData)

    // 2) 查询属于该总链接的所有子链接（分流规则）
    const { data: rulesData, error: rulesError } = await supabase
      .from('routing_rules')
      .select('id, link_id, country, whatsapp_number, created_at')
      .eq('link_id', linkData.id)
      .order('created_at', { ascending: true })

    if (rulesError) {
      console.log('查询分流规则失败：', rulesError)
      setRules([])
    } else {
      setRules(rulesData ?? [])
    }

    setLoading(false)
  }, [])

  useEffect(() => {
    if (code) {
      loadData(code)
    }
  }, [code, loadData])

  function openModal() {
    setEditingRuleId(null)
    setNewCountry(countryOptions[0].value)
    setNewNumber('')
    setIsModalOpen(true)
  }

  function openEditModal(rule: RoutingRule) {
    setEditingRuleId(rule.id)
    setNewCountry(rule.country)
    setNewNumber(rule.whatsapp_number)
    setIsModalOpen(true)
  }

  function closeModal() {
    setIsModalOpen(false)
    setEditingRuleId(null)
  }

  // 保存子链接：新建写入 / 编辑更新 routing_rules 表
  async function handleSaveRule(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!link) {
      return
    }

    const number = newNumber.trim()
    if (!number) {
      return
    }

    setSaving(true)
    const supabase = createClient()

    if (editingRuleId) {
      // 编辑模式：更新对应规则
      const { data, error } = await supabase
        .from('routing_rules')
        .update({
          country: newCountry,
          whatsapp_number: number,
        })
        .eq('id', editingRuleId)
        .select('id, link_id, country, whatsapp_number, created_at')
        .single()

      if (error) {
        console.log('更新分流规则失败：', error)
        setSaving(false)
        return
      }

      setRules((prev) =>
        prev.map((rule) => (rule.id === editingRuleId ? data : rule)),
      )
    } else {
      // 新建模式：写入数据库
      const { data, error } = await supabase
        .from('routing_rules')
        .insert({
          link_id: link.id,
          country: newCountry,
          whatsapp_number: number,
        })
        .select('id, link_id, country, whatsapp_number, created_at')
        .single()

      if (error) {
        console.log('添加分流规则失败：', error)
        setSaving(false)
        return
      }

      setRules((prev) => [...prev, data])
    }

    setSaving(false)
    closeModal()
  }

  // 删除子链接：从 routing_rules 表删除
  async function handleDeleteRule(ruleId: string) {
    setDeletingId(ruleId)
    const supabase = createClient()

    const { error } = await supabase
      .from('routing_rules')
      .delete()
      .eq('id', ruleId)

    if (error) {
      console.log('删除分流规则失败：', error)
      setDeletingId(null)
      return
    }

    setRules((prev) => prev.filter((rule) => rule.id !== ruleId))
    setDeletingId(null)
  }

  if (code === null || loading) {
    return <div className="text-sm text-neutral-500">加载中...</div>
  }

  if (!link) {
    return (
      <div className="space-y-6">
        <div className="rounded-md border border-neutral-200 bg-white p-8 text-center">
          <h1 className="text-lg font-semibold tracking-tight">短链接不存在</h1>
          <p className="mt-1 text-sm text-neutral-600">
            找不到名为「{code}」的短链接，它可能已被删除。
          </p>
          <Link
            href="/links"
            className="mt-4 inline-block rounded-md bg-black px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-neutral-800"
          >
            返回短链接列表
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/links"
          className="text-sm text-neutral-600 transition-colors hover:text-black"
        >
          ← 返回列表
        </Link>
      </div>

      {/* 总链接信息 */}
      <div className="rounded-md border border-neutral-200 bg-white p-6">
        <h1 className="font-mono text-2xl font-semibold tracking-tight">
          {link.code}
        </h1>

        <dl className="mt-4 grid gap-4 sm:grid-cols-2">
          <div>
            <dt className="text-xs text-neutral-500">总链接名字</dt>
            <dd className="mt-1 font-mono text-sm text-black">{link.code}</dd>
          </div>
          <div className="sm:col-span-2">
            <dt className="text-xs text-neutral-500">描述</dt>
            <dd className="mt-1 text-sm text-neutral-700">
              {link.description || '—'}
            </dd>
          </div>
        </dl>
      </div>

      {/* 子链接（分流规则）管理面板 */}
      <div className="rounded-md border border-neutral-200 bg-white p-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold tracking-tight">
              子链接（分流规则）
            </h2>
            <p className="mt-1 text-sm text-neutral-600">
              按访客所在国家/地区跳转到不同的 WhatsApp 号码
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
          {rules.map((rule) => (
            <div
              key={rule.id}
              className="flex flex-col gap-3 rounded-md border border-neutral-200 p-4 sm:flex-row sm:items-center"
            >
              <div className="sm:w-40">
                <span className="block text-xs text-neutral-500">
                  国家/地区
                </span>
                <p className="mt-1 font-mono text-sm text-black">
                  {rule.country}
                </p>
              </div>

              <div className="flex-1">
                <span className="block text-xs text-neutral-500">
                  跳转的 WhatsApp 号码
                </span>
                <p className="mt-1 font-mono text-sm text-black">
                  {rule.whatsapp_number}
                </p>
              </div>

              <button
                type="button"
                onClick={() => openEditModal(rule)}
                className="self-end rounded-md px-2 py-1 text-xs font-medium text-blue-600 transition-colors hover:bg-blue-50 sm:self-center"
              >
                编辑
              </button>

              <button
                type="button"
                onClick={() => handleDeleteRule(rule.id)}
                disabled={deletingId === rule.id}
                className="self-end rounded-md px-2 py-1 text-xs font-medium text-red-600 transition-colors hover:bg-red-50 disabled:opacity-50 sm:self-center"
              >
                {deletingId === rule.id ? '删除中...' : '删除'}
              </button>
            </div>
          ))}

          {rules.length === 0 && (
            <p className="rounded-md border border-dashed border-neutral-300 p-4 text-center text-sm text-neutral-500">
              暂无子链接，点击右上角「添加子链接」开始配置。
            </p>
          )}
        </div>
      </div>

      {/* 添加/编辑子链接弹窗 */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-md bg-white p-6 shadow-lg">
            <h3 className="text-lg font-semibold tracking-tight">
              {editingRuleId ? '编辑子链接' : '添加子链接'}
            </h3>
            <p className="mt-1 text-sm text-neutral-600">
              选择国家/地区并填写对应的 WhatsApp 号码
            </p>

            <form onSubmit={handleSaveRule} className="mt-4 space-y-4">
              <div className="space-y-1">
                <label
                  htmlFor="new-country"
                  className="block text-sm font-medium text-black"
                >
                  国家/地区
                </label>
                <select
                  id="new-country"
                  value={newCountry}
                  onChange={(event) => setNewCountry(event.target.value)}
                  className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm text-black outline-none focus:border-black"
                >
                  {countryOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label
                  htmlFor="new-number"
                  className="block text-sm font-medium text-black"
                >
                  跳转的 WhatsApp 号码
                </label>
                <input
                  id="new-number"
                  type="tel"
                  required
                  value={newNumber}
                  onChange={(event) => setNewNumber(event.target.value)}
                  placeholder="8613800138000"
                  className="w-full rounded-md border border-neutral-300 px-3 py-2 font-mono text-sm text-black outline-none focus:border-black"
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
    </div>
  )
}

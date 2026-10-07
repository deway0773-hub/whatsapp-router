'use client'

export const dynamic = 'force-dynamic'

import Link from 'next/link'
import { useParams } from 'next/navigation'
import { useState } from 'react'

// 临时模拟数据：网络恢复后替换为真实数据库查询
const mockLinks: Record<
  string,
  { code: string; whatsapp_number: string; description: string }
> = {
  demo1: {
    code: 'demo1',
    whatsapp_number: '8613800138000',
    description: '测试客服',
  },
  demo2: {
    code: 'demo2',
    whatsapp_number: '8613900139000',
    description: '美国销售团队',
  },
}

// 可选的国家/地区
const countryOptions = ['中国', '美国', '印度', '巴西', '其他'] as const

type RoutingRule = {
  id: string
  country: string
  whatsapp_number: string
}

// 临时模拟数据：已有的分流规则
const initialRules: Record<string, RoutingRule[]> = {
  demo1: [
    { id: 'r1', country: '中国', whatsapp_number: '8613800138001' },
    { id: 'r2', country: '美国', whatsapp_number: '8613800138002' },
  ],
  demo2: [
    { id: 'r1', country: '巴西', whatsapp_number: '8613900139001' },
  ],
}

export default function LinkDetailPage() {
  const params = useParams<{ id: string }>()
  const id = typeof params?.id === 'string' ? decodeURIComponent(params.id) : ''
  const link = mockLinks[id]

  const [rules, setRules] = useState<RoutingRule[]>(initialRules[id] ?? [])
  const [saved, setSaved] = useState(false)

  if (!link) {
    return (
      <div className="space-y-6">
        <div className="rounded-md border border-neutral-200 bg-white p-8 text-center">
          <h1 className="text-lg font-semibold tracking-tight">短链接不存在</h1>
          <p className="mt-1 text-sm text-neutral-600">
            找不到名为「{id}」的短链接，它可能已被删除。
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

  function addRule() {
    setSaved(false)
    setRules((prev) => [
      ...prev,
      {
        id: Date.now().toString(),
        country: '中国',
        whatsapp_number: '',
      },
    ])
  }

  function updateRule(
    ruleId: string,
    field: 'country' | 'whatsapp_number',
    value: string,
  ) {
    setSaved(false)
    setRules((prev) =>
      prev.map((rule) =>
        rule.id === ruleId ? { ...rule, [field]: value } : rule,
      ),
    )
  }

  function removeRule(ruleId: string) {
    setSaved(false)
    setRules((prev) => prev.filter((rule) => rule.id !== ruleId))
  }

  function handleSave() {
    // 临时：不请求数据库，仅打印当前规则
    console.log('分流规则：', rules)
    setSaved(true)
  }

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/links"
          className="text-sm text-neutral-600 transition-colors hover:text-black"
        >
          ← 返回短链接列表
        </Link>
      </div>

      <div className="rounded-md border border-neutral-200 bg-white p-6">
        <h1 className="font-mono text-2xl font-semibold tracking-tight">
          {link.code}
        </h1>
        <p className="mt-1 text-sm text-neutral-600">
          {link.description || '暂无描述'}
        </p>

        <dl className="mt-4 grid gap-4 sm:grid-cols-2">
          <div>
            <dt className="text-xs text-neutral-500">短链接名字</dt>
            <dd className="mt-1 font-mono text-sm text-black">{link.code}</dd>
          </div>
          <div>
            <dt className="text-xs text-neutral-500">默认 WhatsApp 号码</dt>
            <dd className="mt-1 font-mono text-sm text-black">
              {link.whatsapp_number}
            </dd>
          </div>
          <div className="sm:col-span-2">
            <dt className="text-xs text-neutral-500">描述</dt>
            <dd className="mt-1 text-sm text-neutral-700">
              {link.description || '—'}
            </dd>
          </div>
        </dl>
      </div>

      <div className="rounded-md border border-neutral-200 bg-white p-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold tracking-tight">智能分流规则</h2>
            <p className="mt-1 text-sm text-neutral-600">
              按访客所在国家/地区跳转到不同的 WhatsApp 号码
            </p>
          </div>
          <button
            type="button"
            onClick={addRule}
            className="rounded-md bg-black px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-neutral-800"
          >
            添加国家/地区规则
          </button>
        </div>

        <div className="mt-4 space-y-3">
          {/* 默认规则：不可删除 */}
          <div className="flex flex-col gap-3 rounded-md border border-neutral-200 bg-neutral-50 p-4 sm:flex-row sm:items-center">
            <div className="flex-1">
              <span className="text-xs text-neutral-500">默认规则</span>
              <p className="mt-1 text-sm text-black">
                所有其他地区 → 默认号码
              </p>
            </div>
            <div className="sm:w-56">
              <input
                type="tel"
                value={link.whatsapp_number}
                readOnly
                className="w-full rounded-md border border-neutral-300 bg-neutral-100 px-3 py-2 font-mono text-sm text-neutral-500 outline-none"
              />
            </div>
          </div>

          {rules.map((rule) => (
            <div
              key={rule.id}
              className="flex flex-col gap-3 rounded-md border border-neutral-200 p-4 sm:flex-row sm:items-center"
            >
              <div className="sm:w-40">
                <label
                  htmlFor={`country-${rule.id}`}
                  className="block text-xs text-neutral-500"
                >
                  国家/地区
                </label>
                <select
                  id={`country-${rule.id}`}
                  value={rule.country}
                  onChange={(event) =>
                    updateRule(rule.id, 'country', event.target.value)
                  }
                  className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-2 text-sm text-black outline-none focus:border-black"
                >
                  {countryOptions.map((country) => (
                    <option key={country} value={country}>
                      {country}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex-1">
                <label
                  htmlFor={`number-${rule.id}`}
                  className="block text-xs text-neutral-500"
                >
                  跳转的 WhatsApp 号码
                </label>
                <input
                  id={`number-${rule.id}`}
                  type="tel"
                  value={rule.whatsapp_number}
                  onChange={(event) =>
                    updateRule(rule.id, 'whatsapp_number', event.target.value)
                  }
                  placeholder="8613800138000"
                  className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-2 font-mono text-sm text-black outline-none focus:border-black"
                />
              </div>

              <button
                type="button"
                onClick={() => removeRule(rule.id)}
                className="self-end rounded-md px-2 py-1 text-xs font-medium text-red-600 transition-colors hover:bg-red-50 sm:self-center"
              >
                删除
              </button>
            </div>
          ))}

          {rules.length === 0 && (
            <p className="rounded-md border border-dashed border-neutral-300 p-4 text-center text-sm text-neutral-500">
              暂无自定义规则，点击右上角「添加国家/地区规则」开始配置。
            </p>
          )}
        </div>

        <div className="mt-6 flex items-center justify-end gap-3">
          {saved && (
            <span className="rounded-md bg-green-50 px-3 py-1.5 text-sm font-medium text-green-700">
              保存成功
            </span>
          )}
          <button
            type="button"
            onClick={handleSave}
            className="rounded-md bg-black px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-neutral-800"
          >
            保存分流规则
          </button>
        </div>
      </div>
    </div>
  )
}

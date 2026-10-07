'use client'

import { useState, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { useLinks } from '@/context/links-context'

export default function NewLinkPage() {
  const router = useRouter()
  const { addLink } = useLinks()

  const [whatsappNumber, setWhatsappNumber] = useState('')
  const [description, setDescription] = useState('')
  const [code, setCode] = useState('')

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    // 临时：不请求数据库，仅把新记录加入内存状态
    const finalCode = code.trim() || `link${Date.now()}`
    addLink({
      code: finalCode,
      whatsapp_number: whatsappNumber.trim(),
      description: description.trim(),
    })

    // 临时：不持久化保存，直接跳回列表页
    router.push('/links')
  }

  function handleCancel() {
    router.push('/links')
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">创建短链接</h1>
        <p className="text-sm text-neutral-600">
          填写 WhatsApp 号码，可选描述与自定义短链接代码
        </p>
      </div>

      <form onSubmit={handleSubmit} className="max-w-lg space-y-4">
        <div className="space-y-1">
          <label
            htmlFor="whatsapp_number"
            className="block text-sm font-medium text-black"
          >
            WhatsApp 号码 (whatsapp_number)
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
            描述/备注 (description，可选)
          </label>
          <input
            id="description"
            type="text"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm text-black outline-none focus:border-black"
            placeholder="美国销售团队"
          />
        </div>

        <div className="space-y-1">
          <label htmlFor="code" className="block text-sm font-medium text-black">
            自定义短链接代码 (code，可选)
          </label>
          <input
            id="code"
            type="text"
            value={code}
            onChange={(event) => setCode(event.target.value)}
            className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm text-black outline-none focus:border-black"
            placeholder="demo1"
          />
        </div>

        <div className="flex gap-2 pt-2">
          <button
            type="submit"
            className="rounded-md bg-black px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-neutral-800"
          >
            提交
          </button>
          <button
            type="button"
            onClick={handleCancel}
            className="rounded-md border border-neutral-300 px-4 py-2 text-sm font-medium text-black transition-colors hover:bg-neutral-50"
          >
            取消
          </button>
        </div>
      </form>
    </div>
  )
}

'use client'

import { useState, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'

// 临时：离线验证 UI 时绕过 Supabase 认证
// import { createClient } from '@/lib/supabase/client'

export default function LoginPage() {
  const router = useRouter()
  // const supabase = createClient()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function handleSignIn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setLoading(true)
    setError(null)
    setMessage(null)

    // 临时：跳过 Supabase 登录，直接进入 dashboard
    router.push('/dashboard')
  }

  async function handleSignUp() {
    setLoading(true)
    setError(null)
    setMessage(null)

    // 临时：跳过 Supabase 注册，直接进入 dashboard
    router.push('/dashboard')
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-white px-6">
      <div className="w-full max-w-sm space-y-6">
        <div className="space-y-1 text-center">
          <h1 className="text-2xl font-semibold tracking-tight text-black">
            WhatsApp Smart Router
          </h1>
          <p className="text-sm text-neutral-600">登录或创建你的账号</p>
        </div>

        <form onSubmit={handleSignIn} className="space-y-4">
          <div className="space-y-1">
            <label
              htmlFor="email"
              className="block text-sm font-medium text-black"
            >
              Email
            </label>
            <input
              id="email"
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm text-black outline-none focus:border-black"
              placeholder="you@example.com"
            />
          </div>

          <div className="space-y-1">
            <label
              htmlFor="password"
              className="block text-sm font-medium text-black"
            >
              Password
            </label>
            <input
              id="password"
              type="password"
              required
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm text-black outline-none focus:border-black"
              placeholder="••••••••"
            />
          </div>

          {error ? (
            <p className="text-sm text-red-600" role="alert">
              {error}
            </p>
          ) : null}

          {message ? (
            <p className="text-sm text-emerald-600">{message}</p>
          ) : null}

          <div className="flex flex-col gap-2 pt-2">
            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-md bg-black px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-neutral-800 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading ? '处理中…' : '登录'}
            </button>
            <button
              type="button"
              onClick={handleSignUp}
              disabled={loading}
              className="w-full rounded-md border border-neutral-300 px-4 py-2 text-sm font-medium text-black transition-colors hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              注册
            </button>
          </div>
        </form>
      </div>
    </main>
  )
}

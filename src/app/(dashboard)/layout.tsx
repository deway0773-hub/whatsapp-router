import type { ReactNode } from 'react'
import Link from 'next/link'
import { LinksProvider } from '@/context/links-context'

const navItems = [
  { label: '仪表盘', href: '/dashboard' },
  { label: '短链接', href: '/links' },
  { label: '数据分析', href: '/analytics' },
  { label: '系统设置', href: '/settings' },
]

export default function DashboardLayout({
  children,
}: Readonly<{
  children: ReactNode
}>) {
  return (
    <LinksProvider>
      <div className="flex min-h-screen bg-white text-black">
      <aside className="hidden w-64 shrink-0 border-r border-neutral-200 md:flex md:flex-col">
        <div className="flex h-16 flex-col justify-center border-b border-neutral-200 px-6">
          <span className="text-sm font-semibold tracking-tight">
            WhatsApp Smart Router
          </span>
          <span className="text-xs text-neutral-500">智能分流系统</span>
        </div>
        <nav className="flex flex-1 flex-col gap-1 p-4">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="rounded-md px-3 py-2 text-sm font-medium text-neutral-700 transition-colors hover:bg-neutral-100 hover:text-black"
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </aside>

      <div className="flex flex-1 flex-col">
        <header className="flex h-16 items-center border-b border-neutral-200 px-6">
          <span className="text-sm font-medium text-neutral-600">
            WhatsApp Smart Router
          </span>
        </header>
        <main className="flex-1 p-6">{children}</main>
      </div>
      </div>
    </LinksProvider>
  )
}

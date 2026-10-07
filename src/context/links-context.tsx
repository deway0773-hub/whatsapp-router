'use client'

import { createContext, useContext, useState, type ReactNode } from 'react'

export type LinkItem = {
  code: string
  whatsapp_number: string
  description: string
  created_at: string
}

type LinksContextValue = {
  links: LinkItem[]
  addLink: (link: {
    code: string
    whatsapp_number: string
    description: string
  }) => void
}

const LinksContext = createContext<LinksContextValue | null>(null)

// 临时模拟数据：网络恢复后替换为真实数据库查询
const initialLinks: LinkItem[] = [
  {
    code: 'demo1',
    whatsapp_number: '8613800138000',
    description: '测试客服',
    created_at: new Date().toISOString(),
  },
  {
    code: 'demo2',
    whatsapp_number: '8613900139000',
    description: '美国销售团队',
    created_at: new Date().toISOString(),
  },
]

export function LinksProvider({ children }: { children: ReactNode }) {
  const [links, setLinks] = useState<LinkItem[]>(initialLinks)

  function addLink(link: {
    code: string
    whatsapp_number: string
    description: string
  }) {
    setLinks((prev) => [
      {
        code: link.code,
        whatsapp_number: link.whatsapp_number,
        description: link.description,
        created_at: new Date().toISOString(),
      },
      ...prev,
    ])
  }

  return (
    <LinksContext.Provider value={{ links, addLink }}>
      {children}
    </LinksContext.Provider>
  )
}

export function useLinks() {
  const context = useContext(LinksContext)
  if (!context) {
    throw new Error('useLinks 必须在 LinksProvider 内部使用')
  }
  return context
}

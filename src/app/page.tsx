import { redirect } from 'next/navigation'

// 临时：跳过登录，直接进入后台
// 恢复登录时，改回渲染登录入口页面即可
export default function HomePage() {
  redirect('/dashboard')
}


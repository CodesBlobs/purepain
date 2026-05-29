'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuthStore } from '@/store/auth'
import { Sidebar } from './Sidebar'
import type { User } from '@/types'

interface AppLayoutProps {
  children: React.ReactNode
  requiredRole?: User['account_type']
}

export function AppLayout({ children, requiredRole }: AppLayoutProps) {
  const router = useRouter()
  const { user } = useAuthStore()

  useEffect(() => {
    if (!user) {
      router.replace('/')
      return
    }
    if (requiredRole && user.account_type !== requiredRole) {
      router.replace(user.account_type === 'student' ? '/student/home' : '/parent/home')
    }
  }, [user, requiredRole, router])

  if (!user) return null

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar />
      <main className="flex-1 ml-64 p-8 max-w-[calc(100vw-256px)]">
        {children}
      </main>
    </div>
  )
}

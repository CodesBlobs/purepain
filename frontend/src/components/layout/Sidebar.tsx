'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import {
  Calculator,
  Trophy,
  ClipboardList,
  Home,
  FileText,
  Send,
  LayoutDashboard,
  LogOut,
  CheckSquare,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/store/auth'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'

const studentNav = [
  { href: '/student/home', label: 'Home', icon: Home },
  { href: '/student/practice', label: 'Practice', icon: Calculator },
  { href: '/student/challenge', label: 'Challenge', icon: Trophy },
  { href: '/student/assignments', label: 'Assignments', icon: ClipboardList },
  { href: '/student/completed', label: 'Completed Work', icon: CheckSquare },
]

const parentNav = [
  { href: '/parent/home', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/parent/questions', label: 'My Questions', icon: FileText },
  { href: '/parent/assign', label: 'Assign Work', icon: Send },
]

export function Sidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const { user, logout } = useAuthStore()

  if (!user) return null

  const navItems = user.account_type === 'student' ? studentNav : parentNav

  const handleLogout = () => {
    logout()
    router.push('/')
  }

  return (
    <aside className="w-64 bg-card border-r border-border flex flex-col fixed inset-y-0 left-0 z-20">
      {/* Logo */}
      <div className="flex items-center gap-2.5 px-5 py-5 border-b border-border">
        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-indigo-700 flex items-center justify-center shadow-md shadow-primary/30">
          <Calculator className="w-4 h-4 text-white" />
        </div>
        <span className="text-[17px] font-black tracking-tight text-foreground">PurePain</span>
      </div>

      {/* User */}
      <div className="mx-3 mt-3 mb-1 px-3 py-3 bg-muted/60 rounded-xl border border-border/60">
        <div className="text-sm font-bold text-foreground truncate">{user.name}</div>
        <div className="text-xs text-muted-foreground mt-0.5 capitalize">
          {user.account_type} account
        </div>
      </div>

      <Separator className="my-2 mx-3 w-auto" />

      {/* Nav */}
      <nav className="flex-1 px-3 space-y-0.5 overflow-y-auto">
        {navItems.map(({ href, label, icon: Icon }) => {
          const active = pathname === href
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                'flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-medium transition-all',
                active
                  ? 'bg-primary/10 text-primary font-semibold'
                  : 'text-muted-foreground hover:bg-accent hover:text-foreground'
              )}
            >
              <Icon className="w-4 h-4 flex-shrink-0" />
              {label}
            </Link>
          )
        })}
      </nav>

      {/* Sign out */}
      <div className="px-3 pb-4 mt-2 border-t border-border pt-3">
        <Button
          variant="ghost"
          size="sm"
          onClick={handleLogout}
          className="w-full justify-start gap-2.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
        >
          <LogOut className="w-4 h-4" />
          Sign Out
        </Button>
      </div>
    </aside>
  )
}

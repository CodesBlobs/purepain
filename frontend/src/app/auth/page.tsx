'use client'

import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Calculator, GraduationCap, Users } from 'lucide-react'
import { useAuthStore } from '@/store/auth'
import { api } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { cn } from '@/lib/utils'
import type { User } from '@/types'

type AccountType = 'student' | 'parent'

export default function AuthPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { user, setAuth } = useAuthStore()

  useEffect(() => {
    if (user) router.replace(user.account_type === 'student' ? '/student/home' : '/parent/home')
  }, [user, router])

  const initialTab = searchParams.get('tab') === 'register' ? 'register' : 'login'
  const initialRole = searchParams.get('role') === 'parent' ? 'parent' : 'student'

  const [loginError, setLoginError] = useState('')
  const [loginLoading, setLoginLoading] = useState(false)
  const [regError, setRegError] = useState('')
  const [regLoading, setRegLoading] = useState(false)
  const [accountType, setAccountType] = useState<AccountType>(initialRole)

  async function handleLogin(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoginError('')
    setLoginLoading(true)
    const fd = new FormData(e.currentTarget)
    try {
      const data = await api.post<{ token: string; user: User }>('/auth/login', {
        email: fd.get('email'),
        password: fd.get('password'),
      })
      setAuth(data.user, data.token)
    } catch (err) {
      setLoginError(err instanceof Error ? err.message : 'Login failed')
    } finally {
      setLoginLoading(false)
    }
  }

  async function handleRegister(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setRegError('')
    setRegLoading(true)
    const fd = new FormData(e.currentTarget)
    try {
      const data = await api.post<{ token: string; user: User }>('/auth/register', {
        name: fd.get('name'),
        email: fd.get('email'),
        password: fd.get('password'),
        account_type: accountType,
        grade_level: fd.get('grade') || null,
      })
      setAuth(data.user, data.token)
    } catch (err) {
      setRegError(err instanceof Error ? err.message : 'Registration failed')
    } finally {
      setRegLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-700 via-primary to-violet-600 p-6 relative overflow-hidden">
      {/* decorative orbs */}
      <div className="absolute w-[600px] h-[600px] rounded-full bg-white/5 -top-64 -right-64 pointer-events-none" />
      <div className="absolute w-[400px] h-[400px] rounded-full bg-white/4 -bottom-48 -left-32 pointer-events-none" />

      <div className="relative z-10 bg-card rounded-3xl shadow-2xl p-10 w-full max-w-[440px]">
        {/* Logo */}
        <div className="text-center mb-9">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary to-indigo-700 flex items-center justify-center mx-auto mb-4 shadow-lg shadow-primary/40">
            <Calculator className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-black tracking-tight text-foreground">PurePain</h1>
          <p className="text-sm text-muted-foreground mt-1 font-medium">Math practice that actually works</p>
        </div>

        <Tabs defaultValue={initialTab}>
          <TabsList className="w-full mb-7">
            <TabsTrigger value="login" className="flex-1">Sign In</TabsTrigger>
            <TabsTrigger value="register" className="flex-1">Create Account</TabsTrigger>
          </TabsList>

          {/* Login */}
          <TabsContent value="login">
            <form onSubmit={handleLogin} className="space-y-4">
              {loginError && (
                <div className="text-sm text-destructive bg-destructive/10 rounded-lg px-3 py-2.5">
                  {loginError}
                </div>
              )}
              <div className="space-y-1.5">
                <Label htmlFor="login-email">Email address</Label>
                <Input id="login-email" name="email" type="email" placeholder="you@example.com" required />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="login-password">Password</Label>
                <Input id="login-password" name="password" type="password" placeholder="••••••••" required />
              </div>
              <Button type="submit" className="w-full mt-2" size="lg" disabled={loginLoading}>
                {loginLoading ? 'Signing in…' : 'Sign In'}
              </Button>
            </form>
          </TabsContent>

          {/* Register */}
          <TabsContent value="register">
            <form onSubmit={handleRegister} className="space-y-4">
              {regError && (
                <div className="text-sm text-destructive bg-destructive/10 rounded-lg px-3 py-2.5">
                  {regError}
                </div>
              )}
              <div className="space-y-1.5">
                <Label htmlFor="reg-name">Full name</Label>
                <Input id="reg-name" name="name" placeholder="Your name" required />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="reg-email">Email address</Label>
                <Input id="reg-email" name="email" type="email" placeholder="you@example.com" required />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="reg-password">Password</Label>
                <Input id="reg-password" name="password" type="password" placeholder="At least 6 characters" required />
              </div>

              {/* Account type */}
              <div className="space-y-1.5">
                <Label>Account type</Label>
                <div className="grid grid-cols-2 gap-3">
                  {(['student', 'parent'] as AccountType[]).map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setAccountType(t)}
                      className={cn(
                        'flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all cursor-pointer',
                        accountType === t
                          ? 'border-primary bg-primary/8'
                          : 'border-border hover:border-primary/40 hover:bg-accent/40'
                      )}
                    >
                      <div
                        className={cn(
                          'w-10 h-10 rounded-xl flex items-center justify-center transition-all',
                          accountType === t ? 'bg-primary text-white' : 'bg-muted text-muted-foreground'
                        )}
                      >
                        {t === 'student' ? <GraduationCap className="w-5 h-5" /> : <Users className="w-5 h-5" />}
                      </div>
                      <span className="text-sm font-bold capitalize">{t}</span>
                      <span className="text-xs text-muted-foreground text-center leading-tight">
                        {t === 'student' ? 'Practice math problems' : 'Manage & assign work'}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              {accountType === 'student' && (
                <div className="space-y-1.5">
                  <Label htmlFor="reg-grade">Grade level</Label>
                  <select
                    id="reg-grade"
                    name="grade"
                    className="flex h-10 w-full rounded-lg border border-input bg-card px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  >
                    <option value="">Select grade…</option>
                    {Array.from({ length: 12 }, (_, i) => (
                      <option key={i + 1} value={i + 1}>Grade {i + 1}</option>
                    ))}
                  </select>
                </div>
              )}

              <Button type="submit" className="w-full mt-2" size="lg" disabled={regLoading}>
                {regLoading ? 'Creating account…' : 'Create Account'}
              </Button>
            </form>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}

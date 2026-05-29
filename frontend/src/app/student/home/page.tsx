'use client'

import { useQuery } from '@tanstack/react-query'
import { CheckCircle2, XCircle, ClipboardList, TrendingUp, Clock, BookOpen, ArrowRight } from 'lucide-react'
import Link from 'next/link'
import { api } from '@/lib/api'
import { useAuthStore } from '@/store/auth'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { timeAgo, capitalize } from '@/lib/utils'
import type { Assignment, Attempt, StudentStat } from '@/types'

interface DashboardData {
  assignments: Assignment[]
  stats: StudentStat
  recentAttempts: Attempt[]
  parents: { name: string }[]
}

export default function StudentHome() {
  const { user } = useAuthStore()

  const { data, isLoading } = useQuery<DashboardData>({
    queryKey: ['student-dashboard'],
    queryFn: () => api.get('/student/dashboard'),
  })

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  const stats = data?.stats ?? { total: 0, correct: 0 }
  const accuracy = stats.total > 0 ? Math.round((stats.correct / stats.total) * 100) : 0
  const pending = data?.assignments ?? []
  const recent = data?.recentAttempts ?? []

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-black text-foreground">Welcome back, {user?.name?.split(' ')[0]}</h1>
        <p className="text-muted-foreground mt-1">Here's how you're doing</p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="border-t-4 border-t-primary">
          <CardContent className="pt-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-muted-foreground font-medium">Total Attempts</p>
                <p className="text-3xl font-black mt-1">{stats.total}</p>
              </div>
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                <TrendingUp className="w-5 h-5 text-primary" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-t-4 border-t-emerald-500">
          <CardContent className="pt-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-muted-foreground font-medium">Correct Answers</p>
                <p className="text-3xl font-black mt-1">{stats.correct}</p>
              </div>
              <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center">
                <CheckCircle2 className="w-5 h-5 text-emerald-500" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-t-4 border-t-violet-500">
          <CardContent className="pt-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-muted-foreground font-medium">Accuracy</p>
                <p className="text-3xl font-black mt-1">{accuracy}%</p>
              </div>
              <div className="w-10 h-10 rounded-xl bg-violet-500/10 flex items-center justify-center">
                <BookOpen className="w-5 h-5 text-violet-500" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Pending assignments */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <ClipboardList className="w-4 h-4" />
              Pending Assignments
              {pending.length > 0 && (
                <Badge variant="secondary" className="ml-auto">{pending.length}</Badge>
              )}
              {pending.length > 0 && (
                <Link href="/student/assignments">
                  <Button variant="ghost" size="sm" className="gap-1 text-xs h-7 px-2">
                    View all <ArrowRight className="w-3 h-3" />
                  </Button>
                </Link>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {pending.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">
                No pending assignments — great work!
              </p>
            ) : (
              <ul className="space-y-2">
                {pending.slice(0, 5).map((a) => (
                  <li key={a.id}>
                    <Link href="/student/assignments" className="flex items-start gap-3 p-3 rounded-lg bg-muted/40 hover:bg-muted/70 transition-colors cursor-pointer">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium line-clamp-2">{a.question_text}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <Badge variant={a.difficulty as 'easy' | 'medium' | 'hard'} className="text-xs">
                            {capitalize(a.difficulty)}
                          </Badge>
                          <span className="text-xs text-muted-foreground">from {a.parent_name}</span>
                        </div>
                      </div>
                      <ArrowRight className="w-4 h-4 text-muted-foreground flex-shrink-0 mt-0.5" />
                    </Link>
                  </li>
                ))}
                {pending.length > 5 && (
                  <p className="text-xs text-muted-foreground text-center pt-1">
                    +{pending.length - 5} more
                  </p>
                )}
              </ul>
            )}
          </CardContent>
        </Card>

        {/* Recent activity */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Clock className="w-4 h-4" />
              Recent Activity
            </CardTitle>
          </CardHeader>
          <CardContent>
            {recent.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">
                No activity yet — start practicing!
              </p>
            ) : (
              <ul className="space-y-2">
                {recent.slice(0, 6).map((a, i) => (
                  <li key={i} className="flex items-center gap-3">
                    {a.is_correct ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                    ) : (
                      <XCircle className="w-4 h-4 text-destructive flex-shrink-0" />
                    )}
                    <span className="text-sm flex-1 line-clamp-1">{a.question_text}</span>
                    <span className="text-xs text-muted-foreground whitespace-nowrap">
                      {timeAgo(a.attempted_at)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Users, TrendingUp, CheckCircle2, ClipboardList, UserPlus, Trash2 } from 'lucide-react'
import { api } from '@/lib/api'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { initials } from '@/lib/utils'
import type { StudentCard } from '@/types'

interface DashboardData {
  students: StudentCard[]
  my_questions: unknown[]
}

export default function ParentHome() {
  const qc = useQueryClient()
  const [linkOpen, setLinkOpen] = useState(false)
  const [linkEmail, setLinkEmail] = useState('')
  const [linkError, setLinkError] = useState('')

  const { data, isLoading } = useQuery<DashboardData>({
    queryKey: ['parent-dashboard'],
    queryFn: () => api.get('/parent/dashboard'),
  })

  const linkMutation = useMutation({
    mutationFn: (email: string) => api.post('/parent/link-student', { email }),
    onSuccess: () => {
      setLinkOpen(false)
      setLinkEmail('')
      setLinkError('')
      qc.invalidateQueries({ queryKey: ['parent-dashboard'] })
    },
    onError: (err) => setLinkError(err instanceof Error ? err.message : 'Failed to link student'),
  })

  const unlinkMutation = useMutation({
    mutationFn: (studentId: number) => api.delete(`/parent/link-student/${studentId}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['parent-dashboard'] }),
  })

  const students = data?.students ?? []

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-foreground">Dashboard</h1>
          <p className="text-muted-foreground mt-1">Monitor your students' progress</p>
        </div>
        {students.length < 2 && (
          <Button onClick={() => setLinkOpen(true)} className="gap-2">
            <UserPlus className="w-4 h-4" />
            Link Student
          </Button>
        )}
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center h-48">
          <div className="w-7 h-7 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      ) : students.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <div className="w-14 h-14 rounded-2xl bg-muted flex items-center justify-center mx-auto mb-4">
              <Users className="w-7 h-7 text-muted-foreground" />
            </div>
            <p className="font-semibold">No students linked</p>
            <p className="text-sm text-muted-foreground mt-1 mb-4">
              Link a student account to start assigning work.
            </p>
            <Button onClick={() => setLinkOpen(true)} className="gap-2">
              <UserPlus className="w-4 h-4" />
              Link Student
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {students.map((s) => {
            const accuracy = s.total_attempts > 0
              ? Math.round((s.correct_count / s.total_attempts) * 100)
              : 0
            return (
              <Card key={s.id} className="hover:shadow-md transition-shadow">
                <CardHeader className="pb-4">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-primary to-indigo-700 flex items-center justify-center text-white font-bold text-sm shadow-md shadow-primary/30">
                        {initials(s.name)}
                      </div>
                      <div>
                        <CardTitle className="text-base">{s.name}</CardTitle>
                        <p className="text-xs text-muted-foreground">{s.email}</p>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-muted-foreground hover:text-destructive hover:bg-destructive/10 -mt-1 -mr-1"
                      onClick={() => {
                        if (confirm(`Unlink ${s.name}?`)) unlinkMutation.mutate(s.id)
                      }}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-3 gap-3">
                    <div className="text-center p-3 bg-muted/50 rounded-xl">
                      <div className="w-7 h-7 rounded-lg bg-amber-500/15 flex items-center justify-center mx-auto mb-1.5">
                        <ClipboardList className="w-3.5 h-3.5 text-amber-600" />
                      </div>
                      <p className="text-xl font-black">{s.pending_count}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">Pending</p>
                    </div>
                    <div className="text-center p-3 bg-muted/50 rounded-xl">
                      <div className="w-7 h-7 rounded-lg bg-emerald-500/15 flex items-center justify-center mx-auto mb-1.5">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                      </div>
                      <p className="text-xl font-black">{s.completed_count}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">Done</p>
                    </div>
                    <div className="text-center p-3 bg-muted/50 rounded-xl">
                      <div className="w-7 h-7 rounded-lg bg-primary/15 flex items-center justify-center mx-auto mb-1.5">
                        <TrendingUp className="w-3.5 h-3.5 text-primary" />
                      </div>
                      <p className="text-xl font-black">{accuracy}%</p>
                      <p className="text-xs text-muted-foreground mt-0.5">Accuracy</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      {/* Link student dialog */}
      <Dialog open={linkOpen} onOpenChange={setLinkOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Link a Student</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <p className="text-sm text-muted-foreground">
              Enter the student's email address to link their account (max 2 students).
            </p>
            {linkError && (
              <div className="text-sm text-destructive bg-destructive/10 rounded-lg px-3 py-2.5">
                {linkError}
              </div>
            )}
            <div className="space-y-1.5">
              <Label>Student email</Label>
              <Input
                type="email"
                placeholder="student@example.com"
                value={linkEmail}
                onChange={(e) => setLinkEmail(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && linkMutation.mutate(linkEmail)}
              />
            </div>
            <Button
              className="w-full"
              onClick={() => linkMutation.mutate(linkEmail)}
              disabled={linkMutation.isPending || !linkEmail}
            >
              {linkMutation.isPending ? 'Linking…' : 'Link Student'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

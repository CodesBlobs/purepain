'use client'

import { useQuery } from '@tanstack/react-query'
import { CheckCircle2, XCircle, Clock, ClipboardList } from 'lucide-react'
import { api } from '@/lib/api'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { MathText } from '@/components/math/MathText'
import { capitalize, timeAgo, cn } from '@/lib/utils'
import type { Difficulty } from '@/types'

interface AssignmentRow {
  id: number
  status: string
  assigned_at: string
  attempted_at: string | null
  question_id: number
  question_text: string
  type: string
  difficulty: string
  parent_name: string
  is_correct: number | null
  answer_given: string | null
}

interface Overview {
  pending: AssignmentRow[]
  completed: AssignmentRow[]
}

function EmptyState({ message }: { message: string }) {
  return (
    <Card>
      <CardContent className="py-16 text-center">
        <div className="w-14 h-14 rounded-2xl bg-muted flex items-center justify-center mx-auto mb-4">
          <ClipboardList className="w-7 h-7 text-muted-foreground" />
        </div>
        <p className="text-sm text-muted-foreground">{message}</p>
      </CardContent>
    </Card>
  )
}

function AssignmentCard({ row, showResult }: { row: AssignmentRow; showResult: boolean }) {
  return (
    <Card className={cn(
      'border',
      showResult && row.is_correct === 1 && 'border-emerald-500/30',
      showResult && row.is_correct === 0 && 'border-destructive/30',
    )}>
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          {showResult ? (
            row.is_correct === 1 ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-500 flex-shrink-0 mt-0.5" />
            ) : (
              <XCircle className="w-5 h-5 text-destructive flex-shrink-0 mt-0.5" />
            )
          ) : (
            <Clock className="w-5 h-5 text-muted-foreground flex-shrink-0 mt-0.5" />
          )}
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold leading-relaxed">
              <MathText>{row.question_text}</MathText>
            </p>
            <div className="flex flex-wrap items-center gap-2 mt-2">
              <Badge variant={row.difficulty as Difficulty} className="text-xs">
                {capitalize(row.difficulty)}
              </Badge>
              <span className="text-xs text-muted-foreground">from {row.parent_name}</span>
              <span className="text-xs text-muted-foreground">· {timeAgo(row.assigned_at)}</span>
            </div>
            {showResult && row.is_correct === 0 && row.answer_given && (
              <p className="text-xs text-muted-foreground mt-1.5">
                Your answer: <span className="font-medium">{row.answer_given}</span>
              </p>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

export default function CompletedWorkPage() {
  const { data, isLoading } = useQuery<Overview>({
    queryKey: ['assignments-overview'],
    queryFn: () => api.get('/student/assignments-overview'),
  })

  const pending = data?.pending ?? []
  const completed = data?.completed ?? []

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-black text-foreground">Completed Work</h1>
        <p className="text-muted-foreground mt-1">Track your assigned questions</p>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center h-48">
          <div className="w-7 h-7 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <Tabs defaultValue="completed">
          <TabsList className="w-full mb-4">
            <TabsTrigger value="completed" className="flex-1">
              Completed {completed.length > 0 && `(${completed.length})`}
            </TabsTrigger>
            <TabsTrigger value="pending" className="flex-1">
              Pending {pending.length > 0 && `(${pending.length})`}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="completed" className="space-y-3">
            {completed.length === 0 ? (
              <EmptyState message="No completed assignments yet — finish some questions to see them here." />
            ) : (
              completed.map((row) => (
                <AssignmentCard key={row.id} row={row} showResult />
              ))
            )}
          </TabsContent>

          <TabsContent value="pending" className="space-y-3">
            {pending.length === 0 ? (
              <EmptyState message="No pending assignments — you're all caught up!" />
            ) : (
              pending.map((row) => (
                <AssignmentCard key={row.id} row={row} showResult={false} />
              ))
            )}
          </TabsContent>
        </Tabs>
      )}
    </div>
  )
}

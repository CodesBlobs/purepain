'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ClipboardList, CheckCircle2, XCircle, Clock } from 'lucide-react'
import { api } from '@/lib/api'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { MathText } from '@/components/math/MathText'
import { cn, capitalize, timeAgo } from '@/lib/utils'
import type { Assignment, Difficulty } from '@/types'

interface SubmitResult {
  is_correct: boolean
  correct_answer: string
}

interface AssignmentItemProps {
  assignment: Assignment
}

function AssignmentItem({ assignment: a }: AssignmentItemProps) {
  const qc = useQueryClient()
  const [selected, setSelected] = useState<string | null>(null)
  const [textInput, setTextInput] = useState('')
  const [result, setResult] = useState<SubmitResult | null>(null)

  const hasOptions = (a.options?.length ?? 0) > 0

  const submitMutation = useMutation({
    mutationFn: (answer_given: string) =>
      api.post<SubmitResult>('/student/submit', {
        question_id: a.question_id,
        assignment_id: a.id,
        answer_given,
      }),
    onSuccess: (data) => {
      setResult(data)
      if (data.is_correct) {
        setTimeout(() => {
          qc.invalidateQueries({ queryKey: ['student-dashboard'] })
          qc.invalidateQueries({ queryKey: ['student-assignments'] })
        }, 1500)
      }
    },
  })

  function handleSubmit() {
    const answer = hasOptions ? selected : textInput.trim()
    if (!answer) return
    submitMutation.mutate(answer)
  }

  return (
    <Card className={cn(result?.is_correct ? 'border-emerald-500/40' : '')}>
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant={a.difficulty as Difficulty}>{capitalize(a.difficulty)}</Badge>
            <Badge variant="outline" className="text-xs capitalize">{a.type.replace('_', ' ')}</Badge>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground whitespace-nowrap">
            <Clock className="w-3 h-3" />
            {timeAgo(a.assigned_at)}
          </div>
        </div>

        <p className="text-sm font-semibold leading-relaxed mb-4">
          <MathText>{a.question_text}</MathText>
        </p>

        {/* Result */}
        {result && (
          <div
            className={cn(
              'flex items-start gap-3 p-3 rounded-xl border mb-4',
              result.is_correct
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-400'
                : 'bg-destructive/10 border-destructive/30 text-destructive'
            )}
          >
            {result.is_correct ? (
              <CheckCircle2 className="w-4 h-4 flex-shrink-0 mt-0.5" />
            ) : (
              <XCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
            )}
            <div>
              <p className="text-sm font-semibold">{result.is_correct ? 'Correct! Marked complete.' : 'Not quite'}</p>
              {!result.is_correct && (
                <p className="text-xs mt-0.5">
                  Correct answer: <MathText>{result.correct_answer}</MathText>
                </p>
              )}
            </div>
          </div>
        )}

        {/* Answer area */}
        {!result && (
          <div className="space-y-3">
            {hasOptions ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {a.options!.map((opt) => (
                  <button
                    key={opt.option_label}
                    onClick={() => setSelected(opt.option_text)}
                    className={cn(
                      'text-left p-3 rounded-xl border-2 transition-all text-sm font-medium',
                      selected === opt.option_text
                        ? 'border-primary bg-primary/8 text-primary'
                        : 'border-border hover:border-primary/40 hover:bg-accent/40'
                    )}
                  >
                    <span className="font-bold mr-2">{opt.option_label}.</span>
                    <MathText>{opt.option_text}</MathText>
                  </button>
                ))}
              </div>
            ) : (
              <Input
                value={textInput}
                onChange={(e) => setTextInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
                placeholder="Your answer…"
              />
            )}

            <Button
              onClick={handleSubmit}
              disabled={submitMutation.isPending || (!selected && !textInput.trim())}
              className="w-full"
            >
              {submitMutation.isPending ? 'Checking…' : 'Submit Answer'}
            </Button>
          </div>
        )}

        <p className="text-xs text-muted-foreground mt-3">From {a.parent_name}</p>
      </CardContent>
    </Card>
  )
}

export default function AssignmentsPage() {
  const { data, isLoading } = useQuery<{ assignments: Assignment[] }>({
    queryKey: ['student-assignments'],
    queryFn: async () => {
      const dash = await api.get<{
        assignments: Assignment[]
        stats: unknown
        recentAttempts: unknown[]
        parents: unknown[]
      }>('/student/dashboard')
      return { assignments: dash.assignments }
    },
  })

  const assignments = data?.assignments ?? []

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-black text-foreground">Assignments</h1>
        <p className="text-muted-foreground mt-1">Questions assigned by your parent</p>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center h-48">
          <div className="w-7 h-7 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      ) : assignments.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <div className="w-14 h-14 rounded-2xl bg-muted flex items-center justify-center mx-auto mb-4">
              <ClipboardList className="w-7 h-7 text-muted-foreground" />
            </div>
            <p className="font-semibold text-foreground">All caught up!</p>
            <p className="text-sm text-muted-foreground mt-1">No pending assignments right now.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">{assignments.length} pending</p>
          {assignments.map((a) => (
            <AssignmentItem key={a.id} assignment={a} />
          ))}
        </div>
      )}
    </div>
  )
}

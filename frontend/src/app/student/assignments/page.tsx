'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { CheckCircle2, XCircle, ChevronRight } from 'lucide-react'
import { api } from '@/lib/api'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Progress } from '@/components/ui/progress'
import { MathText } from '@/components/math/MathText'
import { cn, capitalize } from '@/lib/utils'
import type { Assignment, Difficulty } from '@/types'

interface SubmitResult {
  is_correct: boolean
  correct_answer: string
}

interface DashboardData {
  assignments: Assignment[]
  correctRequired: number
  stats: unknown
  recentAttempts: unknown[]
  parents: unknown[]
}

function QuitCountdown({ onDone }: { onDone: () => void }) {
  const [count, setCount] = useState(5)

  useEffect(() => {
    if (count <= 0) { onDone(); return }
    const t = setTimeout(() => setCount(c => c - 1), 1000)
    return () => clearTimeout(t)
  }, [count, onDone])

  return (
    <div className="fixed inset-0 z-50 bg-background/95 backdrop-blur-sm flex flex-col items-center justify-center gap-6 text-center px-6">
      <div className="w-20 h-20 rounded-3xl bg-emerald-500/10 flex items-center justify-center">
        <CheckCircle2 className="w-10 h-10 text-emerald-500" />
      </div>
      <div>
        <h2 className="text-2xl font-black">You've hit your goal!</h2>
        <p className="text-muted-foreground mt-1">Great work — SEB is closing</p>
      </div>
      <div className="text-8xl font-black text-primary tabular-nums">{count}</div>
    </div>
  )
}

export default function AssignmentsPage() {
  const router = useRouter()
  const qc = useQueryClient()
  const [index, setIndex] = useState(0)
  const [selected, setSelected] = useState<string | null>(null)
  const [textInput, setTextInput] = useState('')
  const [result, setResult] = useState<SubmitResult | null>(null)
  const [sessionCorrect, setSessionCorrect] = useState(0)
  const [quitting, setQuitting] = useState(false)

  const { data, isLoading } = useQuery<DashboardData>({
    queryKey: ['student-assignments'],
    queryFn: () => api.get<DashboardData>('/student/dashboard'),
  })

  const assignments = data?.assignments ?? []
  const correctRequired = data?.correctRequired ?? 0
  const total = assignments.length
  const a = assignments[index]
  const hasOptions = (a?.options?.length ?? 0) > 0

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
        const newCount = sessionCorrect + 1
        setSessionCorrect(newCount)
        if (correctRequired > 0 && newCount >= correctRequired) {
          setQuitting(true)
        }
      }
      qc.invalidateQueries({ queryKey: ['student-dashboard'] })
      qc.invalidateQueries({ queryKey: ['student-assignments'] })
    },
  })

  function handleSubmit() {
    const answer = hasOptions ? selected : textInput.trim()
    if (!answer) return
    submitMutation.mutate(answer)
  }

  function handleNext() {
    setSelected(null)
    setTextInput('')
    setResult(null)
    setIndex(i => i + 1)
  }

  if (quitting) {
    return <QuitCountdown onDone={() => router.push('/student/challenge/perfect')} />
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-7 h-7 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (total === 0 || index >= total) {
    return (
      <div className="max-w-md mx-auto text-center space-y-4 pt-16">
        <div className="w-16 h-16 rounded-2xl bg-emerald-500/10 flex items-center justify-center mx-auto">
          <CheckCircle2 className="w-8 h-8 text-emerald-500" />
        </div>
        <h1 className="text-2xl font-black">All done!</h1>
        <p className="text-muted-foreground">No pending assignments right now.</p>
      </div>
    )
  }

  const progress = (index / total) * 100

  return (
    <div className="max-w-2xl mx-auto space-y-5">
      <div className="space-y-2">
        <div className="flex items-center justify-between text-sm">
          <span className="font-black text-lg text-foreground">Assignments</span>
          <div className="flex items-center gap-3">
            {correctRequired > 0 && (
              <span className="text-xs text-muted-foreground">
                {sessionCorrect}/{correctRequired} correct
              </span>
            )}
            <span className="text-muted-foreground">{index + 1} of {total}</span>
          </div>
        </div>
        <Progress value={progress} className="h-2" />
      </div>

      <Card>
        <CardContent className="p-5 space-y-4">
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant={a.difficulty as Difficulty}>{capitalize(a.difficulty)}</Badge>
            <Badge variant="outline" className="text-xs capitalize">{a.type.replace('_', ' ')}</Badge>
          </div>

          <p className="text-sm font-semibold leading-relaxed">
            <MathText>{a.question_text}</MathText>
          </p>

          {result ? (
            <div className="space-y-4">
              <div className={cn(
                'flex items-start gap-3 p-3 rounded-xl border',
                result.is_correct
                  ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-400'
                  : 'bg-destructive/10 border-destructive/30 text-destructive'
              )}>
                {result.is_correct
                  ? <CheckCircle2 className="w-4 h-4 flex-shrink-0 mt-0.5" />
                  : <XCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                }
                <div>
                  <p className="text-sm font-semibold">
                    {result.is_correct ? 'Correct!' : 'Not quite'}
                  </p>
                  {!result.is_correct && (
                    <p className="text-xs mt-0.5">
                      Correct answer: <MathText>{result.correct_answer}</MathText>
                    </p>
                  )}
                </div>
              </div>

              <Button onClick={handleNext} className="w-full gap-2">
                {index + 1 < total ? (
                  <>Next <ChevronRight className="w-4 h-4" /></>
                ) : (
                  'Finish'
                )}
              </Button>
            </div>
          ) : (
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
                <div className="space-y-1">
                  <Input
                    value={textInput}
                    onChange={(e) => setTextInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
                    placeholder="Your answer…"
                    autoFocus
                  />
                  <p className="text-xs text-muted-foreground">Just enter the number — units don't matter.</p>
                </div>
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

          <p className="text-xs text-muted-foreground">From {a.parent_name}</p>
        </CardContent>
      </Card>
    </div>
  )
}

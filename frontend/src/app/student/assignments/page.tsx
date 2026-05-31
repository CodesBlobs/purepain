'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { CheckCircle2, XCircle, ChevronRight, Sparkles } from 'lucide-react'
import { api } from '@/lib/api'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Progress } from '@/components/ui/progress'
import { MathText } from '@/components/math/MathText'
import { cn, capitalize } from '@/lib/utils'
import type { Assignment, Difficulty, QuestionOption } from '@/types'

interface SubmitResult {
  is_correct: boolean
  correct_answer: string
}

interface PracticeQuestion {
  id: number | null
  question_id: number | null
  question_text: string
  type: 'multiple_choice' | 'word_problem'
  difficulty: 'easy' | 'medium' | 'hard'
  answer: string
  options: QuestionOption[]
  parent_name: string
  batch_id: number | null
  batch_correct_required: number | null
  is_generated: boolean
}

function fromAssignment(a: Assignment): PracticeQuestion {
  return {
    id: a.id,
    question_id: a.question_id,
    question_text: a.question_text,
    type: a.type,
    difficulty: a.difficulty,
    answer: a.answer,
    options: a.options ?? [],
    parent_name: a.parent_name,
    batch_id: a.batch_id ?? null,
    batch_correct_required: a.batch_correct_required ?? null,
    is_generated: false,
  }
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

  const [questions, setQuestions] = useState<PracticeQuestion[]>([])
  const [index, setIndex] = useState(0)
  const [selected, setSelected] = useState<string | null>(null)
  const [textInput, setTextInput] = useState('')
  const [result, setResult] = useState<SubmitResult | null>(null)
  const [batchCorrect, setBatchCorrect] = useState<Record<number, number>>({})
  const [quitting, setQuitting] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [assignedCount, setAssignedCount] = useState(0)

  const { data, isLoading } = useQuery<{ assignments: Assignment[] }>({
    queryKey: ['student-assignments'],
    queryFn: async () => {
      const dash = await api.get<{ assignments: Assignment[]; stats: unknown; recentAttempts: unknown[]; parents: unknown[] }>('/student/dashboard')
      return { assignments: dash.assignments }
    },
  })

  useEffect(() => {
    if (data?.assignments && questions.length === 0) {
      const qs = data.assignments.map(fromAssignment)
      setQuestions(qs)
      setAssignedCount(qs.length)
    }
  }, [data, questions.length])

  const q = questions[index]
  const total = questions.length
  const hasOptions = (q?.options?.length ?? 0) > 0
  const isLastAssigned = index === assignedCount - 1

  const generateMore = useCallback(async (batchQ: PracticeQuestion) => {
    setGenerating(true)
    try {
      const examples = data?.assignments
        .filter(a => a.batch_id === batchQ.batch_id)
        .map(a => ({ question_text: a.question_text, type: a.type, difficulty: a.difficulty })) ?? []

      const res = await api.post<{ questions: Omit<PracticeQuestion, 'id' | 'question_id' | 'parent_name' | 'is_generated'>[] }>(
        '/student/generate-practice',
        { examples, count: 5 }
      )

      const generated: PracticeQuestion[] = res.questions.map(q => ({
        ...q,
        id: null,
        question_id: null,
        parent_name: '',
        batch_id: batchQ.batch_id,
        batch_correct_required: batchQ.batch_correct_required,
        is_generated: true,
      }))

      setQuestions(prev => [...prev, ...generated])
    } catch {
      // generation failed — student will see "all done" after current questions
    } finally {
      setGenerating(false)
    }
  }, [data?.assignments])

  const submitMutation = useMutation({
    mutationFn: (answer_given: string) => {
      if (q.is_generated) {
        return api.post<SubmitResult>('/student/submit', {
          is_generated: true,
          question_text: q.question_text,
          answer: q.answer,
          difficulty: q.difficulty,
          answer_given,
        })
      }
      return api.post<SubmitResult>('/student/submit', {
        question_id: q.question_id,
        assignment_id: q.id,
        answer_given,
      })
    },
    onSuccess: (data) => {
      setResult(data)

      let newBatchCorrect = batchCorrect
      if (data.is_correct && q.batch_id != null && q.batch_correct_required != null) {
        const prev = batchCorrect[q.batch_id] ?? 0
        const next = prev + 1
        newBatchCorrect = { ...batchCorrect, [q.batch_id]: next }
        setBatchCorrect(newBatchCorrect)
        if (next >= q.batch_correct_required) {
          setQuitting(true)
          return
        }
      }

      // Last assigned question and batch target not met — generate more in the background
      if (isLastAssigned && !generating && q.batch_id != null) {
        const remaining = (q.batch_correct_required ?? 0) - (newBatchCorrect[q.batch_id] ?? 0)
        if (remaining > 0) {
          generateMore(q)
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

  if (isLoading || (questions.length === 0 && !data)) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-7 h-7 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (assignedCount === 0) {
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

  // Waiting for generated questions to load
  if (index >= total && generating) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <Sparkles className="w-8 h-8 text-primary animate-pulse" />
        <p className="text-muted-foreground">Generating more practice questions…</p>
      </div>
    )
  }

  // Generated questions exhausted too (shouldn't normally happen)
  if (index >= total) {
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

  const progress = (index / Math.max(total, assignedCount)) * 100
  const batchTarget = q.batch_id != null && q.batch_correct_required != null
    ? { required: q.batch_correct_required, correct: batchCorrect[q.batch_id] ?? 0 }
    : null

  const nextButtonBlocked = isLastAssigned && result != null && generating

  return (
    <div className="max-w-2xl mx-auto space-y-5">
      <div className="space-y-2">
        <div className="flex items-center justify-between text-sm">
          <span className="font-black text-lg text-foreground">Assignments</span>
          <div className="flex items-center gap-3">
            {batchTarget && (
              <span className="text-xs text-muted-foreground">
                {batchTarget.correct}/{batchTarget.required} correct
              </span>
            )}
            {q.is_generated && (
              <Badge variant="secondary" className="text-xs gap-1">
                <Sparkles className="w-3 h-3" /> Practice
              </Badge>
            )}
            <span className="text-muted-foreground">{index + 1} of {total}</span>
          </div>
        </div>
        <Progress value={progress} className="h-2" />
      </div>

      <Card>
        <CardContent className="p-5 space-y-4">
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant={q.difficulty as Difficulty}>{capitalize(q.difficulty)}</Badge>
            <Badge variant="outline" className="text-xs capitalize">{q.type.replace('_', ' ')}</Badge>
          </div>

          <p className="text-sm font-semibold leading-relaxed">
            <MathText>{q.question_text}</MathText>
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

              <Button
                onClick={handleNext}
                disabled={nextButtonBlocked}
                className="w-full gap-2"
              >
                {nextButtonBlocked ? (
                  <>
                    <Sparkles className="w-4 h-4 animate-pulse" />
                    Generating practice questions…
                  </>
                ) : index + 1 < total ? (
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
                  {q.options.map((opt) => (
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

          {q.parent_name && (
            <p className="text-xs text-muted-foreground">From {q.parent_name}</p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

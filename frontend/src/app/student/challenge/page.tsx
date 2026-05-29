'use client'

import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Trophy, Zap, ChevronLeft, ChevronRight, CheckCircle2, XCircle, RotateCcw } from 'lucide-react'
import { api } from '@/lib/api'
import { useChallengeStore } from '@/store/challenge'
import { generateMathQuestion, capitalize, cn } from '@/lib/utils'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Input } from '@/components/ui/input'
import { MathText } from '@/components/math/MathText'
import type { Difficulty, Question } from '@/types'

const difficulties: Difficulty[] = ['easy', 'medium', 'hard']

interface PendingAssignment {
  assignment_id: number
  question_id: number
  question_text: string
  type: string
  difficulty: string
  answer: string
  from_assignment: true
  options: { option_label: string; option_text: string; is_correct: number }[]
}

export default function ChallengePage() {
  const qc = useQueryClient()
  const store = useChallengeStore()
  const [starting, setStarting] = useState(false)
  const [textInputs, setTextInputs] = useState<string[]>([])

  async function startChallenge() {
    setStarting(true)
    try {
      const data = await api.get<{ assignments: PendingAssignment[] }>('/student/pending-assignments')
      const assigned = (data.assignments ?? []).slice(0, store.total)
      const remaining = store.total - assigned.length

      const generated: Question[] = Array.from({ length: remaining }, () =>
        generateMathQuestion(store.difficulty)
      )

      const all = [...assigned, ...generated] as Question[]
      for (let i = all.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1))
        ;[all[i], all[j]] = [all[j], all[i]]
      }

      store.setQuestions(all)
      setTextInputs(new Array(all.length).fill(''))
    } catch {
      store.setQuestions(
        Array.from({ length: store.total }, () => generateMathQuestion(store.difficulty)) as Question[]
      )
      setTextInputs(new Array(store.total).fill(''))
    } finally {
      setStarting(false)
    }
  }

  const submitMutation = useMutation({
    mutationFn: async () => {
      const results = await Promise.all(
        store.questions.map(async (q, i) => {
          const answer_given = store.selectedAnswers[i] ?? textInputs[i] ?? ''
          const correct_answer = q.answer
          const is_correct = answer_given.trim().toLowerCase() === correct_answer.trim().toLowerCase()

          try {
            if (q.from_assignment) {
              await api.post('/student/submit', {
                question_id: q.question_id,
                assignment_id: q.assignment_id,
                answer_given,
              })
            } else if (q.type === 'generated') {
              await api.post('/student/submit', {
                is_generated: true,
                question_text: q.question_text,
                answer: q.answer,
                answer_given,
                difficulty: store.difficulty,
              })
            } else {
              await api.post('/student/submit', { question_id: q.id, answer_given })
            }
          } catch {}

          return {
            question_text: q.question_text,
            answer: correct_answer,
            answer_given: answer_given || null,
            is_correct,
            from_assignment: !!q.from_assignment,
          }
        })
      )
      return results
    },
    onSuccess: (results) => {
      store.finish(results)
      qc.invalidateQueries({ queryKey: ['student-dashboard'] })
    },
  })

  function handleSelect(value: string) {
    store.selectAnswer(value)
  }

  function handleTextInput(value: string) {
    const updated = [...textInputs]
    updated[store.current] = value
    setTextInputs(updated)
  }

  function handleReset() {
    store.reset()
    setTextInputs([])
  }

  // Lobby
  if (store.questions.length === 0) {
    return (
      <div className="max-w-md mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-black text-foreground">Challenge</h1>
          <p className="text-muted-foreground mt-1">5 questions, prove yourself</p>
        </div>

        <Card>
          <CardContent className="pt-8 pb-8 text-center space-y-6">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center mx-auto shadow-lg shadow-amber-500/30">
              <Trophy className="w-8 h-8 text-white" />
            </div>

            <div>
              <h2 className="text-xl font-black">Ready to challenge yourself?</h2>
              <p className="text-sm text-muted-foreground mt-1.5">
                Assigned questions are included automatically. Fill the rest with generated math.
              </p>
            </div>

            <div className="space-y-2">
              <p className="text-sm font-medium text-left">Difficulty for generated questions</p>
              <div className="flex gap-2">
                {difficulties.map((d) => (
                  <Button
                    key={d}
                    variant={store.difficulty === d ? 'default' : 'outline'}
                    size="sm"
                    className="flex-1"
                    onClick={() => store.setDifficulty(d)}
                  >
                    {capitalize(d)}
                  </Button>
                ))}
              </div>
            </div>

            <Button
              size="xl"
              className="w-full gap-2"
              onClick={startChallenge}
              disabled={starting}
            >
              <Zap className="w-5 h-5" />
              {starting ? 'Loading…' : 'Start Challenge'}
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  // Results
  if (store.completed) {
    const pct = Math.round((store.score / store.total) * 100)
    const grade =
      pct >= 80 ? { label: 'Excellent!', color: 'text-emerald-500' }
      : pct >= 60 ? { label: 'Good job!', color: 'text-amber-500' }
      : { label: 'Keep practicing', color: 'text-destructive' }

    return (
      <div className="max-w-lg mx-auto space-y-6">
        <h1 className="text-2xl font-black">Challenge Complete</h1>

        <Card>
          <CardContent className="pt-8 pb-6 text-center space-y-4">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center mx-auto shadow-lg shadow-amber-500/30">
              <Trophy className="w-8 h-8 text-white" />
            </div>
            <div>
              <p className="text-5xl font-black">{store.score}/{store.total}</p>
              <p className={`text-lg font-bold mt-1 ${grade.color}`}>{grade.label}</p>
              <p className="text-muted-foreground text-sm mt-0.5">{pct}% accuracy</p>
            </div>
            <Progress value={pct} className="h-3" />
          </CardContent>
        </Card>

        <div className="space-y-2">
          {store.results.map((r, i) => (
            <Card key={i} className={cn('border', r.is_correct ? 'border-emerald-500/30' : 'border-destructive/30')}>
              <CardContent className="p-4">
                <div className="flex gap-3">
                  {r.is_correct ? (
                    <CheckCircle2 className="w-5 h-5 text-emerald-500 flex-shrink-0 mt-0.5" />
                  ) : (
                    <XCircle className="w-5 h-5 text-destructive flex-shrink-0 mt-0.5" />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium line-clamp-2">
                      <MathText>{r.question_text}</MathText>
                    </p>
                    {!r.is_correct && (
                      <p className="text-xs text-muted-foreground mt-1">
                        Your answer: {r.answer_given ?? '—'} · Correct: <MathText>{r.answer}</MathText>
                      </p>
                    )}
                    {r.from_assignment && (
                      <Badge variant="secondary" className="mt-1.5 text-xs">Assigned</Badge>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <Button variant="outline" className="w-full gap-2" onClick={handleReset}>
          <RotateCcw className="w-4 h-4" />
          New Challenge
        </Button>
      </div>
    )
  }

  // Question view
  const q = store.questions[store.current]
  const hasOptions = (q?.options?.length ?? 0) > 0
  const currentSelected = store.selectedAnswers[store.current]
  const currentText = textInputs[store.current] ?? ''
  const answered = hasOptions ? !!currentSelected : !!currentText.trim()
  const progress = ((store.current + 1) / store.total) * 100

  return (
    <div className="max-w-2xl mx-auto space-y-5">
      {/* Progress header */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>Question {store.current + 1} of {store.total}</span>
          <span>{store.selectedAnswers.filter(Boolean).length + textInputs.filter(t => t.trim()).length} answered</span>
        </div>
        <Progress value={progress} className="h-2" />
        <div className="flex gap-1.5">
          {store.questions.map((_, i) => {
            const ans = store.selectedAnswers[i] ?? textInputs[i]
            return (
              <button
                key={i}
                onClick={() => store.goTo(i)}
                className={cn(
                  'flex-1 h-1.5 rounded-full transition-all',
                  i === store.current ? 'bg-primary' : ans ? 'bg-primary/40' : 'bg-border'
                )}
              />
            )
          })}
        </div>
      </div>

      <Card>
        <CardHeader className="pb-4">
          <div className="flex items-center gap-2">
            {q?.from_assignment && <Badge variant="secondary">Assigned</Badge>}
            {q && (
              <Badge variant={q.difficulty as Difficulty}>{capitalize(q.difficulty)}</Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-5">
          <p className="text-base font-semibold leading-relaxed">
            <MathText>{q?.question_text ?? ''}</MathText>
          </p>

          {hasOptions ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {q.options!.map((opt) => (
                <button
                  key={opt.option_label}
                  onClick={() => handleSelect(opt.option_text)}
                  className={cn(
                    'text-left p-3.5 rounded-xl border-2 transition-all font-medium text-sm',
                    currentSelected === opt.option_text
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
              value={currentText}
              onChange={(e) => handleTextInput(e.target.value)}
              placeholder="Your answer…"
              autoFocus
            />
          )}

          {/* Navigation */}
          <div className="flex items-center gap-3 pt-2">
            <Button
              variant="outline"
              size="sm"
              disabled={store.current === 0}
              onClick={() => store.goTo(store.current - 1)}
              className="gap-1"
            >
              <ChevronLeft className="w-4 h-4" />
              Back
            </Button>

            {store.current < store.total - 1 ? (
              <Button
                className="flex-1 gap-1"
                onClick={() => store.goTo(store.current + 1)}
              >
                Next
                <ChevronRight className="w-4 h-4" />
              </Button>
            ) : (
              <Button
                className="flex-1 gap-2"
                onClick={() => submitMutation.mutate()}
                disabled={submitMutation.isPending}
                variant="default"
              >
                {submitMutation.isPending ? 'Submitting…' : 'Finish Challenge'}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

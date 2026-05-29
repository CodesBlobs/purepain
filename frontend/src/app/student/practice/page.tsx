'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { RefreshCw, CheckCircle2, XCircle, ChevronRight } from 'lucide-react'
import { api } from '@/lib/api'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { MathText } from '@/components/math/MathText'
import { cn, capitalize } from '@/lib/utils'
import type { Question, Difficulty } from '@/types'

interface SubmitResult {
  is_correct: boolean
  correct_answer: string
}

const difficulties: Difficulty[] = ['easy', 'medium', 'hard']

export default function PracticePage() {
  const qc = useQueryClient()
  const [difficulty, setDifficulty] = useState<Difficulty>('easy')
  const [selected, setSelected] = useState<string | null>(null)
  const [textInput, setTextInput] = useState('')
  const [result, setResult] = useState<SubmitResult | null>(null)
  const [sessionCorrect, setSessionCorrect] = useState(0)
  const [sessionTotal, setSessionTotal] = useState(0)

  const { data: question, isFetching, refetch } = useQuery<Question>({
    queryKey: ['practice', difficulty],
    queryFn: () => api.get(`/student/practice?difficulty=${difficulty}`),
    staleTime: 0,
  })

  const submitMutation = useMutation({
    mutationFn: (answer: string) => {
      if (!question) throw new Error('No question')
      if (question.from_assignment) {
        return api.post<SubmitResult>('/student/submit', {
          question_id: question.question_id,
          assignment_id: question.assignment_id,
          answer_given: answer,
        })
      }
      if (question.type === 'generated') {
        return api.post<SubmitResult>('/student/submit', {
          is_generated: true,
          question_text: question.question_text,
          answer: question.answer,
          answer_given: answer,
          difficulty,
        })
      }
      return api.post<SubmitResult>('/student/submit', {
        question_id: question.id,
        answer_given: answer,
      })
    },
    onSuccess: (data) => {
      setResult(data)
      setSessionTotal((n) => n + 1)
      if (data.is_correct) setSessionCorrect((n) => n + 1)
      qc.invalidateQueries({ queryKey: ['student-dashboard'] })
      if (data.is_correct) {
        setTimeout(() => handleNext(), 1200)
      }
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
    refetch()
  }

  function handleDifficultyChange(d: Difficulty) {
    setDifficulty(d)
    setSelected(null)
    setTextInput('')
    setResult(null)
  }

  const hasOptions = (question?.options?.length ?? 0) > 0

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-black text-foreground">Practice</h1>
          <p className="text-muted-foreground mt-1">Work through questions at your own pace</p>
        </div>
        {sessionTotal > 0 && (
          <div className="text-right">
            <p className="text-2xl font-black text-foreground">{sessionCorrect}/{sessionTotal}</p>
            <p className="text-xs text-muted-foreground">this session</p>
          </div>
        )}
      </div>

      {/* Difficulty selector */}
      <div className="flex gap-2">
        {difficulties.map((d) => (
          <Button
            key={d}
            variant={difficulty === d ? 'default' : 'outline'}
            size="sm"
            onClick={() => handleDifficultyChange(d)}
          >
            {capitalize(d)}
          </Button>
        ))}
      </div>

      {/* Question card */}
      <Card>
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {question?.from_assignment && (
                <Badge variant="secondary">Assigned</Badge>
              )}
              {question && (
                <Badge variant={question.difficulty as Difficulty}>
                  {capitalize(question.difficulty)}
                </Badge>
              )}
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleNext}
              disabled={isFetching}
              className="gap-1.5"
            >
              <RefreshCw className={cn('w-3.5 h-3.5', isFetching && 'animate-spin')} />
              Skip
            </Button>
          </div>
        </CardHeader>

        <CardContent className="space-y-5">
          {isFetching ? (
            <div className="flex items-center justify-center h-32">
              <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
          ) : question ? (
            <>
              <p className="text-base font-semibold leading-relaxed">
                <MathText>{question.question_text}</MathText>
              </p>

              {/* Result feedback */}
              {result && (
                <div
                  className={cn(
                    'flex items-start gap-3 p-4 rounded-xl border',
                    result.is_correct
                      ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-400'
                      : 'bg-destructive/10 border-destructive/30 text-destructive'
                  )}
                >
                  {result.is_correct ? (
                    <CheckCircle2 className="w-5 h-5 flex-shrink-0 mt-0.5" />
                  ) : (
                    <XCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                  )}
                  <div>
                    <p className="font-semibold">{result.is_correct ? 'Correct!' : 'Not quite'}</p>
                    {!result.is_correct && (
                      <p className="text-sm mt-0.5">
                        Correct answer: <MathText>{result.correct_answer}</MathText>
                      </p>
                    )}
                  </div>
                </div>
              )}

              {/* Answer options or text input */}
              {!result && hasOptions && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {question.options!.map((opt) => (
                    <button
                      key={opt.option_label}
                      onClick={() => setSelected(opt.option_text)}
                      className={cn(
                        'text-left p-3.5 rounded-xl border-2 transition-all font-medium text-sm',
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
              )}

              {!result && !hasOptions && (
                <div className="space-y-2">
                  <Input
                    value={textInput}
                    onChange={(e) => setTextInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
                    placeholder="Your answer…"
                    autoFocus
                  />
                  <p className="text-xs text-muted-foreground">Just enter the number — units don&apos;t matter.</p>
                </div>
              )}

              {/* Action buttons */}
              {!result ? (
                <Button
                  onClick={handleSubmit}
                  disabled={submitMutation.isPending || (!selected && !textInput.trim())}
                  className="w-full"
                  size="lg"
                >
                  {submitMutation.isPending ? 'Checking…' : 'Submit Answer'}
                </Button>
              ) : result.is_correct ? (
                <Button disabled className="w-full gap-2" size="lg" variant="outline">
                  Next question incoming…
                </Button>
              ) : (
                <Button onClick={handleNext} className="w-full gap-2" size="lg">
                  Try another
                  <ChevronRight className="w-4 h-4" />
                </Button>
              )}
            </>
          ) : null}
        </CardContent>
      </Card>
    </div>
  )
}

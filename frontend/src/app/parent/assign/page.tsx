'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Send, CheckSquare, Square, Users, FileText } from 'lucide-react'
import { api } from '@/lib/api'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { MathText } from '@/components/math/MathText'
import { cn, capitalize } from '@/lib/utils'
import type { Question, StudentCard, Difficulty } from '@/types'

interface DashboardData {
  students: StudentCard[]
  my_questions: Question[]
}

export default function AssignPage() {
  const qc = useQueryClient()
  const [selectedStudent, setSelectedStudent] = useState<string>('')
  const [selectedQuestions, setSelectedQuestions] = useState<Set<number>>(new Set())
  const [dueDate, setDueDate] = useState('')
  const [successMsg, setSuccessMsg] = useState('')
  const [errorMsg, setErrorMsg] = useState('')

  const { data, isLoading } = useQuery<DashboardData>({
    queryKey: ['parent-dashboard'],
    queryFn: () => api.get('/parent/dashboard'),
  })

  const { data: questions = [], isLoading: qLoading } = useQuery<Question[]>({
    queryKey: ['parent-questions'],
    queryFn: () => api.get('/parent/questions'),
  })

  const assignMutation = useMutation<{ assigned: number; message: string }, Error, void>({
    mutationFn: () =>
      api.post('/parent/assign-batch', {
        student_id: parseInt(selectedStudent),
        question_ids: Array.from(selectedQuestions),
        due_date: dueDate || null,
      }),
    onSuccess: (data) => {
      setSuccessMsg(`${data.assigned} question${data.assigned !== 1 ? 's' : ''} assigned successfully!`)
      setSelectedQuestions(new Set())
      setErrorMsg('')
      qc.invalidateQueries({ queryKey: ['parent-dashboard'] })
    },
    onError: (err) => {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to assign')
      setSuccessMsg('')
    },
  })

  function toggleQuestion(id: number) {
    setSelectedQuestions((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function selectAll() {
    setSelectedQuestions(new Set(questions.map((q) => q.id!)))
  }

  function clearAll() {
    setSelectedQuestions(new Set())
  }

  const students = data?.students ?? []

  if (isLoading || qLoading) {
    return (
      <div className="flex items-center justify-center h-48">
        <div className="w-7 h-7 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-black text-foreground">Assign Work</h1>
        <p className="text-muted-foreground mt-1">Select questions and assign them to a student</p>
      </div>

      {students.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <div className="w-14 h-14 rounded-2xl bg-muted flex items-center justify-center mx-auto mb-4">
              <Users className="w-7 h-7 text-muted-foreground" />
            </div>
            <p className="font-semibold">No students linked</p>
            <p className="text-sm text-muted-foreground mt-1">
              Go to Dashboard to link a student account first.
            </p>
          </CardContent>
        </Card>
      ) : questions.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <div className="w-14 h-14 rounded-2xl bg-muted flex items-center justify-center mx-auto mb-4">
              <FileText className="w-7 h-7 text-muted-foreground" />
            </div>
            <p className="font-semibold">No questions yet</p>
            <p className="text-sm text-muted-foreground mt-1">
              Go to My Questions to create or generate questions first.
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Assignment settings */}
          <Card>
            <CardHeader className="pb-4">
              <CardTitle className="text-base">Assignment Settings</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Assign to student</Label>
                <Select value={selectedStudent} onValueChange={setSelectedStudent}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select student…" />
                  </SelectTrigger>
                  <SelectContent>
                    {students.map((s) => (
                      <SelectItem key={s.id} value={String(s.id)}>
                        {s.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Due date (optional)</Label>
                <Input
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                />
              </div>
            </CardContent>
          </Card>

          {/* Question selector */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  Questions
                  {selectedQuestions.size > 0 && (
                    <Badge variant="secondary">{selectedQuestions.size} selected</Badge>
                  )}
                </CardTitle>
                <div className="flex gap-2">
                  <Button variant="ghost" size="sm" onClick={selectAll}>Select all</Button>
                  <Button variant="ghost" size="sm" onClick={clearAll}>Clear</Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-2">
              {questions.map((q) => {
                const checked = selectedQuestions.has(q.id!)
                return (
                  <button
                    key={q.id}
                    onClick={() => toggleQuestion(q.id!)}
                    className={cn(
                      'w-full text-left flex items-start gap-3 p-3.5 rounded-xl border-2 transition-all',
                      checked
                        ? 'border-primary bg-primary/6'
                        : 'border-border hover:border-primary/30 hover:bg-accent/30'
                    )}
                  >
                    {checked ? (
                      <CheckSquare className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
                    ) : (
                      <Square className="w-5 h-5 text-muted-foreground flex-shrink-0 mt-0.5" />
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <Badge variant={q.difficulty as Difficulty} className="text-xs">
                          {capitalize(q.difficulty)}
                        </Badge>
                        <Badge variant="outline" className="text-xs capitalize">
                          {q.type.replace('_', ' ')}
                        </Badge>
                      </div>
                      <p className="text-sm line-clamp-2">
                        <MathText>{q.question_text}</MathText>
                      </p>
                    </div>
                  </button>
                )
              })}
            </CardContent>
          </Card>

          {/* Feedback */}
          {successMsg && (
            <div className="text-sm text-emerald-700 dark:text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 rounded-xl px-4 py-3">
              {successMsg}
            </div>
          )}
          {errorMsg && (
            <div className="text-sm text-destructive bg-destructive/10 border border-destructive/30 rounded-xl px-4 py-3">
              {errorMsg}
            </div>
          )}

          <Button
            size="lg"
            className="w-full gap-2"
            disabled={!selectedStudent || selectedQuestions.size === 0 || assignMutation.isPending}
            onClick={() => assignMutation.mutate()}
          >
            <Send className="w-4 h-4" />
            {assignMutation.isPending
              ? 'Assigning…'
              : `Assign ${selectedQuestions.size} Question${selectedQuestions.size !== 1 ? 's' : ''}`}
          </Button>
        </>
      )}
    </div>
  )
}

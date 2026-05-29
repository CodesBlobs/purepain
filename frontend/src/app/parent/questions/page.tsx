'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Sparkles, Trash2, FileText, ChevronDown, ChevronUp } from 'lucide-react'
import { api } from '@/lib/api'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { MathText } from '@/components/math/MathText'
import { capitalize, cn } from '@/lib/utils'
import type { Question, QuestionOption, Difficulty } from '@/types'

interface CreatePayload {
  type: string
  difficulty: string
  question_text: string
  answer: string
  options?: { label: string; text: string; is_correct: boolean }[]
}

function QuestionCard({ q, onDelete }: { q: Question; onDelete: () => void }) {
  const [expanded, setExpanded] = useState(false)
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-2">
              <Badge variant={q.difficulty as Difficulty}>{capitalize(q.difficulty)}</Badge>
              <Badge variant="outline" className="text-xs capitalize">{q.type.replace('_', ' ')}</Badge>
            </div>
            <p className="text-sm font-medium line-clamp-2">
              <MathText>{q.question_text}</MathText>
            </p>
            {expanded && (
              <div className="mt-3 space-y-1.5">
                {(q.options ?? []).map((opt) => (
                  <div
                    key={opt.option_label}
                    className={cn(
                      'flex items-center gap-2 text-sm px-2.5 py-1.5 rounded-lg',
                      opt.is_correct ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400' : 'text-muted-foreground'
                    )}
                  >
                    <span className="font-bold w-5">{opt.option_label}.</span>
                    <MathText>{opt.option_text}</MathText>
                  </div>
                ))}
                <p className="text-xs text-muted-foreground mt-2">
                  Answer: <MathText>{q.answer}</MathText>
                </p>
              </div>
            )}
          </div>
          <div className="flex gap-1.5 flex-shrink-0">
            {((q.options?.length ?? 0) > 0 || q.type === 'word_problem') && (
              <Button
                variant="ghost"
                size="icon"
                className="text-muted-foreground hover:text-foreground"
                onClick={() => setExpanded(!expanded)}
              >
                {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </Button>
            )}
            <Button
              variant="ghost"
              size="icon"
              className="text-muted-foreground hover:text-destructive hover:bg-destructive/10"
              onClick={onDelete}
            >
              <Trash2 className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

export default function QuestionsPage() {
  const qc = useQueryClient()
  const [createOpen, setCreateOpen] = useState(false)
  const [aiOpen, setAiOpen] = useState(false)

  // Create form state
  const [type, setType] = useState<'multiple_choice' | 'word_problem'>('multiple_choice')
  const [difficulty, setDifficulty] = useState<Difficulty>('easy')
  const [questionText, setQuestionText] = useState('')
  const [answer, setAnswer] = useState('')
  const [options, setOptions] = useState([
    { label: 'A', text: '', is_correct: false },
    { label: 'B', text: '', is_correct: false },
    { label: 'C', text: '', is_correct: false },
    { label: 'D', text: '', is_correct: false },
  ])
  const [createError, setCreateError] = useState('')

  // AI form state
  const [aiCount, setAiCount] = useState(10)
  const [aiDifficulty, setAiDifficulty] = useState('mixed')
  const [aiTopic, setAiTopic] = useState('math')
  const [aiGenerating, setAiGenerating] = useState(false)
  const [aiError, setAiError] = useState('')

  const { data: questions = [], isLoading } = useQuery<Question[]>({
    queryKey: ['parent-questions'],
    queryFn: () => api.get('/parent/questions'),
  })

  const createMutation = useMutation({
    mutationFn: (payload: CreatePayload) => api.post('/parent/questions', payload),
    onSuccess: () => {
      setCreateOpen(false)
      resetCreateForm()
      qc.invalidateQueries({ queryKey: ['parent-questions'] })
      qc.invalidateQueries({ queryKey: ['parent-dashboard'] })
    },
    onError: (err) => setCreateError(err instanceof Error ? err.message : 'Failed to create'),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: number) => api.delete(`/parent/questions/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['parent-questions'] })
      qc.invalidateQueries({ queryKey: ['parent-dashboard'] })
    },
  })

  function resetCreateForm() {
    setType('multiple_choice')
    setDifficulty('easy')
    setQuestionText('')
    setAnswer('')
    setOptions([
      { label: 'A', text: '', is_correct: false },
      { label: 'B', text: '', is_correct: false },
      { label: 'C', text: '', is_correct: false },
      { label: 'D', text: '', is_correct: false },
    ])
    setCreateError('')
  }

  function handleCreate() {
    setCreateError('')
    if (!questionText.trim() || !answer.trim()) {
      setCreateError('Question text and answer are required')
      return
    }
    const payload: CreatePayload = { type, difficulty, question_text: questionText, answer }
    if (type === 'multiple_choice') {
      const filled = options.filter((o) => o.text.trim())
      if (filled.length < 2) {
        setCreateError('Add at least 2 options for multiple choice')
        return
      }
      if (!filled.some((o) => o.is_correct)) {
        setCreateError('Mark one option as correct')
        return
      }
      payload.options = filled.map((o) => ({ label: o.label, text: o.text, is_correct: o.is_correct }))
    }
    createMutation.mutate(payload)
  }

  async function handleAiGenerate() {
    setAiGenerating(true)
    setAiError('')
    try {
      await api.post('/parent/questions/generate', {
        count: aiCount,
        difficulty: aiDifficulty,
        topic: aiTopic,
      })
      qc.invalidateQueries({ queryKey: ['parent-questions'] })
      qc.invalidateQueries({ queryKey: ['parent-dashboard'] })
      setAiOpen(false)
    } catch (err) {
      setAiError(err instanceof Error ? err.message : 'AI generation failed')
    } finally {
      setAiGenerating(false)
    }
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-foreground">My Questions</h1>
          <p className="text-muted-foreground mt-1">
            {questions.length} question{questions.length !== 1 ? 's' : ''} in your bank
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" className="gap-2" onClick={() => setAiOpen(true)}>
            <Sparkles className="w-4 h-4" />
            Generate with AI
          </Button>
          <Button className="gap-2" onClick={() => setCreateOpen(true)}>
            <Plus className="w-4 h-4" />
            New Question
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center h-48">
          <div className="w-7 h-7 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      ) : questions.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <div className="w-14 h-14 rounded-2xl bg-muted flex items-center justify-center mx-auto mb-4">
              <FileText className="w-7 h-7 text-muted-foreground" />
            </div>
            <p className="font-semibold">No questions yet</p>
            <p className="text-sm text-muted-foreground mt-1 mb-4">
              Create questions manually or generate a batch with AI.
            </p>
            <div className="flex gap-2 justify-center">
              <Button variant="outline" className="gap-2" onClick={() => setAiOpen(true)}>
                <Sparkles className="w-4 h-4" />
                Generate with AI
              </Button>
              <Button className="gap-2" onClick={() => setCreateOpen(true)}>
                <Plus className="w-4 h-4" />
                New Question
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {questions.map((q) => (
            <QuestionCard
              key={q.id}
              q={q}
              onDelete={() => {
                if (confirm('Delete this question?')) deleteMutation.mutate(q.id!)
              }}
            />
          ))}
        </div>
      )}

      {/* Create question dialog */}
      <Dialog open={createOpen} onOpenChange={(o) => { setCreateOpen(o); if (!o) resetCreateForm() }}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>New Question</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            {createError && (
              <div className="text-sm text-destructive bg-destructive/10 rounded-lg px-3 py-2.5">
                {createError}
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Type</Label>
                <Select value={type} onValueChange={(v) => setType(v as typeof type)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="multiple_choice">Multiple Choice</SelectItem>
                    <SelectItem value="word_problem">Word Problem</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Difficulty</Label>
                <Select value={difficulty} onValueChange={(v) => setDifficulty(v as Difficulty)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="easy">Easy</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="hard">Hard</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Question text</Label>
              <Textarea
                value={questionText}
                onChange={(e) => setQuestionText(e.target.value)}
                placeholder="e.g. What is $\frac{1}{2} + \frac{1}{3}$?"
                rows={3}
              />
            </div>

            {type === 'multiple_choice' && (
              <div className="space-y-2">
                <Label>Options</Label>
                {options.map((opt, i) => (
                  <div key={opt.label} className="flex items-center gap-2">
                    <span className="w-5 text-sm font-bold text-muted-foreground">{opt.label}.</span>
                    <Input
                      value={opt.text}
                      onChange={(e) => {
                        const updated = [...options]
                        updated[i] = { ...updated[i], text: e.target.value }
                        setOptions(updated)
                      }}
                      placeholder={`Option ${opt.label}`}
                      className="flex-1"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        const updated = options.map((o, j) => ({ ...o, is_correct: j === i }))
                        setOptions(updated)
                        setAnswer(options[i].text)
                      }}
                      className={cn(
                        'w-5 h-5 rounded-full border-2 flex-shrink-0 transition-all',
                        opt.is_correct ? 'border-emerald-500 bg-emerald-500' : 'border-border hover:border-primary/60'
                      )}
                      title="Mark as correct"
                    />
                  </div>
                ))}
                <p className="text-xs text-muted-foreground">Click the circle to mark the correct answer</p>
              </div>
            )}

            <div className="space-y-1.5">
              <Label>Answer {type === 'multiple_choice' ? '(auto-filled from selection)' : ''}</Label>
              <Input
                value={answer}
                onChange={(e) => setAnswer(e.target.value)}
                placeholder="Correct answer"
                readOnly={type === 'multiple_choice'}
              />
            </div>

            <Button
              className="w-full"
              onClick={handleCreate}
              disabled={createMutation.isPending}
            >
              {createMutation.isPending ? 'Creating…' : 'Create Question'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* AI generate dialog */}
      <Dialog open={aiOpen} onOpenChange={setAiOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="w-4 h-4" />
              Generate with AI
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <p className="text-sm text-muted-foreground">
              Automatically generate a batch of questions using AI. Questions will be added to your bank.
            </p>
            {aiError && (
              <div className="text-sm text-destructive bg-destructive/10 rounded-lg px-3 py-2.5">
                {aiError}
              </div>
            )}

            <div className="space-y-1.5">
              <Label>Topic</Label>
              <Input
                value={aiTopic}
                onChange={(e) => setAiTopic(e.target.value)}
                placeholder="e.g. math, fractions, algebra"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Difficulty</Label>
                <Select value={aiDifficulty} onValueChange={setAiDifficulty}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="mixed">Mixed</SelectItem>
                    <SelectItem value="easy">Easy</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="hard">Hard</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Count (5–50)</Label>
                <Input
                  type="number"
                  min={5}
                  max={50}
                  value={aiCount}
                  onChange={(e) => setAiCount(Math.min(50, Math.max(5, parseInt(e.target.value) || 10)))}
                />
              </div>
            </div>

            <Button
              className="w-full gap-2"
              onClick={handleAiGenerate}
              disabled={aiGenerating}
            >
              <Sparkles className="w-4 h-4" />
              {aiGenerating ? 'Generating… this may take a moment' : `Generate ${aiCount} Questions`}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

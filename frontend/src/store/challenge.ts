'use client'

import { create } from 'zustand'
import type { Question, Difficulty } from '@/types'

export interface ChallengeResult {
  question_text: string
  answer: string
  answer_given: string | null
  is_correct: boolean
  from_assignment: boolean
}

interface ChallengeState {
  difficulty: Difficulty
  questions: Question[]
  selectedAnswers: (string | null)[]
  current: number
  results: ChallengeResult[]
  score: number
  completed: boolean
  total: number
  setDifficulty: (d: Difficulty) => void
  setQuestions: (qs: Question[]) => void
  selectAnswer: (value: string) => void
  goTo: (idx: number) => void
  finish: (results: ChallengeResult[]) => void
  reset: () => void
}

export const useChallengeStore = create<ChallengeState>((set, get) => ({
  difficulty: 'easy',
  questions: [],
  selectedAnswers: [],
  current: 0,
  results: [],
  score: 0,
  completed: false,
  total: 5,

  setDifficulty: (d) => set({ difficulty: d }),

  setQuestions: (qs) =>
    set({
      questions: qs,
      selectedAnswers: new Array(qs.length).fill(null),
      current: 0,
      results: [],
      score: 0,
      completed: false,
    }),

  selectAnswer: (value) => {
    const { current, selectedAnswers } = get()
    const updated = [...selectedAnswers]
    updated[current] = value
    set({ selectedAnswers: updated })
  },

  goTo: (idx) => set({ current: idx }),

  finish: (results) => {
    const score = results.filter((r) => r.is_correct).length
    set({ results, score, completed: true })
  },

  reset: () =>
    set({
      questions: [],
      selectedAnswers: [],
      current: 0,
      results: [],
      score: 0,
      completed: false,
    }),
}))

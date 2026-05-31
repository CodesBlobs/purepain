export interface User {
  id: number
  name: string
  email: string
  account_type: 'student' | 'parent'
  grade_level?: number
}

export interface Question {
  id?: number
  type: 'multiple_choice' | 'word_problem' | 'generated'
  difficulty: 'easy' | 'medium' | 'hard'
  question_text: string
  answer: string
  options?: QuestionOption[]
  from_assignment?: boolean
  assignment_id?: number
  question_id?: number
}

export interface QuestionOption {
  option_label: string
  option_text: string
  is_correct?: number
}

export interface Assignment {
  id: number
  question_id: number
  question_text: string
  type: 'multiple_choice' | 'word_problem'
  difficulty: 'easy' | 'medium' | 'hard'
  answer: string
  status: 'pending' | 'completed'
  due_date?: string
  assigned_at: string
  parent_name: string
  batch_id?: number | null
  batch_correct_required?: number | null
  options?: QuestionOption[]
}

export interface StudentStat {
  total: number
  correct: number
}

export interface Attempt {
  is_correct: boolean
  attempted_at: string
  question_text: string
  difficulty: 'easy' | 'medium' | 'hard'
  answer_given?: string
  answer?: string
}

export interface StudentCard {
  id: number
  name: string
  email: string
  pending_count: number
  completed_count: number
  total_attempts: number
  correct_count: number
}

export type Difficulty = 'easy' | 'medium' | 'hard'

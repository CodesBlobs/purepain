import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function initials(name: string): string {
  return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)
}

export function timeAgo(dateStr: string): string {
  const diff = (Date.now() - new Date(dateStr).getTime()) / 1000
  if (diff < 60) return 'just now'
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  return `${Math.floor(diff / 86400)}d ago`
}

export function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1)
}

export function generateMathQuestion(difficulty: 'easy' | 'medium' | 'hard') {
  const ops = ['+', '-', '*'] as const
  let a: number, b: number, op: '+' | '-' | '*'

  if (difficulty === 'easy') {
    a = Math.floor(Math.random() * 20) + 1
    b = Math.floor(Math.random() * 20) + 1
    op = ops[Math.floor(Math.random() * 2)] as '+' | '-'
    if (op === '-' && b > a) [a, b] = [b, a]
  } else if (difficulty === 'medium') {
    a = Math.floor(Math.random() * 50) + 10
    b = Math.floor(Math.random() * 20) + 1
    op = ops[Math.floor(Math.random() * 3)]
    if (op === '-' && b > a) [a, b] = [b, a]
  } else {
    a = Math.floor(Math.random() * 100) + 20
    b = Math.floor(Math.random() * 50) + 10
    op = ops[Math.floor(Math.random() * 3)]
    if (op === '-' && b > a) [a, b] = [b, a]
  }

  let answer: number
  if (op === '+') answer = a + b
  else if (op === '-') answer = a - b
  else answer = a * b

  const correctStr = answer.toString()
  const wrongs = new Set<string>()
  while (wrongs.size < 3) {
    const offset = Math.floor(Math.random() * 10) + 1
    const wrong = answer + (Math.random() > 0.5 ? offset : -offset)
    if (wrong !== answer) wrongs.add(wrong.toString())
  }

  const allOptions = [correctStr, ...Array.from(wrongs)]
  for (let i = allOptions.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[allOptions[i], allOptions[j]] = [allOptions[j], allOptions[i]]
  }

  const labels = ['A', 'B', 'C', 'D']
  return {
    type: 'generated' as const,
    difficulty,
    question_text: `What is ${a} ${op} ${b}?`,
    answer: correctStr,
    options: allOptions.map((val, i) => ({
      option_label: labels[i],
      option_text: val,
      is_correct: val === correctStr ? 1 : 0,
    })),
  }
}

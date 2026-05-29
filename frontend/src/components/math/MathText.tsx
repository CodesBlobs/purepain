'use client'

import { useEffect, useRef } from 'react'

interface MathTextProps {
  children: string
  className?: string
}

declare global {
  interface Window {
    MathJax?: {
      typesetPromise: (nodes?: Element[]) => Promise<void>
    }
  }
}

export function MathText({ children, className }: MathTextProps) {
  const ref = useRef<HTMLSpanElement>(null)

  useEffect(() => {
    if (!ref.current || !window.MathJax?.typesetPromise) return
    window.MathJax.typesetPromise([ref.current]).catch(() => {})
  }, [children])

  return (
    <span ref={ref} className={className}>
      {children}
    </span>
  )
}

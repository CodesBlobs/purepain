'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Trophy, Star, RotateCcw, Home, CheckCircle2 } from 'lucide-react'
import { useChallengeStore } from '@/store/challenge'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { MathText } from '@/components/math/MathText'

export default function PerfectScorePage() {
  const router = useRouter()
  const store = useChallengeStore()

  useEffect(() => {
    if (!store.completed || store.score !== store.total) {
      router.replace('/student/challenge')
    }
  }, [store.completed, store.score, store.total, router])

  function handleNewChallenge() {
    store.reset()
    router.push('/student/challenge')
  }

  if (!store.completed || store.score !== store.total) return null

  return (
    <div className="max-w-lg mx-auto space-y-6">
      {/* Hero */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-amber-400 via-orange-400 to-rose-500 p-8 text-center text-white shadow-2xl shadow-orange-500/30">
        {/* Background stars */}
        <div className="absolute inset-0 pointer-events-none select-none overflow-hidden">
          {[
            { top: '8%', left: '10%', size: '1.2rem', opacity: 0.5, delay: '0s' },
            { top: '15%', left: '80%', size: '0.8rem', opacity: 0.4, delay: '0.3s' },
            { top: '70%', left: '6%', size: '1rem', opacity: 0.35, delay: '0.6s' },
            { top: '75%', left: '88%', size: '0.9rem', opacity: 0.45, delay: '0.1s' },
            { top: '45%', left: '92%', size: '0.7rem', opacity: 0.3, delay: '0.5s' },
            { top: '50%', left: '3%', size: '0.75rem', opacity: 0.35, delay: '0.8s' },
            { top: '25%', left: '50%', size: '0.6rem', opacity: 0.25, delay: '0.4s' },
          ].map((s, i) => (
            <Star
              key={i}
              fill="white"
              className="absolute animate-pulse"
              style={{
                top: s.top,
                left: s.left,
                width: s.size,
                height: s.size,
                opacity: s.opacity,
                animationDelay: s.delay,
                animationDuration: '2s',
              }}
            />
          ))}
        </div>

        {/* Trophy icon */}
        <div className="relative w-20 h-20 rounded-3xl bg-white/20 backdrop-blur-sm flex items-center justify-center mx-auto mb-5 shadow-lg ring-2 ring-white/30">
          <Trophy className="w-10 h-10 text-white drop-shadow" />
        </div>

        <h1 className="text-3xl font-black tracking-tight drop-shadow">Perfect Score!</h1>
        <p className="text-white/80 mt-1 text-sm font-medium">You got every single one right</p>

        <div className="mt-5 inline-flex items-baseline gap-1">
          <span className="text-6xl font-black drop-shadow">{store.total}</span>
          <span className="text-2xl font-bold text-white/70">/{store.total}</span>
        </div>

        <div className="mt-2">
          <span className="inline-block bg-white/20 backdrop-blur-sm text-white text-sm font-bold px-3 py-1 rounded-full ring-1 ring-white/30">
            100% accuracy
          </span>
        </div>
      </div>

      {/* Answer breakdown */}
      <div className="space-y-2">
        <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wide px-1">
          All Answers
        </p>
        {store.results.map((r, i) => (
          <Card key={i} className="border-emerald-500/30">
            <CardContent className="p-4">
              <div className="flex gap-3">
                <CheckCircle2 className="w-5 h-5 text-emerald-500 flex-shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium leading-snug">
                    <MathText>{r.question_text}</MathText>
                  </p>
                  {r.from_assignment && (
                    <Badge variant="secondary" className="mt-1.5 text-xs">Assigned</Badge>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Actions */}
      <div className="flex flex-col sm:flex-row gap-3">
        <Button
          variant="outline"
          className="flex-1 gap-2"
          onClick={() => router.push('/student/home')}
        >
          <Home className="w-4 h-4" />
          Home
        </Button>
        <Button className="flex-1 gap-2" onClick={handleNewChallenge}>
          <RotateCcw className="w-4 h-4" />
          New Challenge
        </Button>
      </div>
    </div>
  )
}

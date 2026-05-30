import Link from 'next/link'
import {
  Calculator,
  Zap,
  BarChart3,
  Users,
  GraduationCap,
  ArrowRight,
  CheckCircle2,
  Brain,
  Target,
  Trophy,
} from 'lucide-react'
import { Button } from '@/components/ui/button'

const features = [
  {
    icon: Brain,
    title: 'AI-Generated Questions',
    description: 'Fresh, curriculum-aligned problems generated on demand — no two practice sessions are ever the same.',
  },
  {
    icon: Target,
    title: 'Targeted Practice',
    description: 'Students focus on exactly the topics they need, from basic arithmetic to advanced algebra.',
  },
  {
    icon: BarChart3,
    title: 'Progress Tracking',
    description: 'Parents and students see real-time insights into strengths, gaps, and improvement over time.',
  },
  {
    icon: Users,
    title: 'Parent Assignments',
    description: 'Parents create custom assignments and monitor completion without micromanaging homework.',
  },
  {
    icon: Trophy,
    title: 'Challenge Mode',
    description: 'Timed challenges push students to build both accuracy and speed under pressure.',
  },
  {
    icon: Zap,
    title: 'Instant Feedback',
    description: 'Every answer is checked immediately with clear explanations so learning happens in the moment.',
  },
]

const steps = [
  { step: '01', title: 'Create an account', body: 'Sign up as a student or parent in under a minute.' },
  { step: '02', title: 'Choose your topics', body: 'Pick the math topics and grade level that matter most.' },
  { step: '03', title: 'Start practising', body: 'Work through AI-generated questions at your own pace or race the clock.' },
]

const checkpoints = [
  'Grades 1 – 12 curriculum coverage',
  'Unlimited AI-generated questions',
  'Parent dashboard & assignments',
  'Challenge & timed modes',
  'LaTeX-rendered equations',
  'Works on any device',
]

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Nav */}
      <header className="fixed top-0 inset-x-0 z-50 border-b border-border/60 bg-background/80 backdrop-blur-md">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-indigo-700 flex items-center justify-center shadow-sm shadow-primary/40">
              <Calculator className="w-4 h-4 text-white" />
            </div>
            <span className="text-lg font-black tracking-tight">StudyOcean</span>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/auth">
              <Button variant="ghost" size="sm">Sign In</Button>
            </Link>
            <Link href="/auth">
              <Button size="sm">Get Started</Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden pt-32 pb-24 px-6">
        {/* background blobs */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute w-[700px] h-[700px] rounded-full bg-primary/8 -top-64 -right-48 blur-3xl" />
          <div className="absolute w-[500px] h-[500px] rounded-full bg-indigo-500/8 -bottom-32 -left-32 blur-3xl" />
        </div>

        <div className="relative max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-primary/20 bg-primary/6 text-primary text-sm font-semibold mb-8">
            <Zap className="w-3.5 h-3.5" />
            AI-powered math practice
          </div>

          <h1 className="text-5xl sm:text-6xl md:text-7xl font-black tracking-tight leading-[1.05] mb-6">
            Master math with{' '}
            <span className="bg-gradient-to-r from-primary to-indigo-500 bg-clip-text text-transparent">
              AI-powered learning
            </span>
          </h1>

          <p className="text-lg sm:text-xl text-muted-foreground max-w-2xl mx-auto mb-10 leading-relaxed">
            StudyOcean delivers unlimited AI-generated maths problems tailored to your grade level.
            Build fluency, track progress, and conquer exams with adaptive learning.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link href="/auth">
              <Button size="lg" className="text-base px-8 shadow-lg shadow-primary/30 hover:shadow-primary/50 transition-shadow">
                Start practising free
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </Link>
            <Link href="/auth?tab=register&role=parent">
              <Button variant="outline" size="lg" className="text-base px-8">
                I&apos;m a parent
              </Button>
            </Link>
          </div>

          {/* Social proof strip */}
          <div className="mt-14 flex flex-wrap items-center justify-center gap-x-8 gap-y-3 text-sm text-muted-foreground">
            {checkpoints.map((c) => (
              <span key={c} className="flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-primary flex-shrink-0" />
                {c}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-24 px-6 bg-secondary/40">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-black mb-4">Everything students (and parents) need</h2>
            <p className="text-muted-foreground text-lg max-w-xl mx-auto">
              One platform for practice, assignments, and growth — no subscriptions to juggle.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map(({ icon: Icon, title, description }) => (
              <div
                key={title}
                className="bg-card rounded-2xl border border-border p-6 hover:border-primary/30 hover:shadow-md hover:shadow-primary/5 transition-all group"
              >
                <div className="w-11 h-11 rounded-xl bg-primary/10 flex items-center justify-center mb-4 group-hover:bg-primary/15 transition-colors">
                  <Icon className="w-5 h-5 text-primary" />
                </div>
                <h3 className="font-bold text-base mb-2">{title}</h3>
                <p className="text-muted-foreground text-sm leading-relaxed">{description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="py-24 px-6">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-black mb-4">Up and running in 3 steps</h2>
            <p className="text-muted-foreground text-lg max-w-xl mx-auto">
              No complicated setup. Just sign up and start sweating through problems.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {steps.map(({ step, title, body }) => (
              <div key={step} className="relative text-center">
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-primary to-indigo-700 flex items-center justify-center mx-auto mb-5 shadow-lg shadow-primary/30">
                  <span className="text-white font-black text-lg">{step}</span>
                </div>
                <h3 className="font-bold text-lg mb-2">{title}</h3>
                <p className="text-muted-foreground text-sm leading-relaxed">{body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Dual CTA */}
      <section className="py-24 px-6 bg-gradient-to-br from-indigo-700 via-primary to-violet-600 relative overflow-hidden">
        <div className="absolute w-[500px] h-[500px] rounded-full bg-white/5 -top-48 -right-32 pointer-events-none" />
        <div className="absolute w-[300px] h-[300px] rounded-full bg-white/5 -bottom-24 -left-16 pointer-events-none" />

        <div className="relative max-w-4xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Student card */}
          <div className="bg-white/10 backdrop-blur-sm rounded-2xl border border-white/20 p-8 text-white">
            <div className="w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center mb-5">
              <GraduationCap className="w-6 h-6 text-white" />
            </div>
            <h3 className="text-2xl font-black mb-3">I&apos;m a student</h3>
            <p className="text-white/70 text-sm mb-6 leading-relaxed">
              Sharpen your skills with unlimited practice, challenge modes, and instant feedback on every answer.
            </p>
            <Link href="/auth">
              <Button className="bg-white text-primary hover:bg-white/90 font-bold w-full">
                Start practising
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </Link>
          </div>

          {/* Parent card */}
          <div className="bg-white/10 backdrop-blur-sm rounded-2xl border border-white/20 p-8 text-white">
            <div className="w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center mb-5">
              <Users className="w-6 h-6 text-white" />
            </div>
            <h3 className="text-2xl font-black mb-3">I&apos;m a parent</h3>
            <p className="text-white/70 text-sm mb-6 leading-relaxed">
              Create assignments, monitor your child&apos;s progress, and ensure they&apos;re mastering the right topics.
            </p>
            <Link href="/auth?tab=register&role=parent">
              <Button className="bg-white text-primary hover:bg-white/90 font-bold w-full">
                Set up for my child
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-10 px-6 border-t border-border">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-md bg-gradient-to-br from-primary to-indigo-700 flex items-center justify-center">
              <Calculator className="w-3 h-3 text-white" />
            </div>
            <span className="font-bold text-foreground">StudyOcean</span>
            <span>· AI-Powered Math Learning</span>
          </div>
          <span>© {new Date().getFullYear()} StudyOcean. All rights reserved.</span>
        </div>
      </footer>
    </div>
  )
}

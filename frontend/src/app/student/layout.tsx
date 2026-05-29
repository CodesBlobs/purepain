import { AppLayout } from '@/components/layout/AppLayout'

export default function StudentLayout({ children }: { children: React.ReactNode }) {
  return <AppLayout requiredRole="student">{children}</AppLayout>
}

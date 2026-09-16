import { AnimatedLogo } from '@/components/ui/animated-logo'
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/logo')({
  component: RouteComponent,
})

function RouteComponent() {
  return <div className='flex h-screen items-center justify-center'>
    <AnimatedLogo />
  </div>
}

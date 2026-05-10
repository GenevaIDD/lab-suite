import { Link } from 'react-router-dom'
import { Card, CardContent } from '@/components/ui/card'
import { buttonVariants } from '@/components/ui/button'
import { Construction, ArrowLeft } from 'lucide-react'
import { cn } from '@/lib/utils'

interface ComingSoonProps {
  title: string
  backTo: string
  backLabel: string
}

export function ComingSoon({ title, backTo, backLabel }: ComingSoonProps) {
  return (
    <Card>
      <CardContent className="flex flex-col items-center gap-4 py-16 text-center">
        <Construction className="h-12 w-12 text-muted-foreground/40" />
        <div>
          <h2 className="text-lg font-semibold">{title}</h2>
          <p className="text-sm text-muted-foreground mt-1">
            This form hasn't been built yet — it's the next thing on the list.
          </p>
        </div>
        <Link to={backTo} className={cn(buttonVariants({ variant: 'outline', size: 'sm' }))}>
          <ArrowLeft className="h-4 w-4 mr-1" />
          {backLabel}
        </Link>
      </CardContent>
    </Card>
  )
}

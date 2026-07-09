'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  type CarouselApi,
} from '@/components/ui/carousel'
import { Button } from '@/components/ui/button'
import { ArrowRight, Shield, FileText, MessageSquare, Upload } from 'lucide-react'

const SLIDES = [
  {
    icon: Shield,
    title: 'Secure client portal',
    description:
      'Post-meeting client communication and requirement gathering — all in one place, with audit trails.',
    stat: '256-bit encrypted',
  },
  {
    icon: FileText,
    title: 'Smart form submissions',
    description:
      'Dynamic intake forms that adapt to your workflows. Clients submit, your team reviews, decisions are tracked.',
    stat: 'Custom form builder',
  },
  {
    icon: MessageSquare,
    title: 'Structured conversations',
    description:
      'Every message tied to a submission or client. Internal notes stay internal. Clients see what they need.',
    stat: 'Threaded comments',
  },
  {
    icon: Upload,
    title: 'File sharing with integrity',
    description:
      'Upload proofs, deliverables, and supporting docs. Magic-byte validation blocks spoofed files at upload time.',
    stat: 'SHA-256 verified',
  },
]

export function HeroCarousel() {
  const [api, setApi] = useState<CarouselApi | null>(null)
  const [current, setCurrent] = useState(0)
  const [count, setCount] = useState(0)

  useEffect(() => {
    if (!api) return
    const onSelect = () => setCurrent(api.selectedScrollSnap() + 1)
    api.on('select', onSelect)
    return () => { api.off('select', onSelect) }
  }, [api])

  useEffect(() => {
    if (!api) return
    const t = setInterval(() => {
      api.scrollNext()
    }, 5000)
    return () => clearInterval(t)
  }, [api])

  const goTo = useCallback((index: number) => api?.scrollTo(index), [api])

  return (
    <section className="relative overflow-hidden bg-gradient-to-b from-background to-muted/30">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 pt-20 pb-16 sm:pt-28 sm:pb-20">
        <Carousel
          setApi={(carouselApi) => {
            setApi(carouselApi)
            if (carouselApi) {
              setCount(carouselApi.scrollSnapList().length)
              setCurrent(carouselApi.selectedScrollSnap() + 1)
            }
          }}
          opts={{ loop: true, align: 'center' }}
          className="w-full"
        >
          <CarouselContent>
            {SLIDES.map((slide) => {
              const Icon = slide.icon
              return (
                <CarouselItem key={slide.title}>
                  <div className="flex flex-col items-center text-center px-2">
                    <div className="mb-6 flex size-16 items-center justify-center rounded-xl border bg-card shadow-sm">
                      <Icon className="size-8 text-primary" />
                    </div>
                    <h1 className="text-4xl font-heading tracking-wide sm:text-5xl lg:text-6xl text-balance max-w-3xl">
                      {slide.title}
                    </h1>
                    <p className="mt-4 text-base sm:text-lg text-muted-foreground text-balance max-w-xl">
                      {slide.description}
                    </p>
                    <div className="mt-2 text-xs font-medium text-primary uppercase tracking-wider">
                      {slide.stat}
                    </div>
                    <div className="mt-8 flex flex-col sm:flex-row items-center gap-3">
                      <Button size="lg" asChild>
                        <Link href="/login">
                          Get started
                          <ArrowRight className="ml-2 size-4" />
                        </Link>
                      </Button>
                      <Button size="lg" variant="outline" asChild>
                        <Link href="/login">
                          Sign in
                        </Link>
                      </Button>
                    </div>
                  </div>
                </CarouselItem>
              )
            })}
          </CarouselContent>
        </Carousel>

        <div className="mt-8 flex items-center justify-center gap-2">
          {Array.from({ length: count }).map((_, i) => (
            <button
              key={i}
              type="button"
              onClick={() => goTo(i)}
              className={`h-2 rounded-full transition-all ${
                i === current - 1 ? 'w-8 bg-primary' : 'w-2 bg-muted-foreground/30'
              }`}
              aria-label={`Go to slide ${i + 1}`}
            />
          ))}
        </div>
      </div>
    </section>
  )
}

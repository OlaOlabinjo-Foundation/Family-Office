import { useState } from 'react'
import { motion, useReducedMotion } from 'framer-motion'

type FamilyWelcomeHeroProps = {
  title: string
  subtitle: string
  /** Defaults to `VITE_CHAIRMAN_IMAGE_URL` or bundled `/branding/chairman-portal.png` */
  portraitSrc?: string
  /** `stacked` = full-width text then portrait (principal overview); `split` = side-by-side on xl+ */
  layout?: 'split' | 'stacked'
}

/**
 * Principal-facing welcome on the Command Centre. Portrait defaults to
 * `client/public/branding/chairman-portal.png` (family “about us” image). Override with `VITE_CHAIRMAN_IMAGE_URL`.
 */
export function FamilyWelcomeHero({
  title,
  subtitle,
  portraitSrc,
  layout = 'split',
}: FamilyWelcomeHeroProps) {
  const reduceMotion = useReducedMotion()
  const env = typeof import.meta.env.VITE_CHAIRMAN_IMAGE_URL === 'string' ? import.meta.env.VITE_CHAIRMAN_IMAGE_URL.trim() : ''
  const resolvedSrc = portraitSrc ?? (env || '/branding/chairman-portal.png')
  const [portraitVisible, setPortraitVisible] = useState(true)
  const stacked = layout === 'stacked'

  const portraitBlock = portraitVisible ? (
    <div
      className={
        stacked
          ? 'flex justify-center pt-6'
          : 'shrink-0 flex justify-center xl:justify-end w-full max-w-[280px] mx-auto xl:mx-0 xl:w-[280px]'
      }
    >
      <figure className="relative w-full max-w-[280px]">
        <div
          className="pointer-events-none absolute -inset-2 rounded-[1.35rem] bg-gradient-to-br from-fo-gold/20 via-transparent to-fo-gold/5 blur-xl opacity-80"
          aria-hidden
        />
        <div className="relative overflow-hidden rounded-2xl border border-fo-gold/30 bg-fo-panel shadow-2xl shadow-black/60 aspect-[4/5] w-full ring-1 ring-white/[0.06]">
          <img
            src={resolvedSrc}
            alt="Family office — leadership and stewardship"
            className="h-full w-full object-cover object-[center_22%]"
            loading="eager"
            decoding="async"
            onError={() => setPortraitVisible(false)}
          />
          <figcaption className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black via-black/55 to-transparent px-4 pt-10 pb-3.5 text-left">
            <span className="text-[10px] uppercase tracking-[0.22em] text-fo-gold-soft/95">Stewardship & trust</span>
          </figcaption>
        </div>
      </figure>
    </div>
  ) : null

  return (
    <motion.section
      initial={reduceMotion ? { opacity: 1, y: 0 } : { opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: reduceMotion ? 0 : 0.4 }}
      className="overflow-hidden rounded-3xl border border-fo-border/90 bg-gradient-to-br from-fo-graphite via-fo-black to-fo-black shadow-[0_1px_0_0_rgba(200,135,36,0.14),0_24px_48px_-24px_rgba(0,0,0,0.7)]"
      aria-labelledby="command-centre-hero-title"
    >
      <div
        className={
          stacked
            ? 'flex flex-col gap-6 p-6 md:p-8'
            : 'flex flex-col xl:flex-row xl:items-center gap-6 md:gap-8 p-6 md:p-8 lg:p-10'
        }
      >
        <div className={stacked ? 'w-full min-w-0 space-y-4' : 'min-w-0 flex-1 basis-0 space-y-4 md:space-y-5'}>
          <p className="text-[10px] uppercase tracking-[0.38em] text-fo-gold/90">Family office view</p>
          <h1
            id="command-centre-hero-title"
            className="font-[family-name:var(--font-display)] text-2xl sm:text-3xl md:text-4xl lg:text-[2.65rem] text-white leading-[1.12] tracking-tight"
          >
            {title}
          </h1>
          <p
            className={`text-sm md:text-[0.95rem] text-zinc-400 leading-relaxed break-words ${stacked ? 'max-w-none' : 'max-w-2xl'}`}
          >
            {subtitle}
          </p>
        </div>
        {portraitBlock}
      </div>
    </motion.section>
  )
}


interface LetterHeroProps {
  letter: string | null
  /** True when no answers were left for the true last letter, so we fell back (e.g. second-to-last). */
  expandedFromLast?: boolean
}

export function LetterHero({ letter, expandedFromLast }: LetterHeroProps) {
  const display = letter ? letter.toUpperCase() : '…'
  return (
    <div className="relative flex flex-col items-center">
      <p className="mb-2 text-xs uppercase tracking-[0.25em] text-cyan-200/60">
        Next must start with
      </p>
      <div
        key={letter ?? 'any'}
        className="letter-pop flex h-28 w-28 items-center justify-center rounded-3xl border border-cyan-400/40 bg-gradient-to-br from-cyan-500/30 to-emerald-500/20 text-6xl font-bold text-white shadow-[0_0_40px_rgba(34,211,238,0.35)] md:h-32 md:w-32 md:text-7xl"
      >
        {letter ? display : '★'}
      </div>
      {expandedFromLast && letter && (
        <p className="mt-2 max-w-[16rem] text-center text-xs text-teal-200/75">
          Nothing unused started with the last letter — using an earlier letter from the previous
          name instead.
        </p>
      )}
      {!letter && (
        <p className="mt-2 text-center text-xs text-slate-400">First go — any letter works.</p>
      )}
    </div>
  )
}

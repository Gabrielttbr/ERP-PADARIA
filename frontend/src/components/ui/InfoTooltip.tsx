import { useEffect, useId, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'

const GAP = 8
const MARGIN = 8

/**
 * Ícone "i" que exibe uma descrição ao passar o mouse, focar via teclado ou tocar.
 * Renderizado em portal com posição fixa para não ser cortado por containers com overflow-hidden.
 */
export function InfoTooltip({ text, label = 'O que é isto?' }: { text: ReactNode; label?: string }) {
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null)
  const btnRef = useRef<HTMLButtonElement>(null)
  const tipRef = useRef<HTMLDivElement>(null)
  const id = useId()

  useLayoutEffect(() => {
    if (!open) { setPos(null); return }
    const btn = btnRef.current
    const tip = tipRef.current
    if (!btn || !tip) return
    const r = btn.getBoundingClientRect()
    const w = tip.offsetWidth
    const h = tip.offsetHeight
    const left = Math.min(Math.max(r.left + r.width / 2 - w / 2, MARGIN), window.innerWidth - w - MARGIN)
    let top = r.top - h - GAP
    if (top < MARGIN) top = r.bottom + GAP
    setPos({ top, left })
  }, [open])

  useEffect(() => {
    if (!open) return
    const close = () => setOpen(false)
    window.addEventListener('scroll', close, true)
    window.addEventListener('resize', close)
    return () => {
      window.removeEventListener('scroll', close, true)
      window.removeEventListener('resize', close)
    }
  }, [open])

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        aria-label={label}
        aria-describedby={open ? id : undefined}
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onClick={() => setOpen(true)}
        onKeyDown={e => { if (e.key === 'Escape') setOpen(false) }}
        className="inline-flex items-center justify-center w-4 h-4 rounded-full shrink-0 cursor-help transition-colors focus:outline-none focus-visible:ring-2"
        style={{ color: open ? 'var(--clr-text)' : 'var(--clr-text-muted)' }}
      >
        <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
          <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a.75.75 0 000 1.5h.253a.25.25 0 01.244.304l-.459 2.066A1.75 1.75 0 0010.747 15H11a.75.75 0 000-1.5h-.253a.25.25 0 01-.244-.304l.459-2.066A1.75 1.75 0 009.253 9H9z" clipRule="evenodd" />
        </svg>
      </button>
      {open && createPortal(
        <div
          ref={tipRef}
          id={id}
          role="tooltip"
          className="fixed z-50 px-3 py-2 rounded-lg text-xs leading-relaxed font-normal normal-case tracking-normal shadow-xl pointer-events-none"
          style={{
            top: pos?.top ?? -9999,
            left: pos?.left ?? -9999,
            maxWidth: 260,
            background: '#1F2937',
            color: '#F9FAFB',
          }}
        >
          {text}
        </div>,
        document.body,
      )}
    </>
  )
}

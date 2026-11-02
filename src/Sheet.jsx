import { useEffect, useRef } from 'react'

const FOC = 'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])'

// Accessible dialog: role, labelled by its heading, focus moves in, Tab stays inside, Escape closes, focus goes back.
export function Sheet({ open, onClose, alert, children }) {
  const ref = useRef(null)
  const prev = useRef(null)
  const close = useRef(onClose)
  close.current = onClose
  useEffect(() => {
    if (!open) return undefined
    const p = ref.current
    prev.current = document.activeElement
    const h = p.querySelector('h2')
    if (h) { h.id = h.id || 'dlg-title'; p.setAttribute('aria-labelledby', h.id) } else p.setAttribute('aria-label', 'Dialog')
    ;(p.querySelector('input,select,textarea') || p.querySelector(FOC) || p).focus()
    const key = (e) => {
      if (e.key === 'Escape') { e.stopPropagation(); close.current(); return }
      if (e.key !== 'Tab') return
      const f = [...p.querySelectorAll(FOC)].filter((x) => x.offsetParent !== null)
      if (!f.length) { e.preventDefault(); return }
      const a = f[0], z = f[f.length - 1]
      if (e.shiftKey && document.activeElement === a) { e.preventDefault(); z.focus() }
      else if (!e.shiftKey && document.activeElement === z) { e.preventDefault(); a.focus() }
    }
    document.addEventListener('keydown', key)
    return () => { document.removeEventListener('keydown', key); if (prev.current && prev.current.focus) prev.current.focus() }
  }, [open])
  return (
    <div className={'sheet' + (open ? ' show' : '')} onClick={onClose} aria-hidden={!open}>
      <div ref={ref} className="panel" role={alert ? 'alertdialog' : 'dialog'} aria-modal="true" tabIndex={-1} onClick={(e) => e.stopPropagation()}>{open && children}</div>
    </div>
  )
}

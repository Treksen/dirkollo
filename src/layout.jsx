import { useEffect, useState } from 'react'

const Q = '(min-width:1000px)'
// true on desktop-size screens. Phones and tablets keep the card design.
export function useDesktop() {
  const [on, setOn] = useState(() => matchMedia(Q).matches)
  useEffect(() => {
    const mq = matchMedia(Q), f = () => setOn(mq.matches)
    mq.addEventListener('change', f)
    return () => mq.removeEventListener('change', f)
  }, [])
  return on
}

// Left menu used by Settings and Admin on desktop
export function SideNav({ items, value, onChange, label }) {
  return (
    <nav className="snav" aria-label={label}>
      {items.map(([k, l]) => <button key={k} className={value === k ? 'on' : ''} aria-current={value === k ? 'page' : undefined} onClick={() => onChange(k)}>{l}</button>)}
    </nav>
  )
}

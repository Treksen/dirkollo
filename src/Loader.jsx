export function Loader({ label = 'Loading' }) {
  return (
    <div className="ldr" role="status" aria-live="polite">
      <svg width="150" height="150" viewBox="-33 -33 130 130" aria-hidden="true">
        <circle className="ldr-r" cx="32" cy="32" r="31" fill="none" stroke="#f59a1f" strokeWidth="2.5" />
        <circle className="ldr-r ldr-d" cx="32" cy="32" r="31" fill="none" stroke="#f59a1f" strokeWidth="2.5" />
        <g className="ldr-b">
          <circle cx="32" cy="32" r="31" fill="#f59a1f" />
          <rect x="14" y="22" width="36" height="26" rx="5" fill="#4b22b0" />
          <rect x="21" y="17" width="12" height="7" rx="2" fill="#4b22b0" />
          <rect x="40" y="25" width="6" height="3" rx="1.5" fill="#f59a1f" />
          <circle cx="32" cy="36" r="9" fill="#fff" />
          <circle cx="32" cy="36" r="5.5" fill="#4b22b0" />
          <circle cx="30" cy="34" r="1.6" fill="#fff" />
        </g>
      </svg>
      <span className="ldr-t">{label}</span>
    </div>
  )
}

// Links every <label> to the form control right after it (so screen readers and tapping a label work).
let n = 0
export function linkLabels(root = document) {
  root.querySelectorAll('label:not([for])').forEach((l) => {
    if (l.querySelector('input,select,textarea')) return
    const el = l.nextElementSibling
    if (el && /^(INPUT|SELECT|TEXTAREA)$/.test(el.tagName)) {
      if (!el.id) el.id = 'fld' + ++n
      l.htmlFor = el.id
    }
  })
}
export function installA11y() {
  linkLabels()
  let t
  const mo = new MutationObserver(() => { clearTimeout(t); t = setTimeout(() => linkLabels(), 50) })
  mo.observe(document.body, { childList: true, subtree: true })
  return () => mo.disconnect()
}

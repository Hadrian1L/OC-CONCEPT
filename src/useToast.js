import { useCallback } from 'react'

export function useToast() {
  const show = useCallback((msg) => {
    let el = document.getElementById('toast')
    if (!el) {
      el = document.createElement('div')
      el.id = 'toast'
      document.body.appendChild(el)
    }
    el.textContent = msg
    el.classList.add('show')
    clearTimeout(el._t)
    el._t = setTimeout(() => el.classList.remove('show'), 2600)
  }, [])
  return show
}

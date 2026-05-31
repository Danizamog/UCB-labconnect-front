import { useEffect, useState } from 'react'
import { ChevronUp } from 'lucide-react'
import './ScrollToTopButton.css'

const DEFAULT_SCROLL_THRESHOLD = 280

function ScrollToTopButton({ scrollContainerRef, threshold = DEFAULT_SCROLL_THRESHOLD, enabled = true }) {
  const [isVisible, setIsVisible] = useState(false)

  useEffect(() => {
    if (!enabled) {
      setIsVisible(false)
      return undefined
    }

    const container = scrollContainerRef?.current

    const handleScroll = () => {
      const containerScrollTop = container?.scrollTop || 0
      const pageScrollTop = window.scrollY || document.documentElement.scrollTop || 0
      setIsVisible(Math.max(containerScrollTop, pageScrollTop) > threshold)
    }

    handleScroll()
    container?.addEventListener('scroll', handleScroll, { passive: true })
    window.addEventListener('scroll', handleScroll, { passive: true })

    return () => {
      container?.removeEventListener('scroll', handleScroll)
      window.removeEventListener('scroll', handleScroll)
    }
  }, [enabled, scrollContainerRef, threshold])

  const handleScrollToTop = () => {
    scrollContainerRef?.current?.scrollTo({ top: 0, behavior: 'smooth' })
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  if (!enabled) {
    return null
  }

  return (
    <button
      type="button"
      className={`scroll-to-top-button${isVisible ? ' is-visible' : ''}`}
      onClick={handleScrollToTop}
      aria-label="Volver al inicio de la pagina"
      title="Volver arriba"
    >
      <ChevronUp size={20} />
    </button>
  )
}

export default ScrollToTopButton
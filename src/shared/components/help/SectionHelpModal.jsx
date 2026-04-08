import { useEffect, useMemo, useState } from 'react'
import { Search } from 'lucide-react'
import './SectionHelpModal.css'

function SectionHelpModal({ isOpen = false, title = 'Ayuda', description = '', questions = [], onClose }) {
  const [expandedItems, setExpandedItems] = useState({})
  const [searchQuery, setSearchQuery] = useState('')
  const [isSearchOpen, setIsSearchOpen] = useState(false)

  const normalizedQuestions = useMemo(
    () => (Array.isArray(questions) ? questions : []),
    [questions],
  )

  const normalizedSearchQuery = useMemo(
    () => String(searchQuery || '').trim().toLowerCase(),
    [searchQuery],
  )

  const filteredQuestions = useMemo(() => {
    if (!normalizedSearchQuery) {
      return normalizedQuestions
    }

    return normalizedQuestions.filter((item) => {
      const question = String(item?.question || '').toLowerCase()
      const answer = String(item?.answer || '').toLowerCase()
      return question.includes(normalizedSearchQuery) || answer.includes(normalizedSearchQuery)
    })
  }, [normalizedQuestions, normalizedSearchQuery])

  useEffect(() => {
    if (!isOpen) {
      return undefined
    }

    const handleEscape = (event) => {
      if (event.key === 'Escape') {
        onClose?.()
      }
    }

    window.addEventListener('keydown', handleEscape)
    return () => window.removeEventListener('keydown', handleEscape)
  }, [isOpen, onClose])

  useEffect(() => {
    if (!isOpen) {
      return
    }
    setExpandedItems({})
    setSearchQuery('')
    setIsSearchOpen(false)
  }, [isOpen, title])

  if (!isOpen) {
    return null
  }

  const toggleItem = (questionKey) => {
    setExpandedItems((previous) => ({ ...previous, [questionKey]: !previous[questionKey] }))
  }

  const isItemExpanded = (questionKey) => Boolean(expandedItems[questionKey])

  return (
    <div className="section-help-backdrop" onClick={onClose} role="dialog" aria-modal="true">
      <section className="section-help-modal" onClick={(event) => event.stopPropagation()}>
        <header className="section-help-header">
          <div>
            <p className="section-help-kicker">Centro de ayuda</p>
            <h3>{title}</h3>
            {description ? <p>{description}</p> : null}
          </div>
          <div className="section-help-header-actions">
            <button type="button" className="section-help-close" onClick={onClose} aria-label="Cerrar ayuda">
              x
            </button>
          </div>
        </header>

        <div className={`section-help-search-shell ${isSearchOpen || normalizedSearchQuery ? 'is-open' : ''}`}>
          <button
            type="button"
            className="section-help-search-trigger"
            aria-label="Buscar preguntas"
            onClick={() => setIsSearchOpen((previous) => !previous)}
          >
            <Search size={16} />
          </button>
          <input
            type="search"
            className="section-help-search"
            placeholder="Buscar pregunta o respuesta..."
            value={searchQuery}
            onFocus={() => setIsSearchOpen(true)}
            onBlur={() => {
              if (!String(searchQuery || '').trim()) {
                setIsSearchOpen(false)
              }
            }}
            onChange={(event) => setSearchQuery(event.target.value)}
          />
        </div>

        <div className="section-help-list">
          {filteredQuestions.map((item, index) => (
            <article key={`${item.question}-${index}`} className="section-help-item">
              <button
                type="button"
                className="section-help-question-toggle"
                onClick={() => toggleItem(item.question)}
                aria-expanded={isItemExpanded(item.question)}
              >
                <h4>{item.question}</h4>
                <span>{isItemExpanded(item.question) ? '-' : '+'}</span>
              </button>
              {isItemExpanded(item.question) ? (
                <p>{item.answer}</p>
              ) : null}
            </article>
          ))}
          {normalizedQuestions.length === 0 ? (
            <article className="section-help-item">
              <h4>Sin contenido de ayuda</h4>
              <p>No hay preguntas registradas para esta seccion.</p>
            </article>
          ) : null}
          {normalizedQuestions.length > 0 && filteredQuestions.length === 0 ? (
            <article className="section-help-item">
              <h4>Sin coincidencias</h4>
              <p>No se encontraron preguntas para "{searchQuery}".</p>
            </article>
          ) : null}
        </div>

        <div className="section-help-actions">
          <button type="button" className="section-help-primary" onClick={onClose}>
            Entendido
          </button>
        </div>
      </section>
    </div>
  )
}

export default SectionHelpModal

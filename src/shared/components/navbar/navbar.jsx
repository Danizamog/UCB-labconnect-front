import { useMemo, useState } from 'react'
import {
  AlertOctagon,
  BarChart3,
  BookOpenCheck,
  CalendarPlus,
  ClipboardList,
  FlaskConical,
  House,
  Layers,
  LogOut,
  Menu,
  Search,
  MonitorCog,
  Map,
  Package,
  Users,
  UserRound,
  X,
} from 'lucide-react'
import { NAVIGATION_LINKS } from '../../config/navigationLinks'
import { hasAnyPermission } from '../../lib/permissions'
import ucbShieldLogo from '../../../assets/branding/ucb-san-pablo-escudo.png'
import './navbar.css'

const iconMap = {
  home: House,
  admin_reservas: Users,
  analytics: BarChart3,
  profiles: UserRound,
  roles: Users,
  penalties: AlertOctagon,
  areas: Layers,
  laboratorios: FlaskConical,
  equipos: MonitorCog,
  materiales: Package,
  calendar: Layers,
  tutorials_manage: CalendarPlus,
  tutorials_public: BookOpenCheck,
  reserve: FlaskConical,
  reserve_history: ClipboardList,
  mapa: Map,
  logout: LogOut,
}

const NAV_GROUP_ORDER = ['General', 'Gestion academica', 'Gestion operativa', 'Estudiantes']

const NAV_SEARCH_META = {
  home: { group: 'General', aliases: ['inicio', 'panel', 'principal'] },
  mapa: { group: 'General', aliases: ['mapa', 'campus', 'ubicacion'] },
  admin_reservas: { group: 'Gestion operativa', aliases: ['reservas', 'admin', 'laboratorio'] },
  analytics: { group: 'Gestion operativa', aliases: ['analisis', 'estadisticas', 'ocupacion', 'uso laboratorios'] },
  tutorials_manage: { group: 'Gestion academica', aliases: ['tutorias', 'publicar', 'sesiones'] },
  profiles: { group: 'Gestion academica', aliases: ['perfiles', 'usuarios', 'cuentas'] },
  roles: { group: 'Gestion academica', aliases: ['roles', 'permisos', 'accesos'] },
  penalties: { group: 'Gestion operativa', aliases: ['penalizaciones', 'sanciones'] },
  areas: { group: 'Gestion operativa', aliases: ['areas', 'bloques'] },
  laboratorios: { group: 'Gestion operativa', aliases: ['laboratorios', 'espacios'] },
  equipos: { group: 'Gestion operativa', aliases: ['equipos', 'inventario', 'mantenimiento'] },
  materiales: { group: 'Gestion operativa', aliases: ['materiales', 'reactivos', 'stock'] },
  calendar: { group: 'Estudiantes', aliases: ['calendario', 'disponibilidad', 'horarios'] },
  tutorials_public: { group: 'Estudiantes', aliases: ['tutorias', 'inscripcion'] },
  reserve_reactivos: { group: 'Estudiantes', aliases: ['reactivos', 'reservar', 'materiales'] },
  reserve: { group: 'Estudiantes', aliases: ['reservar', 'laboratorio', 'nueva reserva'] },
  reserve_history: { group: 'Estudiantes', aliases: ['historial', 'mis reservas', 'reservas pasadas', 'laboratorios usados'] },
}

const NAV_SUBSECTIONS_META = {
  home: [
    { id: 'accesos-institucionales', label: 'Accesos institucionales', aliases: ['portal ucb', 'siaan', 'lms'] },
    { id: 'acceso-rapido', label: 'Acceso rapido', aliases: ['atajos', 'quick access'] },
    { id: 'ucb-vistazo', label: 'UCB en un vistazo', aliases: ['resumen', 'informacion'] },
  ],
  profiles: [
    { id: 'perfiles-institucionales', label: 'Perfiles institucionales', aliases: ['usuarios', 'perfiles'] },
    { id: 'directorio-institucional', label: 'Directorio institucional', aliases: ['buscar usuario', 'lista usuarios'] },
    { id: 'editar-perfil', label: 'Editar perfil', aliases: ['actualizar perfil', 'reactivar cuenta'] },
  ],
  roles: [
    { id: 'administracion-roles', label: 'Administracion de roles', aliases: ['roles', 'gestion roles'] },
    { id: 'crear-editar-rol', label: 'Crear o editar rol', aliases: ['nuevo rol', 'formulario rol'] },
    { id: 'seleccionar-permisos', label: 'Seleccionar permisos', aliases: ['permisos', 'accesos'] },
    { id: 'confirmar-eliminacion', label: 'Confirmar eliminacion', aliases: ['eliminar rol'] },
  ],
  penalties: [
    { id: 'acciones-rapidas', label: 'Acciones rapidas', aliases: ['sanciones', 'penalizaciones'] },
    { id: 'historial-disciplinario', label: 'Historial disciplinario', aliases: ['historial', 'infracciones'] },
  ],
  areas: [
    { id: 'areas-academicas', label: 'Areas academicas', aliases: ['areas'] },
    { id: 'identificacion', label: 'Identificacion', aliases: ['datos del area', 'nombre del area'] },
    { id: 'configuracion', label: 'Configuracion', aliases: ['estado', 'ajustes'] },
  ],
  laboratorios: [
    { id: 'laboratorios-listado', label: 'Laboratorios', aliases: ['lista laboratorios'] },
    { id: 'identificacion-area', label: 'Identificacion y area', aliases: ['datos laboratorio'] },
    { id: 'ubicacion-capacidad', label: 'Ubicacion y capacidad', aliases: ['aforo', 'ubicacion'] },
    { id: 'configuracion-lab', label: 'Configuracion', aliases: ['ajustes laboratorio'] },
  ],
  equipos: [
    { id: 'acciones-equipos', label: 'Que necesitas hacer ahora?', aliases: ['acciones rapidas', 'atajos equipos'] },
    { id: 'catalogo-equipos', label: 'Catalogo de equipos', aliases: ['inventario equipos'] },
    { id: 'mantenimiento-dano', label: 'Registrar mantenimiento o dano', aliases: ['ticket', 'incidencia tecnica'] },
    { id: 'tickets-activos', label: 'Tickets activos', aliases: ['soporte', 'incidencias'] },
    { id: 'prestamos-equipos', label: 'Prestamos de equipos', aliases: ['devoluciones', 'salidas'] },
    { id: 'prestamos-activos', label: 'Prestamos activos', aliases: ['equipos prestados'] },
    { id: 'inventario-detallado', label: 'Inventario detallado', aliases: ['lista equipos', 'estado equipos', 'equipos'] },
  ],
  materiales: [
    { id: 'materiales-listos', label: 'Materiales listos para practicas', aliases: ['insumos disponibles'] },
    { id: 'materiales-reactivos', label: 'Materiales y reactivos', aliases: ['catalogo materiales'] },
    { id: 'movimientos-stock', label: 'Movimientos de stock', aliases: ['entradas', 'salidas'] },
    { id: 'historial-reciente', label: 'Historial reciente', aliases: ['historial stock'] },
    { id: 'lista-materiales', label: 'Lista de materiales', aliases: ['inventario materiales'] },
  ],
  tutorials_manage: [
    { id: 'publicar-horarios', label: 'Publicar horarios de tutorias', aliases: ['publicar tutoria'] },
    { id: 'nuevo-bloque', label: 'Nuevo bloque', aliases: ['crear sesion'] },
    { id: 'mis-tutorias-publicadas', label: 'Mis tutorias publicadas', aliases: ['mis tutorias', 'tutorias'] },
  ],
  tutorials_public: [
    { id: 'tutorias-disponibles', label: 'Tutorias disponibles', aliases: ['sesiones disponibles'] },
    { id: 'tutoria-destacada', label: 'Tutoria destacada', aliases: ['sesion destacada'] },
    { id: 'mis-tutorias', label: 'Mis tutorias', aliases: ['inscripciones', 'sesiones inscritas'] },
    { id: 'cartelera-publica', label: 'Cartelera publica', aliases: ['tutorias disponibles', 'sesiones', 'inscripcion'] },
  ],
  reserve_reactivos: [
    { id: 'nueva-solicitud', label: 'Nueva solicitud', aliases: ['reservar reactivos'] },
    { id: 'mis-solicitudes', label: 'Mis solicitudes', aliases: ['historial solicitudes'] },
  ],
  reserve: [
    { id: 'reserva-lab-horas', label: 'Reserva por horas', aliases: ['reservar laboratorio'] },
    { id: 'alertas-recordatorios', label: 'Alertas y recordatorios', aliases: ['notificaciones'] },
    { id: 'mis-reservas-cambios', label: 'Mis reservas y cambios', aliases: ['reservas futuras', 'reservas vigentes'] },
    { id: 'historial-reservas', label: 'Historial reciente', aliases: ['mis ultimas reservas', 'historial reservas'] },
  ],
  reserve_history: [
    { id: 'resumen-historial', label: 'Resumen del historial', aliases: ['metricas', 'historial'] },
    { id: 'mis-reservas-pasadas', label: 'Mis reservas pasadas', aliases: ['laboratorios usados', 'reservas antiguas'] },
  ],
  calendar: [
    { id: 'calendario-disponibilidad', label: 'Calendario de disponibilidad', aliases: ['horarios'] },
    { id: 'bloques-por-fecha', label: 'Bloques por fecha', aliases: ['slots', 'horarios del dia'] },
  ],
  admin_reservas: [
    { id: 'dashboard-acceso', label: 'Dashboard de acceso al laboratorio', aliases: ['administrar reservas'] },
    { id: 'ocupacion-actual', label: 'Ocupacion actual', aliases: ['aforo actual'] },
    { id: 'ingreso-rapido', label: 'Ingreso rapido sin reserva previa', aliases: ['entrada manual'] },
    { id: 'control-entradas-salidas', label: 'Control de entradas y salidas del dia', aliases: ['bitacora del dia'] },
    { id: 'solicitudes-reserva', label: 'Solicitudes de reserva', aliases: ['reservas pendientes'] },
    { id: 'editar-reserva', label: 'Editar reserva', aliases: ['actualizar reserva'] },
  ],
  analytics: [
    { id: 'ranking-ocupacion', label: 'Ranking de ocupacion', aliases: ['top laboratorios', 'mas usados'] },
    { id: 'filtros-periodo', label: 'Filtros por periodo', aliases: ['diario', 'semanal', 'mensual'] },
    { id: 'formula-uso', label: 'Formula de uso', aliases: ['porcentaje', 'bloques disponibles'] },
  ],
  mapa: [
    { id: 'molde-3d', label: 'Molde 3D de bloques', aliases: ['mapa 3d', 'bloques'] },
  ],
}

function normalizeSearchText(value) {
  return String(value || '')
    .toLowerCase()
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
}

function Navbar({ onLogout, onNavigate, activeSection = 'home', user }) {
  const [isOpen, setIsOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const isAdmin = user?.role === 'admin'
  const canViewOwnReservationHistory = Boolean(user?.user_id)
 const navPriority = {
  home: 0,
  admin_reservas: 1,
  analytics: 2,
  reserve: 1,
  reserve_history: 2,
  calendar: 3,
  tutorials_public: 3,
  tutorials_manage: 3,
  equipos: 4,
  materiales: 5,
  laboratorios: 6,
  areas: 7,
  penalties: 8,
  profiles: 9,
  roles: 10,
}

  const visibleLinks = NAVIGATION_LINKS.filter((link) => {
    if (link.id === 'mapa') return false
    if (link.id === 'reserve_history') return canViewOwnReservationHistory
    if (link.requiredAnyPermission) return hasAnyPermission(user, link.requiredAnyPermission)
    if (link.userOnly) return !isAdmin
    return true
  })

  const navLinks = visibleLinks
    .filter((link) => !link.action)
    .sort((a, b) => (navPriority[a.id] ?? 99) - (navPriority[b.id] ?? 99) || a.label.localeCompare(b.label))
  const logoutLink = visibleLinks.find((link) => link.action === 'logout') || null
  const normalizedQuery = normalizeSearchText(searchQuery)

  const filteredNavLinks = useMemo(() => {
    if (!normalizedQuery) {
      return navLinks
    }

    return navLinks.filter((link) => {
      const aliases = NAV_SEARCH_META[link.id]?.aliases || []
      const searchableText = [link.label, link.id, link.path, ...aliases]
        .map((value) => normalizeSearchText(value))
        .join(' ')
      return searchableText.includes(normalizedQuery)
    })
  }, [navLinks, normalizedQuery])

  const filteredSubsectionLinks = useMemo(() => {
    if (!normalizedQuery) {
      return []
    }

    return navLinks.flatMap((sectionLink) => {
      const subsectionList = NAV_SUBSECTIONS_META[sectionLink.id] || []
      return subsectionList
        .filter((subsection) => {
          const searchableText = [
            subsection.label,
            subsection.id,
            sectionLink.label,
            sectionLink.id,
            ...(subsection.aliases || []),
          ]
            .map((value) => normalizeSearchText(value))
            .join(' ')
          return searchableText.includes(normalizedQuery)
        })
        .map((subsection) => ({
          id: `${sectionLink.id}:${subsection.id}`,
          label: subsection.label,
          sectionLabel: sectionLink.label,
          path: sectionLink.path,
          sectionId: sectionLink.id,
          icon: sectionLink.icon,
        }))
    })
  }, [navLinks, normalizedQuery])

  const groupedNavLinks = useMemo(() => {
    const groups = NAV_GROUP_ORDER.map((groupName) => ({ groupName, links: [] }))
    const fallbackGroup = { groupName: 'Otros', links: [] }

    filteredNavLinks.forEach((link) => {
      const currentGroup = NAV_SEARCH_META[link.id]?.group || 'Otros'
      const targetGroup = groups.find((group) => group.groupName === currentGroup) || fallbackGroup
      targetGroup.links.push(link)
    })

    if (fallbackGroup.links.length > 0) {
      groups.push(fallbackGroup)
    }

    return groups.filter((group) => group.links.length > 0)
  }, [filteredNavLinks])

  const handleNavigate = (path) => {
    setIsOpen(false)
    onNavigate?.(path)
  }

  const handleLogout = () => {
    setIsOpen(false)
    onLogout()
  }

  return (
    <>
      {/* Mobile top bar */}
      <div className="sidebar-topbar">
        <div className="sidebar-brand-mobile">
          <img src={ucbShieldLogo} alt="Escudo UCB San Pablo La Paz" className="sidebar-logo" />
          <div className="sidebar-brand-mobile-text">
            <span className="sidebar-brand-mobile-kicker">UCB San Pablo</span>
            <strong className="sidebar-brand-mobile-title">LabConnect</strong>
          </div>
        </div>
        <button
          type="button"
          className="sidebar-toggle"
          onClick={() => setIsOpen((prev) => !prev)}
          aria-label={isOpen ? 'Cerrar menú' : 'Abrir menú'}
          aria-expanded={isOpen}
        >
          {isOpen ? <X size={20} /> : <Menu size={20} />}
        </button>
      </div>

      {/* Overlay */}
      {isOpen && <div className="sidebar-overlay" onClick={() => setIsOpen(false)} />}

      {/* Sidebar */}
      <aside className={`sidebar ${isOpen ? 'sidebar--open' : ''}`}>
        <div className="sidebar-brand">
          <img src={ucbShieldLogo} alt="Escudo UCB San Pablo La Paz" className="sidebar-logo" />
          <div className="sidebar-brand-text">
            <span className="sidebar-kicker">UCB San Pablo · La Paz</span>
            <strong className="sidebar-title">LabConnect</strong>
          </div>
        </div>

        <div className="sidebar-search-wrap">
          <label className="sidebar-search" htmlFor="sidebar-search-input">
            <Search size={15} aria-hidden="true" />
            <input
              id="sidebar-search-input"
              type="search"
              placeholder="Buscar sección o función..."
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
            />
          </label>
          {normalizedQuery ? (
            <p className="sidebar-search-hint">
              {filteredNavLinks.length + filteredSubsectionLinks.length} resultado{filteredNavLinks.length + filteredSubsectionLinks.length === 1 ? '' : 's'}
            </p>
          ) : null}
        </div>

        <nav className="sidebar-nav">
          {groupedNavLinks.map((group) => (
            <div key={group.groupName} className="sidebar-group">
              <p className="sidebar-group-title">{group.groupName}</p>
              {group.links.map((link) => {
                const Icon = iconMap[link.icon]
                return (
                  <a
                    key={link.id}
                    href={link.path}
                    className={`sidebar-link ${activeSection === link.id ? 'sidebar-link--active' : ''}`}
                    aria-current={activeSection === link.id ? 'page' : undefined}
                    onClick={(e) => { e.preventDefault(); handleNavigate(link.path) }}
                  >
                    {Icon ? <Icon size={18} aria-hidden="true" /> : null}
                    <span>{link.label}</span>
                  </a>
                )
              })}
            </div>
          ))}
          {filteredSubsectionLinks.length > 0 ? (
            <div className="sidebar-group">
              <p className="sidebar-group-title">Subsecciones</p>
              {filteredSubsectionLinks.map((subsection) => {
                const Icon = iconMap[subsection.icon]
                return (
                  <a
                    key={subsection.id}
                    href={subsection.path}
                    className={`sidebar-link sidebar-link--subsection ${activeSection === subsection.sectionId ? 'sidebar-link--active' : ''}`}
                    aria-current={activeSection === subsection.sectionId ? 'page' : undefined}
                    title={`${subsection.label} · ${subsection.sectionLabel}`}
                    onClick={(e) => { e.preventDefault(); handleNavigate(subsection.path) }}
                  >
                    {Icon ? <Icon size={16} aria-hidden="true" /> : null}
                    <span className="sidebar-subsection-line">{subsection.label} · {subsection.sectionLabel}</span>
                  </a>
                )
              })}
            </div>
          ) : null}
          {groupedNavLinks.length === 0 && filteredSubsectionLinks.length === 0 ? (
            <p className="sidebar-empty-results">No se encontraron coincidencias para "{searchQuery}".</p>
          ) : null}
        </nav>

        <div className="sidebar-footer">
          {user && (
            <div className="sidebar-user">
              <div className="sidebar-user-avatar">
                {(user.name || user.username || '?')[0].toUpperCase()}
              </div>
              <div className="sidebar-user-info">
                <span className="sidebar-user-name">{user.name || user.username}</span>
                <span className="sidebar-user-role">{user.role || 'Usuario'}</span>
              </div>
            </div>
          )}
          {logoutLink && (
            <button type="button" className="sidebar-logout" onClick={handleLogout}>
              <LogOut size={16} aria-hidden="true" />
              <span>Salir</span>
            </button>
          )}
        </div>
      </aside>
    </>
  )
}

export default Navbar

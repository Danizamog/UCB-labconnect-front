import Navbar from '../../components/navbar/navbar'
import './HomeView.css'

function HomeView({ onLogout }) {
  return (
    <div className="app-layout">
      <Navbar onLogout={onLogout} />
      <main className="home-main">
        <section className="content-window" aria-label="Ventana principal" />
      </main>
    </div>
  )
}

export default HomeView

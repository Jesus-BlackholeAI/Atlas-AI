import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'

type Consent = 'accepted' | 'rejected'

const KEY = 'atlas_cookie_consent'

export default function CookieBanner() {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const v = localStorage.getItem(KEY)
    if (!v) setVisible(true)
  }, [])

  function setConsent(c: Consent) {
    localStorage.setItem(KEY, c)
    setVisible(false)
  }

  if (!visible) return null

  return (
    <div className="cookie">
      <div className="cookieInner">
        <div>
          <div className="cookieTitle">Cookies</div>
          <div className="cookieText">
            Usamos cookies esenciales para iniciar sesión y recordar preferencias. Las no esenciales son opcionales.
            Consulta la <Link to="/privacy">Política de Privacidad</Link>.
          </div>
        </div>
        <div className="cookieBtns">
          <button className="btnGhost" onClick={() => setConsent('rejected')}>Rechazar</button>
          <button className="btn" onClick={() => setConsent('accepted')}>Aceptar</button>
        </div>
      </div>
    </div>
  )
}

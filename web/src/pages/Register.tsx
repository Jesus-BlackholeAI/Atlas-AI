import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { apiFetch } from '../lib/api'

export default function Register() {
  const nav = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [acceptedPrivacy, setAcceptedPrivacy] = useState(false)
  const [acceptedTerms, setAcceptedTerms] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const canSubmit = useMemo(() => {
    return email.trim().length > 3 && password.length >= 8 && acceptedPrivacy && acceptedTerms && !loading
  }, [email, password, acceptedPrivacy, acceptedTerms, loading])

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      const res = await apiFetch('/auth/register', {
        method: 'POST',
        body: JSON.stringify({
          email,
          password,
          accept_privacy: acceptedPrivacy,
          accept_terms: acceptedTerms,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(data?.detail || JSON.stringify(data))
        return
      }
      nav('/login')
    } catch (err: any) {
      setError(err?.message || 'Error de red')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="bg">
      <div className="card">
        <div className="eyebrow">Secure Ops Intelligence</div>
        <div className="title">Atlas AI by BlackholeAI</div>
        <div className="subtitle">Crea tu cuenta.</div>

        <form onSubmit={onSubmit} className="form">
          <label className="label">Email</label>
          <input className="input" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="tu@empresa.com" />

          <label className="label" style={{ marginTop: 10 }}>Contraseña</label>
          <input className="input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="mínimo 8 caracteres" />

          <div className="row" style={{ marginTop: 10 }}>
            <label className="check">
              <input type="checkbox" checked={acceptedPrivacy} onChange={(e) => setAcceptedPrivacy(e.target.checked)} />
              <span>
                Acepto la <Link to="/privacy">Política de Privacidad (RGPD)</Link>.
              </span>
            </label>
          </div>

          <div className="row">
            <label className="check">
              <input type="checkbox" checked={acceptedTerms} onChange={(e) => setAcceptedTerms(e.target.checked)} />
              <span>
                Acepto los términos de uso.
              </span>
            </label>
          </div>

          {error ? <div className="error">{error}</div> : null}

          <button className="btn" disabled={!canSubmit}>
            {loading ? 'Creando…' : 'Crear cuenta'}
          </button>
        </form>

        <div className="muted" style={{ marginTop: 12 }}>
          ¿Ya tienes cuenta? <Link to="/login">Iniciar sesión</Link>
        </div>
      </div>
    </div>
  )
}

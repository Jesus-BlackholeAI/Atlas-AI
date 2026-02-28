import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { apiFetch, apiGet, setToken } from '../lib/api'
import { useAuth } from '../state/auth'

type MeOut = { id: number; email: string; role: string; is_active: boolean }

export default function Login() {
  const nav = useNavigate()
  const { setAuth } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const canSubmit = useMemo(() => {
    return email.trim().length > 3 && password.length >= 1 && !loading
  }, [email, password, loading])

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      const res = await apiFetch('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(data?.detail || JSON.stringify(data))
        return
      }
      if (data?.access_token) {
        setToken(data.access_token)
        const me = await apiGet<MeOut>('/me')
        setAuth({ email: me.email, role: me.role }, data.access_token)
        nav('/dashboard')
      } else {
        setError('Respuesta inválida del servidor.')
      }
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
        <div className="subtitle">Accede a tu panel.</div>

        <form onSubmit={onSubmit} className="form">
          <label className="label">Email</label>
          <input className="input" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="admin@blackholeai.es" />

          <label className="label" style={{ marginTop: 10 }}>Contraseña</label>
          <input className="input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" />

          {error ? <div className="error">{error}</div> : null}

          <button className="btn" disabled={!canSubmit}>
            {loading ? 'Entrando…' : 'Entrar'}
          </button>
        </form>

        <div className="muted" style={{ marginTop: 12 }}>
          ¿No tienes cuenta? <Link to="/register">Crear cuenta</Link>
        </div>
      </div>
    </div>
  )
}

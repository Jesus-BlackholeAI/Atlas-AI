import { Link } from 'react-router-dom'

export default function Privacy() {
  return (
    <div className="bg">
      <div className="card" style={{ maxWidth: 860 }}>
        <div className="eyebrow">BlackholeAI</div>
        <div className="title">Política de Privacidad y Protección de Datos (RGPD)</div>
        <div className="subtitle">Resumen claro para que el usuario sepa qué ocurre con sus datos.</div>

        <div className="privacy">
          <h3>1. Responsable del tratamiento</h3>
          <p><strong>BlackholeAI Consulting</strong> (en adelante, “BlackholeAI”).</p>

          <h3>2. Datos que tratamos</h3>
          <p>Correo electrónico, credenciales de acceso (hash), y registros técnicos mínimos (auditoría y seguridad).</p>

          <h3>3. Finalidades</h3>
          <p>
            a) Gestionar el acceso y la cuenta del usuario. b) Mantener la seguridad, prevenir fraude y resolver incidencias.
            c) Mejorar el servicio mediante métricas técnicas agregadas.
          </p>

          <h3>4. Base jurídica</h3>
          <p>
            Ejecución del contrato (prestación del servicio), interés legítimo en seguridad y, cuando corresponda, consentimiento
            explícito (aceptación de esta política).
          </p>

          <h3>5. Conservación</h3>
          <p>Mientras exista la cuenta y el tiempo imprescindible para cumplir obligaciones legales y de seguridad.</p>

          <h3>6. Destinatarios</h3>
          <p>No cedemos datos a terceros salvo obligación legal o proveedores estrictamente necesarios (hosting, correo transaccional).</p>

          <h3>7. Derechos</h3>
          <p>Acceso, rectificación, supresión, oposición, limitación, portabilidad y retirada del consentimiento cuando aplique.</p>

          <h3>8. Seguridad</h3>
          <p>Contraseñas almacenadas mediante hash. Principio de minimización. Registro de accesos e incidentes.</p>

          <h3>9. Contacto</h3>
          <p>Para ejercer derechos o consultas: <strong>admin@blackholeai.es</strong></p>
        </div>

        <div style={{ marginTop: 18 }}>
          <Link className="link" to="/login">Volver al login</Link>
        </div>

        <div className="footer">© 2026 BlackholeAI</div>
      </div>
    </div>
  )
}

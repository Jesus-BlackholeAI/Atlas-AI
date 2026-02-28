import { useEffect, useState } from 'react';
import { PowerBIEmbed } from 'powerbi-client-react';
import type { IEmbedConfiguration } from 'powerbi-client';
import { apiFetch } from '../lib/api';

type EmbedConfigResponse = {
  type: 'report';
  reportId: string;
  embedUrl: string;
  accessToken: string;
  tokenType: 'Aad' | 'Embed';
};

export default function BI() {
  const [config, setConfig] = useState<IEmbedConfiguration | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      setError(null);
      try {
        const res = await apiFetch('/bi/embed-config');
        if (!res.ok) {
          const t = await res.text();
          throw new Error(t || `HTTP ${res.status}`);
        }
        const data: EmbedConfigResponse = await res.json();
        if (!data.embedUrl) {
          throw new Error('No se recibió embedUrl. Revisa variables POWERBI_* en el API.');
        }
        setConfig({
          type: 'report',
          id: data.reportId,
          embedUrl: data.embedUrl,
          accessToken: data.accessToken,
          tokenType: data.tokenType === 'Aad' ? 0 : 1, // 0=Aad, 1=Embed
          settings: {
            panes: {
              filters: { visible: true },
              pageNavigation: { visible: true },
            },
            background: 2, // transparent
          },
        });
      } catch (e: any) {
        setError(e?.message || String(e));
      }
    })();
  }, []);

  return (
    <div style={{ padding: 24 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 16 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>Dashboard BI</h1>
          <div style={{ opacity: 0.8, marginTop: 4 }}>
            Power BI embebido (estilo Tableau/Power BI) con seguridad por token.
          </div>
        </div>
        <div style={{ opacity: 0.8, fontSize: 12 }}>
          Nota: configura POWERBI_* en el servicio <b>api</b>.
        </div>
      </div>

      <div style={{
        marginTop: 16,
        borderRadius: 14,
        border: '1px solid rgba(255,255,255,0.08)',
        background: 'rgba(0,0,0,0.25)',
        overflow: 'hidden',
        minHeight: '70vh',
      }}>
        {error && (
          <div style={{ padding: 16 }}>
            <div style={{ fontWeight: 700, marginBottom: 6 }}>No se pudo cargar el BI</div>
            <div style={{ opacity: 0.9, whiteSpace: 'pre-wrap' }}>{error}</div>
            <div style={{ opacity: 0.7, marginTop: 10 }}>
              Si no tienes Power BI aún, deja este módulo listo y conecta más tarde:
              crea un workspace, un report y rellena POWERBI_TENANT_ID, POWERBI_CLIENT_ID,
              POWERBI_CLIENT_SECRET, POWERBI_WORKSPACE_ID, POWERBI_REPORT_ID.
            </div>
          </div>
        )}

        {!error && !config && (
          <div style={{ padding: 16, opacity: 0.85 }}>Cargando…</div>
        )}

        {!error && config && (
          <PowerBIEmbed
            embedConfig={config}
            cssClassName="powerbi-embed"
            eventHandlers={new Map([
              ['loaded', () => console.log('PowerBI loaded')],
              ['rendered', () => console.log('PowerBI rendered')],
              ['error', (event: any) => console.error('PowerBI error', event?.detail)],
            ])}
          />
        )}
      </div>
    </div>
  );
}

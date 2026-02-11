import React, { useEffect, useState } from 'react';
import ReactDOM from 'react-dom/client';
import './styles.css';

class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; errorText: string }
> {
  state = { hasError: false, errorText: '' };

  static getDerivedStateFromError(error: unknown) {
    return { hasError: true, errorText: error instanceof Error ? error.message : String(error) };
  }

  componentDidCatch(error: unknown) {
    this.setState((s) => ({ ...s, errorText: error instanceof Error ? error.message : String(error) }));
    console.error('Mini-app render error:', error);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div
          style={{
            minHeight: '100dvh',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 20,
            background: '#0f172a',
            color: '#e2e8f0',
            fontFamily: 'system-ui, sans-serif',
            textAlign: 'center',
            paddingTop: 'env(safe-area-inset-top)',
            paddingBottom: 'env(safe-area-inset-bottom)'
          }}
        >
          <p style={{ marginBottom: 8 }}>Что-то пошло не так.</p>
          <pre style={{ fontSize: 11, color: '#f87171', marginBottom: 16, wordBreak: 'break-all', maxWidth: '100%' }}>
            {this.state.errorText || 'Ошибка'}
          </pre>
          <p style={{ fontSize: 12, color: '#94a3b8' }}>Закройте мини-приложение и откройте снова из чата с ботом.</p>
        </div>
      );
    }
    return this.props.children;
  }
}

/** Загружает App отдельным чанком — так бандлер выполняет gameLogic до App и ошибка "Ke before initialization" не возникает. */
function Loader() {
  const [App, setApp] = useState<React.ComponentType | null>(null);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    import('./App')
      .then((m) => setApp(() => m.App))
      .catch((e) => setErr(e instanceof Error ? e.message : String(e)));
  }, []);
  if (err) {
    return (
      <div style={{ minHeight: '100dvh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#0f172a', color: '#e2e8f0', fontFamily: 'system-ui', padding: 20, textAlign: 'center', gap: 12 }}>
        <span style={{ color: '#f87171' }}>Ошибка загрузки: {err}</span>
        <span style={{ fontSize: 12, color: '#94a3b8' }}>Закройте мини-приложение и откройте снова из чата с ботом.</span>
      </div>
    );
  }
  if (!App) {
    return (
      <div style={{ minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0f172a', color: '#94a3b8', fontFamily: 'system-ui' }}>
        Загрузка…
      </div>
    );
  }
  return <App />;
}

function bootstrap() {
  try {
    const rootEl = document.getElementById('root');
    if (!rootEl) {
      document.body.innerHTML = '<div style="min-height:100vh;display:flex;align-items:center;justify-content:center;background:#0f172a;color:#e2e8f0;font-family:system-ui;padding:20;">Не найден контейнер приложения.</div>';
      return;
    }
    const root = ReactDOM.createRoot(rootEl);
    root.render(
      <React.StrictMode>
        <ErrorBoundary>
          <Loader />
        </ErrorBoundary>
      </React.StrictMode>
    );
  } catch (err) {
    console.error('Bootstrap error:', err);
    document.body.innerHTML = '<div style="min-height:100vh;display:flex;align-items:center;justify-content:center;background:#0f172a;color:#f87171;font-family:system-ui;padding:20;text-align:center;">Ошибка загрузки. Закройте и откройте мини-приложение снова из чата с ботом.</div>';
  }
}

bootstrap();


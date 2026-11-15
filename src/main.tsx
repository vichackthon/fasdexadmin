import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import * as Sentry from '@sentry/react'
import './index.css'
import App from './App.tsx'

Sentry.init({
  dsn: 'https://7a6641d2bfb3043615b3f2bae66a8f09@o4511144818114560.ingest.us.sentry.io/4511144987983872',
  integrations: [Sentry.browserTracingIntegration()],
  tracesSampleRate: 0.2,
  environment: import.meta.env.MODE,
  enabled: import.meta.env.PROD,
})

const queryClient = new QueryClient()

const missingEnv = ['VITE_SUPABASE_URL', 'VITE_SUPABASE_ANON_KEY'].filter(
  (key) => !import.meta.env[key],
)

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {missingEnv.length > 0 ? (
      <div style={{ padding: 32, fontFamily: 'sans-serif' }}>
        <h1>Configuration error</h1>
        <p>
          Missing environment variable{missingEnv.length > 1 ? 's' : ''}:{' '}
          <code>{missingEnv.join(', ')}</code>
        </p>
        <p>Set them in your hosting environment and redeploy.</p>
      </div>
    ) : (
      <QueryClientProvider client={queryClient}>
        <App />
      </QueryClientProvider>
    )}
  </StrictMode>,
)

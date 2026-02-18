import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App'
import { ErrorBoundary } from './components/ErrorBoundary'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary onError={(error, errorInfo) => {
      // Log errors to console in development
      console.error('Application Error:', error, errorInfo);

      // In production, you could send to error tracking service
      // sendToErrorTracking(error, errorInfo);
    }}>
      <App />
    </ErrorBoundary>
  </StrictMode>,
)

import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import { ErrorBoundary } from 'react-error-boundary';
import App from './App.tsx';
import './index.css';

function fallbackRender({ error, resetErrorBoundary }: any) {
  return (
    <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center p-6 text-center">
      <div className="bg-red-500/10 border border-red-500/30 p-8 rounded-3xl max-w-lg space-y-6">
        <h2 className="text-xl font-bold text-red-400 uppercase tracking-widest">Error Crítico Detectado</h2>
        <p className="text-sm text-neutral-400">Oops, la aplicación se estrelló y devolvió este error:</p>
        <pre className="bg-black/50 text-red-300 p-4 rounded-xl text-xs overflow-auto text-left whitespace-pre-wrap max-h-40">
          {error.message}
        </pre>
        <button
          onClick={resetErrorBoundary}
          className="bg-red-500 text-black px-6 py-3 rounded-full font-bold uppercase tracking-widest text-xs hover:bg-white transition-all w-full"
        >
          Recargar Aplicación
        </button>
      </div>
    </div>
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary fallbackRender={fallbackRender}>
      <App />
    </ErrorBoundary>
  </StrictMode>,
);

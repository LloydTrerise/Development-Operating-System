import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { App } from './App.js';
import { ProjectProvider } from './project-context.js';
import { SessionProvider } from './session.js';

const rootElement = document.getElementById('root');
if (!rootElement) throw new Error('Root element not found.');

createRoot(rootElement).render(
  <StrictMode>
    <SessionProvider>
      <BrowserRouter>
        <ProjectProvider>
          <App />
        </ProjectProvider>
      </BrowserRouter>
    </SessionProvider>
  </StrictMode>,
);

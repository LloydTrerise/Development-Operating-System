import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { App } from './App.js';
import { OrganisationProvider } from './organisation-context.js';
import { ProjectProvider } from './project-context.js';
import { SessionProvider } from './session.js';
import { ThemeModeProvider } from './theme-mode-context.js';

const rootElement = document.getElementById('root');
if (!rootElement) throw new Error('Root element not found.');

createRoot(rootElement).render(
  <StrictMode>
    <ThemeModeProvider>
      <SessionProvider>
        <BrowserRouter>
          <OrganisationProvider>
            <ProjectProvider>
              <App />
            </ProjectProvider>
          </OrganisationProvider>
        </BrowserRouter>
      </SessionProvider>
    </ThemeModeProvider>
  </StrictMode>,
);

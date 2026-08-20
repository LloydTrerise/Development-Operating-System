import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

function App() {
  return <main><h1>DevOS</h1><p>Implementation bootstrap foundation.</p></main>;
}

createRoot(document.getElementById('root')!).render(
  <StrictMode><App /></StrictMode>,
);

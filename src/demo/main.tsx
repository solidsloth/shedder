// Shed framing demo — mount point.
//
// Everything structural comes from ../core/framing.ts; nothing in this folder
// computes a framing dimension. The engine keeps zero imports of its own so it
// can move to a React Native UI untouched — only these components get rewritten.

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App.tsx';
import './style.css';

const root = document.getElementById('root');
if (!root) throw new Error('index.html is missing <div id="root">');

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

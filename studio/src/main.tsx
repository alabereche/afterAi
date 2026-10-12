import React from 'react';
import ReactDOM from 'react-dom/client';
import * as Remotion from 'remotion';
import * as jsxRuntime from 'react/jsx-runtime';
import App from './App';
import './index.css';

import { LanguageProvider } from './i18n/LanguageContext';

// Expose runtime singletons for dynamically compiled scene modules
(window as any).__EFTERAI_REACT__ = React;
(window as any).__EFTERAI_REACT_DOM__ = ReactDOM;
(window as any).__EFTERAI_REMOTION__ = Remotion;
(window as any).__EFTERAI_JSX__ = jsxRuntime;

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <LanguageProvider>
      <App />
    </LanguageProvider>
  </React.StrictMode>
);


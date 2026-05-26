import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { FluentProvider } from '@fluentui/react-components';
import { QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter } from 'react-router-dom';
import { queryClient } from './lib/queryClient';
import { appTheme } from './lib/theme';
import App from './App';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <FluentProvider theme={appTheme} style={{ height: '100%' }}>
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </QueryClientProvider>
    </FluentProvider>
  </StrictMode>,
);

import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import App from './App';
import './styles/global.css';

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
      <Toaster
        position="top-right"
        toastOptions={{
          style: {
            background: '#16161f',
            color: '#e8e8f0',
            border: '1px solid #2a2a3a',
            fontFamily: "'Syne', sans-serif",
            fontSize: '0.85rem',
            borderRadius: '8px',
          },
          success: { iconTheme: { primary: '#00e5a0', secondary: '#16161f' } },
          error: { iconTheme: { primary: '#ff4f6a', secondary: '#16161f' } },
        }}
      />
    </BrowserRouter>
  </React.StrictMode>
);

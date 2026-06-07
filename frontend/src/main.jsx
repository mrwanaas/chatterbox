import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import App from './App';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
      <Toaster
        position="bottom-right"
        toastOptions={{
          style: {
            background: '#18191c',
            color: '#dcddde',
            border: '1px solid #40444b',
            borderRadius: '8px',
          },
          success: { iconTheme: { primary: '#3ba55c', secondary: '#fff' } },
          error:   { iconTheme: { primary: '#ed4245', secondary: '#fff' } },
        }}
      />
    </BrowserRouter>
  </React.StrictMode>
);

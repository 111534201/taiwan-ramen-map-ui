import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
// *** 1. 從 react-router-dom 導入 BrowserRouter ***
import { BrowserRouter } from 'react-router-dom';
// *** --- ***
import './index.css';
import App from './App.jsx';

const root = createRoot(document.getElementById('root')); // 使用 createRoot

root.render(
  <StrictMode>
    {/* *** 2. 使用 BrowserRouter 包裹 App 組件 *** */}
    <BrowserRouter>
      <App />
    </BrowserRouter>
    {/* *** --- *** */}
  </StrictMode>,
);
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { StageOnlyApp } from './StageOnlyApp';
import './styles.css';

const RootApp = window.location.pathname === '/stage' ? StageOnlyApp : App;

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <RootApp />
  </React.StrictMode>,
);

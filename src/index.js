import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './NotionCalendarWidget.jsx'; // 👈 NotionCalendarWidget.jsx 파일을 App으로 가져옴

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

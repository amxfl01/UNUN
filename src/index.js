import React from 'react';
import ReactDOM from 'react-dom/client';
// 메인 컴포넌트인 NotionCalendarWidget.jsx를 가져옵니다.
import App from './NotionCalendarWidget.jsx'; 

// 🚨 중요한 변경: 오류를 일으키던 'src/index.css' 파일 임포트 구문을 제거합니다. 
// 이 파일을 불러오지 않아야 @tailwind 오류가 사라집니다.
// import './index.css'; 

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

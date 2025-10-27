# UNUN

## Notion Widget Setup 및 캘린더 열기

앱을 실행하면 루트 경로에서 Notion 설정 화면(Notion API Token / Database ID 입력)이 먼저 표시됩니다. 다음 링크/명령으로 바로 열 수 있습니다.

- 로컬 개발서버 (Vite 기본 포트 예시)
  - URL: http://localhost:5173/
  - 호스트 기본 브라우저로 열기:
    - "$BROWSER" http://localhost:5173/

- GitHub Pages (배포된 사이트)
  - URL: https://amxfl01.github.io/UNUN/
  - 호스트 기본 브라우저로 열기:
    - "$BROWSER" https://amxfl01.github.io/UNUN/

참고
- 설정 화면에서 "Secret Token"과 "Database ID"를 입력하면 캘린더(위젯) 화면으로 넘어갑니다.
- 브라우저에 저장된 Token/DB ID를 초기화하려면:
  - 위젯 UI의 "토큰/DB ID 재설정" 버튼을 사용하거나
  - 개발자 도구 > Application > Local Storage > NOTION_API_KEY / NOTION_DATABASE_ID 항목을 삭제하세요.
- 브라우저에서 Notion API를 직접 호출할 경우 CORS 문제로 실패할 수 있습니다. 이 경우 "프록시 사용" 옵션을 켜고 서버 프록시를 준비해 주세요.
- 로컬에서 실행:
  - npm install
  - npm run dev (또는 프로젝트의 시작 명령)
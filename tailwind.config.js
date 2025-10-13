/** @type {import('tailwindcss').Config} */
module.exports = {
  // src 폴더 내의 모든 JS, JSX, TS, TSX 파일을 스캔하여 Tailwind 클래스를 찾습니다.
  content: [
    "./src/**/*.{js,jsx,ts,tsx}",
    "./public/index.html",
  ],
  theme: {
    extend: {},
  },
  plugins: [],
}

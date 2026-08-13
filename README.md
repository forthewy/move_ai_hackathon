<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://ai.google.dev/static/site-assets/images/share-ais-513315318.png" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/5f04a910-4453-4eb3-b373-43eb9721b1fe

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Set the `GEMINI_API_KEY` in [.env.local](.env.local) to your Gemini API key
3. Run the app:
   `npm run dev`

## 탭 A 기사 분석

`기사 URL 입력`을 선택한 뒤 공개적으로 접근 가능한 `http://` 또는 `https://` 기사 URL을 입력합니다.
서버가 기사 제목과 본문을 가져와 Gemini 위험 분석에 전달합니다. 로컬·사설망 주소와 HTML/텍스트가 아닌 URL은 허용하지 않습니다.

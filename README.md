# Base64 Workbench

프레임워크 없이 **HTML + CSS + JavaScript**로 만든 Base64 인코더·디코더입니다. 영어 UI, 좌우 입력칸, 가운데 Encode / Decode 버튼을 제공합니다. React, TypeScript, Vite 및 런타임 npm 의존성은 제거했습니다.

## 실행

Node.js 22 이상에서 설치·빌드 없이 실행:

```sh
npm run dev
```

주소: http://127.0.0.1:5173

`python3 -m http.server 5173`도 사용할 수 있습니다. ES 모듈과 Web Worker를 사용하므로 `file://` 대신 HTTP 서버로 실행하세요.

## 기능

- 두 입력칸 모두 편집 가능: 왼쪽 → Encode → 오른쪽, 오른쪽 → Decode → 왼쪽
- UTF-8, 한글, 이모지, 바이너리 파일 변환
- 업로드·드롭, 복사·다운로드, Ctrl+Enter / ⌘+Enter
- URL-safe 및 padding 옵션, data URL, 공백·줄바꿈 입력 지원
- 잘못된 입력 검증, 바이너리 결과 다운로드, 원본·디코딩 파일 10 MiB 제한
- 모바일 반응형 레이아웃

**“Your input is not sent to a server.”** 문구를 표시합니다. 입력은 브라우저에서만 처리하고 저장하지 않습니다. 폰트와 아이콘도 로컬 파일이므로 외부 CDN 요청이 없습니다.

## Cloudflare Pages

| 설정 | 값 |
| --- | --- |
| Framework preset | None |
| Build command | `npm run build` |
| Build output directory | `dist` |
| Root directory | 이 저장소 자체라면 비워둠, 상위 저장소라면 `base64` |
| Node.js | `.node-version`의 24 |

`build`는 정적 파일만 `dist/`에 복사합니다. 트랜스파일러·번들러·API 서버는 필요하지 않습니다. `_headers`로 CSP 등 보안 헤더가 적용됩니다.

```sh
npm run build
npx wrangler pages deploy dist --project-name base64-workbench
```

본인의 Pages 프로젝트 이름에 맞게 명령과 `wrangler.jsonc`의 `name`을 수정하세요.

## 검증

테스트 도구를 설치할 때만 `npm ci`가 필요합니다.

```sh
npm ci
npm test
npm run build
npx playwright install chromium
npm run test:e2e
```

Node 기본 테스트 러너로 25개 변환 테스트, Playwright로 4개 브라우저 테스트를 실행합니다. 로컬 서버도 `_headers`를 적용하므로 CSP가 활성화된 상태로 검사합니다.

## 구조

- `index.html`, `styles.css`, `app.js`: 정적 화면과 이벤트 처리
- `lib/base64.js`, `converter.worker.js`: 변환·검증 및 로컬 작업
- `assets/`: 로컬 폰트, 아이콘, 라이선스
- `scripts/`: Node 기본 모듈만 사용하는 정적 서버와 배포 파일 복사

## 라이선스

프로젝트 소스 코드는 [MIT License](LICENSE)를 따릅니다. 저작권자는 `Copyright (c) 2026 Soohyuk`이며, 라이선스 전문은 배포 빌드에도 포함됩니다.

## 서드파티 라이선스

[THIRD-PARTY-NOTICES.txt](THIRD-PARTY-NOTICES.txt)에 실제 배포되는 구성 요소와 원문 고지 위치를 기록했습니다. IBM Plex Sans (@fontsource-variable/ibm-plex-sans 5.3.0)와 JetBrains Mono 2.211은 OFL 1.1, Lucide 아이콘은 ISC 및 일부 Feather 유래 경로의 MIT 라이선스를 따릅니다. IBM Plex Sans는 블로그와 같은 배포 파일을 사용하며, 빌드에서 SHA-256과 필수 고지를 검증합니다. 원문은 `assets/licenses/`에 있으며 빌드 결과에도 포함됩니다. 서드파티 구성 요소에는 각각의 라이선스가 적용됩니다.

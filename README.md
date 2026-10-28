# Base64 Workbench

프레임워크 없이 HTML + CSS + JavaScript로 만든 Base64 인코더·디코더입니다. 문자 인코딩을 선택해 텍스트를 바이트로 바꾸고 Base64로 변환하거나, Base64 바이트를 자동 감지·수동 선택한 문자 인코딩으로 읽습니다. 코덱과 감지기는 로컬 파일로 배포하며 변환은 Web Worker에서 실행합니다.

## 실행

Node.js 22 이상에서 설치·빌드 없이 실행합니다. 검토된 코덱 파일도 저장소에 포함됩니다.

```sh
npm run dev
```

주소: http://127.0.0.1:5173

`python3 -m http.server 5173`도 사용할 수 있습니다. ES 모듈과 Web Worker를 사용하므로 `file://` 대신 HTTP 서버로 실행하세요.

## 문자 인코딩

Text encoding에서 Auto detect, 문자 인코딩, Binary (HEX)를 선택합니다.

| 지원 형식 | 동작 |
| --- | --- |
| UTF-8 | 직접 입력한 텍스트의 Auto 기본값 |
| UTF-16 LE / BE, UTF-32 LE / BE | 바이트 순서를 명시적으로 선택하며 BOM이 있으면 자동 감지 |
| CP949 / EUC-KR (UHC) | EUC-KR 영역과 UHC 확장을 포함하는 CP949 코덱. 엄격한 EUC-KR 전용 제한을 의미하지 않음 |
| Shift_JIS / Windows-31J | 일본어 Windows 확장 매핑 포함 |
| GB18030 | 중국어 간체·Unicode 문자 매핑 |
| Big5 / HKSCS | 중국어 번체·홍콩 확장 매핑 |
| Windows-1252 | 유럽어 Windows 문자 집합 |
| ISO-8859-1 (Latin-1) | 실제 Latin-1 매핑. Windows-1252와 구분 |
| ASCII | 7비트 ASCII만 허용 |
| Binary (HEX) | 바이트를 읽기 전용 대문자 HEX로 표시 |

Auto는 BOM, 엄격한 Unicode 검증, UTF-16/32의 뚜렷한 바이트 패턴을 먼저 확인합니다. 충분한 통계적 근거가 있는 레거시 텍스트만 **Likely**로 표시하며 정답을 보장하지 않습니다. 짧은 텍스트, 서로 겹치는 문자 집합, 여러 언어가 섞인 파일은 바이트만으로 구분할 수 없습니다. 근거가 부족하거나 바이너리로 보이면 HEX로 남기고 인코딩을 직접 선택하도록 안내합니다. 일반 바이너리를 단순히 읽을 수 있다는 이유로 Windows-1252 텍스트로 처리하지 않습니다.

오른쪽 Base64 파일 자체의 문자 인코딩은 payload와 별개로 읽습니다. UTF-8, UTF-16/32 BOM 또는 뚜렷한 ASCII 바이트 패턴을 지원합니다. 예를 들어 UTF-16으로 저장한 Base64 문서에 CP949 payload가 있어도 정상적으로 읽을 수 있습니다.

## 원본 바이트와 편집

- 업로드하거나 Decode한 왼쪽 결과는 원본 바이트를 보관합니다. BOM도 그대로 유지합니다.
- 인코딩 선택을 바꾸면 같은 바이트를 다시 해석해 표시합니다. **텍스트를 편집하기 전에는 Encode와 다운로드가 원본 바이트를 사용**하며 선택만으로 파일을 재인코딩하지 않습니다.
- 내용을 편집하면 원본 바이트 연결을 해제하고 선택한 문자 집합으로 인코딩합니다. Auto 상태의 직접 입력·편집 텍스트는 UTF-8을 사용합니다.
- 직접 입력한 텍스트의 다운로드도 선택한 문자 집합을 사용합니다. 표현할 수 없는 문자, 잘못된 Unicode 서로게이트, 손실을 일으키는 변환은 `?`로 바꾸지 않고 오류로 알립니다.
- 인코딩 해석이나 파일 업로드가 실패하면 기존 입력과 원본 바이트를 유지합니다.
- 오른쪽에 업로드한 Base64 문서도 편집하거나 Encode로 교체하기 전까지 다운로드에 원본 파일 바이트를 사용합니다.
- HEX 복사는 표시된 문자열을 복사합니다. 원본 바이트를 바꾸려면 텍스트로 해석한 뒤 편집하세요.

## 기능과 제한

- 왼쪽 → Encode → 오른쪽, 오른쪽 → Decode → 왼쪽
- 업로드·드롭, 복사·다운로드, Ctrl+Enter / ⌘+Enter
- URL-safe 및 padding 옵션, data URL, 공백·줄바꿈 Base64 입력
- 잘못된 Base64·문자열·인코딩 검증과 모바일 레이아웃
- 원본·인코딩된 텍스트·디코딩된 payload 최대 10 MiB. Base64 문서는 대응하는 문자 수 한도를 적용하며 UTF-16/32 저장 크기는 별도로 제한합니다.

입력은 브라우저에서만 처리하며 서버로 보내거나 저장하지 않습니다. 폰트·아이콘·코덱·인코딩 감지기도 로컬 파일이므로 외부 CDN 요청이 없습니다. 대형 코덱 테이블과 감지는 Worker에서만 사용하며 화면에는 작은 옵션 목록만 불러옵니다.

## Cloudflare Pages

| 설정 | 값 |
| --- | --- |
| Framework preset | None |
| Build command | `npm run build` |
| Build output directory | `dist` |
| Root directory | 이 저장소 자체라면 비워둠, 상위 저장소라면 `base64` |
| Node.js | `.node-version`의 24 |

`build`는 검토된 정적 파일·vendor 코드·라이선스 고지를 `dist/`에 복사하고 검증합니다. 배포 시 외부 CDN이나 API 서버는 필요하지 않습니다. `_headers`의 CSP를 로컬 서버와 배포에서 적용합니다.

```sh
npm run build
npx wrangler pages deploy dist --project-name base64-workbench
```

본인의 Pages 프로젝트 이름에 맞게 명령과 `wrangler.jsonc`의 `name`을 수정하세요.

## 검증

```sh
npm ci
npm test
npm run build
npx playwright install chromium
npm run test:e2e
```

다른 프로세스가 기본 테스트 포트 4173을 사용한다면 `BASE64_TEST_PORT=5273 npm run test:e2e`처럼 포트를 지정할 수 있습니다.

Node 기본 테스트는 Base64·코덱·자동 감지·손실 방지·Unicode 문서·바이트 제한을 검증합니다. Playwright는 실제 Worker와 CSP를 켠 상태에서 선택 인코딩 변환·다운로드, BOM·원본 보존, 수동 복구, 실패 복구, 비동기 결과 경합과 모바일 레이아웃을 검사합니다.

## 구조와 라이선스

- `index.html`, `styles.css`, `app.js`: 화면과 입력 상태
- `lib/base64.js`, `lib/base64-document.js`: Base64 검증과 문서 읽기
- `lib/encoding-options.js`: 화면에 사용하는 작은 인코딩 목록
- `lib/encodings.js`, `converter.worker.js`, `vendor/`: Worker 코덱·감지·변환
- `assets/`: 로컬 폰트·아이콘·라이선스
- `scripts/`: 정적 서버·배포·vendor 라이선스 검증

프로젝트 소스는 [MIT License](LICENSE)를 따릅니다. 실제 코덱·감지기·간접 의존성 버전과 라이선스, 폰트·아이콘 고지는 [THIRD-PARTY-NOTICES.txt](THIRD-PARTY-NOTICES.txt)와 `vendor/`의 원문 고지에 기록합니다. 필수 고지는 배포 빌드에 포함하고 누락·변조를 검증합니다. 서드파티 구성 요소에는 각각의 라이선스가 적용됩니다.

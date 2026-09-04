# AI Agent & Developer Guidelines (AGENTS.md)

이 문서는 Open COM Analyzer 프로젝트를 개발하고 유지보수하는 AI 에이전트 및 개발자를 위한 핵심 운영 및 릴리즈 규칙을 정의합니다.

---

## 1. Git 커밋 및 태그 정책 (Strict Tagging Policy)

1. **태그 생성 금지 원칙**:
   - **사용자가 명시적으로 `"다음 버전 태그 푸시 ㄱ"` 등의 명령을 내리기 전까지는 절대로 태그를 생성하거나 푸시하지 않습니다.**
   - 평상시 기능 개발 및 버그 수정은 오직 `main` 브랜치로의 `git commit` 및 `git push origin main`만 수행합니다.

2. **커밋 메시지 표준**:
   - **첫 줄**: Conventional Commits 규격 (`feat: ...`, `fix: ...`, `refactor: ...`, `chore: ...`)
   - **본문 (2줄 이후)**: 상세 작업 내역을 명확한 **한국어 불릿 포인트(`-`)** 로 작성

---

## 2. 에이전트 주도 릴리즈 노트 작성 및 반영 (Release Notes Policy)

1. **릴리즈 노트 자동 생성기 의존 금지**:
   - 사용자가 태그 푸시를 요청했을 때, 단순 자동 스크립트에만 의존하지 않고 **에이전트가 직접 이전 태그(`git describe --tags --abbrev=0`) 이후의 모든 커밋과 소스 코드 변경 사항을 전수 조사**합니다.
2. **카테고리별 고품질 한국어 릴리즈 노트 작성**:
   - `[✨ 신규 기능]`, `[🛠 버그 수정 및 안정성 개선]`, `[🎨 UI/UX 편의성 향상]` 등의 명확한 섹션으로 구조화하여 사용자가 변경점을 한눈에 파악할 수 있도록 상세히 작성합니다.
3. **GitHub Release 본문 즉시 반영**:
   - 태그 푸시 및 GitHub Actions 릴리즈 생성 후, `gh release edit <tag> --notes-file <file>` 등을 통해 에이전트가 직접 작성한 완성형 마크다운 릴리즈 노트를 GitHub Release 페이지에 100% 완벽하게 업데이트합니다.

---

## 3. 범용 오픈소스 분석기 원칙 (Generic Tool Standard)

1. **특정 사설 프로젝트 코드명 배제**:
   - 특정 프로젝트나 특정 장비 전용 코드명(예: 사내 장비 모델명 등)을 UI, 주석, 프리셋 이름에 하드코딩하지 않습니다.
   - 모든 프로토콜, 프리셋, 안내 문구는 표준적이고 범용적인 명칭(예: `Modbus RTU 표준`, `80개 (160B) 샘플` 등)을 사용합니다.

---

## 4. 버전 동기화 위치 (Version Single Source of Truth)

버전 갱신 시 아래 파일들의 버전 문자열을 반드시 일괄 동기화합니다:
- `package.json` (`"version": "X.X.X"`)
- `src/types.ts` (`export const APP_VERSION = 'X.X.X';`)
- `src/components/MenuBar.tsx` (`vX.X.X`)

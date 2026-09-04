## ⚡️ Open COM Analyzer v0.0.9

Open COM Analyzer v0.0.9 버전에서는 다른 PC 환경 및 멀티 인스턴스 환경에서의 실행 안정성을 대폭 개선하고, 예외 발생 시 원인을 즉각 파악할 수 있는 자동 크래시 로깅 시스템이 추가되었습니다.

---

### [✨ 신규 기능]
* **다운로드 폴더 내 오류 로그 자동 저장 시스템 (`COM_Analyzer_error.log`)**
  - 앱 시작 실패, 백엔드 연결 오류, 렌더러 비정상 종료 등 예외 상황 발생 시 사용자의 **`~/Downloads/COM_Analyzer_error.log`** 파일에 시간, 앱 버전, OS 및 CPU 아키텍처, 상세 스택 트레이스를 자동 기록합니다.
  - 시스템 표준 로그 디렉터리(`~/Library/Logs/COM Analyzer/`)에도 함께 보관되어 장애 분석 및 버그 리포트 작성이 용이해졌습니다.
* **네이티브 오류 안내 다이얼로그 제공**
  - 오류 발생 시 앱이 조용히 꺼지는 대신, 원인과 로그 파일 저장 위치를 명확히 안내하는 시스템 팝업을 표시합니다.

---

### [🛠 버그 수정 및 안정성 개선]
* **포트 충돌(`EADDRINUSE`) 및 중복 프로세스 방지**
  - **단일 인스턴스 락(Single Instance Lock)**: 앱 중복 실행 시 새 프로세스는 안전하게 종료되고 이미 켜져 있는 창으로 포커스 전환됩니다.
  - **동적 백엔드 포트 할당**: 기본 `4001` 포트가 다른 로컬 서비스에 의해 점유 중인 경우 `4002` ~ `4010` 포트로 자동 폴백(Fallback) 리스닝합니다.
  - **프론트엔드 자동 포트 스캔**: UI 클라이언트가 활성화된 백엔드 포트를 순차 탐색하여 자동으로 안정적인 웹소켓 연결을 구성합니다.
* **CI/CD 릴리즈 워크플로우 보강**
  - GitHub Actions 릴리즈 배포 시 에이전트가 직접 작성한 한국어 릴리즈 노트(`RELEASE_BODY.md`)가 온전히 반영되도록 파이프라인을 보강했습니다.

---

### 📦 다운로드 파일 (Assets)
* **macOS (Apple Silicon M1/M2/M3/M4)**: `COM-Analyzer-macOS-arm64.zip`
* **macOS (Intel CPU)**: `COM-Analyzer-macOS-x64.zip`
* **Windows (64-bit)**: `COM-Analyzer-Windows-x64.zip`

---

### 💡 macOS 실행 시 "손상되었기 때문에 열 수 없습니다" 해결 방법
GitHub에서 다운로드한 오픈소스 앱에 macOS 게이트키퍼(Gatekeeper) 격리 속성이 붙어 발생합니다. 터미널에서 아래 명령어를 1회 실행하시면 정상 실행됩니다:
```bash
xattr -cr "/Applications/COM Analyzer.app"
# 또는 다운로드 폴더에서 직접 실행하는 경우
xattr -cr ~/Downloads/"COM Analyzer.app"
```

**전체 커밋 비교**: https://github.com/rlatjd1f/open-com-analyzer/compare/v0.0.8...v0.0.9

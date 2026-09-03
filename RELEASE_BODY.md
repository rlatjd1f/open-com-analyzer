## ⚡️ Open COM Analyzer v0.0.6

### 🔄 이전 버전(v0.0.5) 이후 주요 작업 및 변경 내역

* **feat: set default application theme to modern-light** (`69631f3`)
  - 애플리케이션 초기 기본 테마를 Modern Light(라이트 테마)로 설정
  - 사용자가 설정창 또는 상단 타이틀바에서 변경한 테마는 localStorage에 영구 보존

* **feat: default TCP port to empty and persist last used port in localStorage** (`2988899`)
  - TCP 포트 번호 기본값을 빈칸(placeholder: 예: 121)으로 설정
  - 사용자가 포트 번호를 입력하여 사용한 이후에는 마지막으로 사용한 포트 번호를 localStorage에 자동 기억하여 복원

* **fix: simplify TCP mode switcher button label by removing port text** (`206f957`)
  - 우측 사이드바 TCP 간편 설정 모드 선택 버튼의 '서버 (Port 121)' 문구를 깔끔하게 '서버'로 변경
  - 설정창 사이드바 설명 문구 간소화

* **feat: add quick TCP control to sidebar and move color customizer to settings modal** (`6d0ab07`)
  - 우측 사이드바의 색상 설정 영역을 설정창(SettingsModal) '테마 및 화면' 탭 내부로 이동
  - 우측 사이드바에 'TCP 간편 설정' 패널(서버/클라이언트 모드 전환, PORT 121, 원클릭 구동/종료) 추가
  - 상단 타이틀바의 RX/TX 카운터에 실시간 패킷 송수신 블링크 하이라이트 애니메이션 연동

* **feat: prioritize TCP socket settings as the top tab in SettingsModal** (`0c2d670`)
  - 설정창(SettingsModal) 좌측 사이드바 메뉴 순서에서 'TCP 소켓 설정'을 가장 최상단으로 변경
  - 설정창 기본 진입 탭 및 단축키 열기 시 기본 선택 탭을 TCP 소켓 설정으로 연동

* **fix: adjust control sidebar layout to prevent buffer combobox overflow** (`f79fafd`)
  - 우측 제어 사이드바의 버퍼 한도 콤보박스가 경계선을 벗어나 튀어나오던 레이아웃 버그 수정
  - 사이드바 폭을 안정적으로 조정하고 버퍼 한도 선택창을 컨테이너 내 100% 폭으로 균형 있게 배치

* **feat: streamline add-to-favorites flow with instant registration and inline alias focus** (`f451b82`)
  - 입력창의 패킷을 즉시 즐겨찾기 목록 최상단에 등록하도록 흐름 개선
  - 브라우저 기본 팝업(prompt) 제거 및 신규 등록된 항목에 인라인 별칭 입력창 자동 포커스

* **feat: add inline alias name editor for frequent and recent packets** (`eb817ef`)
  - 자주 쓰는 패킷 및 최근 기록의 각 항목에 인라인 별칭(이름) 추가/수정 기능(연필 아이콘) 구현
  - Enter 키로 즉시 저장 및 ESC 키로 취소 가능한 직관적인 별칭 편집 UI 제공
  - 설정된 별칭을 localStorage에 영구 보관하여 패킷 목적을 한눈에 식별하고 재사용할 수 있도록 지원

* **feat: add frequent packets preset and recent history dropdown in send panel** (`290ac6a`)
  - 보내는 데이터 버튼 우측에 '자주 쓰는 데이터' 팝오버 드롭다운 버튼 추가
  - 최근 송신한 패킷(최대 20건)을 localStorage에 자동 기록하여 원클릭 입력창 채우기 및 즉시 전송 지원
  - 산업 표준 Modbus RTU 읽기/쓰기 및 Ping 기본 프리셋 제공 및 사용자 정의 즐겨찾기(별표) 등록/삭제 기능 지원


**전체 커밋 비교**: https://github.com/rlatjd1f/open-com-analyzer/compare/v0.0.5...v0.0.6

---
### 📦 다운로드 파일 (Assets)
* **macOS (Apple Silicon)**: `COM-Analyzer-macOS-arm64.zip`
* **macOS (Intel)**: `COM-Analyzer-macOS-x64.zip`
* **Windows (64-bit)**: `COM-Analyzer-Windows-x64.zip`

---
### 💡 macOS 실행 시 '손상되었기 때문에 열 수 없습니다' 해결 방법
터미널에서 아래 명령어를 1회 실행하여 격리 속성을 해제하세요:
```bash
xattr -cr ~/Downloads/COM\ Analyzer.app
```

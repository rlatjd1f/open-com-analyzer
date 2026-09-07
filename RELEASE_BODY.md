## ⚡️ Open COM Analyzer v0.0.11

Open COM Analyzer v0.0.11 버전에서는 Modbus TCP 통신 규격에 맞추어 마스터로부터 수신된 요청의 트랜잭션 ID(TID) 및 요청 파라미터를 응답 생성기에 실시간으로 자동 매핑해 주는 스마트 동기화 시스템이 추가되었습니다.

---

### [✨ 신규 기능]
* **📥 Modbus TCP 수신 요청 트랜잭션 ID(TID) 실시간 자동 매핑**
  - 마스터(클라이언트)로부터 Modbus TCP 요청 패킷이 수신되었을 때, 슬레이브 응답(`Response`) 및 예외 응답(`Exception`) 생성 시 수신된 MBAP 트랜잭션 ID(TID)가 자동으로 1:1 일치하도록 동기화됩니다.
  - TID뿐만 아니라 수신된 요청의 **Unit ID (국번)**, **기능 코드 (Function Code)**, **시작 주소 (Start Address)**, **요청 레지스터 개수 (Quantity)** 까지 응답 파라미터에 실시간으로 자동 적용됩니다.

---

### [🎨 UI/UX 편의성 향상]
* **MBAP 헤더 내 수신 TID 상태 표시 및 제어 옵션**
  - **수신 요청 정보 배지**: 최근 수신된 요청 패킷의 TID, Unit ID, 기능 코드를 헤더 상단에 실시간으로 안내합니다.
  - **`[⚡️ 수신TID 매핑]` 원클릭 버튼**: 수신된 요청의 TID 및 파라미터를 즉시 가져와 적용할 수 있습니다.
  - **`☑️ 요청 TID 자동 매핑` 체크박스 및 `✓ 매핑됨` 상태 배지**: 자동 동기화 활성화 여부를 손쉽게 제어하고 매핑 상태를 직관적으로 확인할 수 있습니다.

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

**전체 커밋 비교**: https://github.com/rlatjd1f/open-com-analyzer/compare/v0.0.10...v0.0.11

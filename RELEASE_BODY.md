## ⚡️ Open COM Analyzer v0.0.12

Open COM Analyzer v0.0.12 버전에서는 Modbus TCP 통신 시 마스터로부터 요청이 들어왔을 때 `RX 반응발송` 기능이 요청 패킷의 트랜잭션 ID(Transaction ID, TID)를 실시간으로 자동 동기화하여 응답하도록 개선되었습니다.

---

### [🛠 버그 수정 및 안정성 개선]
* **📥 Modbus TCP RX 반응발송 시 요청 TID 실시간 자동 매핑**
  - `[RX 반응발송 ON]` 모드 실행 시, 수신된 Modbus TCP 요청 프레임의 Transaction ID(MBAP 헤더 바이트 0~1)를 발송 응답 패킷에 실시간으로 동적 매핑하여 전송합니다.
  - 마스터(요청자)의 TID가 증가하거나 변경되더라도 슬레이브 응답 패킷의 TID가 1:1로 정확하게 일치하여 응답되도록 보장합니다.
  - 발송 입력창의 HEX 데이터도 수신된 최신 TID로 동기화되어 실시간 전송 상태를 즉시 확인할 수 있습니다.

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

**전체 커밋 비교**: https://github.com/rlatjd1f/open-com-analyzer/compare/v0.0.11...v0.0.12

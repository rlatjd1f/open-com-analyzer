## ⚡️ Open COM Analyzer v0.0.10

Open COM Analyzer v0.0.10 버전에서는 산업 표준 **Modbus TCP (이더넷 / MBAP)** 패킷 생성 마법사가 새롭게 탑재되었으며, Modbus RTU 모드의 CRC 선택성 및 시각화 블록 UI가 대폭 강화되었습니다.

---

### [✨ 신규 기능]
* **🌐 Modbus TCP 전용 패킷 생성 모드 탑재**
  - **표준 7바이트 MBAP 헤더 자동 조립**: `트랜잭션 ID (2B)`, `프로토콜 ID 0000 (2B)`, `길이 (Length 2B 자동 계산)`, `Unit ID (1B)`를 실시간으로 자동 구성합니다.
  - **트랜잭션 ID 간편 관리**: 트랜잭션 번호 직관 입력 및 `[+1 증가]` 버튼으로 손쉽게 연속 패킷을 생성할 수 있습니다.
  - **3대 패킷 유형 완벽 지원**: `마스터 요청 (Request)`, `슬레이브 응답 (Response)`, `예외/에러 응답 (Exception)` 모두 Modbus TCP 규격에 맞게 100% 호환 생성됩니다.
  - **TCP 링크 CRC 자동 생략**: TCP 프로토콜 계층에 맞춰 불필요한 후미 CRC 체크섬을 자동으로 생략합니다.
* **🔌 Modbus RTU CRC-16 On/Off 토글 지원**
  - `☑️ CRC-16 Modbus 자동 부착` 옵션을 추가하여, 체크 해제 시 CRC 없는 순수 PDU(Protocol Data Unit) 또는 특수 프레임도 손쉽게 생성할 수 있습니다.

---

### [🎨 UI/UX 편의성 향상]
* **MBAP 실시간 시각화 블록 칩 (Visual Breakdown Chips)**
  - 완성된 패킷 미리보기 영역에서 `[Trans]`, `[Proto]`, `[Len]`, `[Unit]`, `[FC]`, `[Addr/Data]` 필드를 색상별 블록 칩으로 명확히 구분하여 가독성을 극대화했습니다.
* **즐겨찾기 라벨 프로토콜 자동 구분**
  - 즐겨찾기 등록 시 `Modbus RTU FC03 요청` 및 `Modbus TCP FC03 응답` 등으로 프로토콜 명칭이 자동 세분화되어 저장됩니다.

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

**전체 커밋 비교**: https://github.com/rlatjd1f/open-com-analyzer/compare/v0.0.9...v0.0.10

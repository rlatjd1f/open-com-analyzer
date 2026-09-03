## ⚡️ Open COM Analyzer v0.0.1 릴리즈 안내

시리얼(Serial / RS-232 / RS-485) 및 TCP 통신 패킷을 실시간 바이트 매트릭스로 분석하고 송수신하는 크로스플랫폼 분석기 **Open COM Analyzer**의 첫 번째 공식 릴리즈입니다.

---

### 🚀 주요 작업 내역 및 기능 요약

#### 1. 📐 개행 단위 패킷 스트림 & 정밀 바이트 매트릭스
* **정밀 타임스탬프 (`HH:mm:ss.SSS`)**: 각 패킷 행 좌측에 밀리초 단위 시간, `[RX]` / `[TX]` 방향 뱃지, 패킷 바이트 수(`8 B`, `165 B`) 표시
* **완벽한 수직 정렬**: 좌측 메타데이터 열 폭을 고정하여 패킷 길이에 관계없이 첫 번째 바이트 셀이 항상 정렬
* **1:1 바이트 셀 & 호버 인스펙터**: 마우스 오버 시 HEX, DEC, ASCII, 바이트 오프셋(`#1`) 즉시 확인 가능

#### 2. 🔌 다중 통신 인터페이스
* **Serial Port**: USB-to-UART / COM 포트 자동 감지 및 보드레이트(9,600 ~ 921,600 bps), 데이터 비트, 패리티 설정 지원
* **TCP Server (기본 Port: 121)**: 소켓 서버 구동 및 다중 클라이언트 접속자 수 실시간 모니터링
* **TCP Client**: 원격 디바이스 IP/Port 직접 접속
* **가상 장치 시뮬레이터 (Virtual Device)**: Modbus RTU Slave 에코 및 센서 스트리밍 시뮬레이터 내장

#### 3. 🧮 4종 통신 계산 및 변환 도구 (Utility Panel)
* **Sum Check**: 8-bit 및 16-bit 체크섬 실시간 연산
* **CRC-16 Check**: 산업 표준 **Modbus RTU CRC** (LSB first) 및 **CCITT CRC-16** 연산
* **Binary → ASCII / ASCII → Binary**: 16진수 바이트와 텍스트 문자열 간 즉시 상호 변환 및 원클릭 전송창 적용

#### 4. ⚡️ 자동 송신 모드
* **`RX 반응발송` (1:1 반응형 자동 응답)**: 새로운 RX 패킷 수신 시마다 1:1로 대응하여 설정된 송신 데이터를 정확히 1회씩 자동 응답 발송 (응답 지연 ms 조절 가능)
* **`주기전송`**: 설정한 주기(ms)마다 데이터를 자동 반복 발송

#### 5. 🪟 다중 윈도우 지원 (Multi-Window)
* **단축키 `Cmd + N` (Windows: `Ctrl + N`)** 또는 상단 **`[새 창]`** 버튼으로 독립된 세션의 새 창 생성
* Master ↔ Slave 실시간 통신 대조 테스트 지원

#### 6. ⚡️ 성능 최적화 & 버퍼 관리 (60fps 고정)
* **`React.memo` & CSS Variables**: 신규 패킷 수신 시 기존 1,000줄 리렌더링 차단 및 GPU 가속 0ms 즉시 테마 전환
* **레이아웃 격리 (`contain`)**: 창 크기 변경(Resize) 시 끊김 없는 60fps 유지
* **FIFO 링 버퍼**: 1,000줄 한도 메모리 보호 및 화면 초기화(`Cmd + K`)

---

### 📦 다운로드 안내 (Assets)

* **macOS (Apple Silicon M1/M2/M3/M4)**: `COM-Analyzer-macOS-arm64.zip`
* **macOS (Intel Core i5/i7/i9)**: `COM-Analyzer-macOS-x64.zip`
* **Windows (64-bit)**: `COM-Analyzer-Windows-x64.zip`

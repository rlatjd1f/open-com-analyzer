# ⚡️ Open COM Analyzer

> **Modern Cross-Platform Serial & TCP Packet Analyzer**  
> 시리얼(Serial / COM / USB-to-UART / RS-232 / RS-485) 및 TCP 소켓 패킷을 실시간 바이트 격자 매트릭스로 분석하고 송수신하는 크로스플랫폼 통신 분석 도구입니다.

---

## ✨ 주요 기능 (Key Features)

### 1. 📐 개행 단위 패킷 스트림 & 정밀 바이트 매트릭스
- **정밀 타임스탬프**: 각 패킷 행 좌측에 밀리초 단위 시간(`HH:mm:ss.SSS`), 방향 뱃지(`[RX]` / `[TX]`), 패킷 길이(`8 B`) 표시
- **정사각형(1:1) 바이트 셀**: 패킷 데이터가 1:1 정사각형 블록으로 깔끔하게 배치되며 완벽한 수직 정렬 지원
- **마우스 호버 인스펙터**: 바이트 셀 위에 마우스를 올리면 HEX, DEC, ASCII, 패킷 오프셋 정보 즉시 확인
- **고대비 시인성**: 고선명 스크롤바, 고대비 바이트 수 뱃지 및 큰 글씨 폰트 적용

### 2. 🔌 다중 통신 인터페이스 지원
- **시리얼 포트 (Serial Port)**: USB-to-UART, FTDI, CP210x, CH340 등 시리얼 디바이스 자동 감지 및 보드레이트(9,600 ~ 921,600 bps), 데이터 비트, 패리티, 정지 비트 설정
- **TCP Server 모드**: 기본 Port: 121로 소켓 서버를 열어 다중 클라이언트 접속 및 통신 모니터링
- **TCP Client 모드**: 원격 TCP 서버 IP/Port로 직접 접속하여 패킷 모니터링
- **가상 장치 시뮬레이터 (Virtual Device)**: 하드웨어가 없는 환경에서도 즉시 테스트할 수 있는 Modbus RTU Slave 에코 및 센서 스트리밍 시뮬레이터 내장

### 3. 🧮 4종 통신 계산 및 변환 도구 (Utility Panel)
1. **Sum Check**: 8-bit 및 16-bit 체크섬 실시간 연산
2. **CRC-16 Check**: 산업 표준 **Modbus RTU CRC** (LSB first) 및 **CCITT CRC-16** 연산
3. **Binary → ASCII**: 16진수 바이트를 텍스트로 즉시 디코딩
4. **ASCII → Binary**: 텍스트 문자열을 16진수 바이트열로 즉시 인코딩
- 원클릭 "보내는데이터 적용 (Apply to Send)" 및 클립보드 복사 지원

### 4. ⚡️ 듀얼 자동 송신 모드
- **`RX 반응발송` (1:1 반응형 자동 응답)**: 새로운 RX 패킷이 수신될 때마다 1:1로 대응하여 설정된 송신 데이터를 정확히 1회씩 자동 응답 전송 (하프 듀플렉스 타이밍용 지연 ms 조절 가능)
- **`주기전송` (반복 인터벌 전송)**: 설정한 주기(ms)마다 데이터를 지속적으로 자동 반복 발송

### 5. 📦 FIFO 링 버퍼 & 성능 최적화
- 기본 **1,000줄(패킷)** 한도 관리로 24시간 장시간 통신에도 메모리 누수 없이 부드러운 60fps 유지
- 500개 / 1,000개 / 2,000개 / 5,000개 / 무제한 버퍼 크기 선택 가능
- 우측 패널 실시간 버퍼 현황 및 원클릭 `화면 지우기` 지원

### 6. 🎨 멀티 테마 & 단축키
- **테마**: Classic Retro (Windows COM Analyzer 스타일), Modern Dark, Modern Light
- **단축키**:
  - `Cmd + ,` / `Ctrl + ,` : 환경설정 창 열기/닫기
  - `Cmd + K` / `Ctrl + K` : 화면 버퍼 초기화 (Clear)
  - `Space` : 화면 일시정지 / 재개 (Freeze / Resume)

---

## 🛠 기술 스택 (Tech Stack)

- **Frontend**: React 18, TypeScript, Tailwind CSS, Vite, Lucide Icons
- **Desktop Runtime**: Electron
- **Hardware/Socket Engine**: Node.js `serialport`, `net`, `ws`

---

## 🚀 시작하기 (Getting Started)

### 1. 레포지토리 클론 및 의존성 설치
```bash
git clone https://github.com/rlatjd1f/open-com-analyzer.git
cd open-com-analyzer
npm install
```

### 2. 개발 모드 실행
```bash
# Vite 웹 프론트엔드 + 백엔드 서버 동시 실행
npm run dev

# Electron 데스크톱 앱 개발 모드 실행
npm run desktop
```

### 3. 프로덕션 빌드 및 패키징
```bash
# TypeScript 검사 및 Vite 빌드
npm run build

# macOS 데스크톱 앱 빌드
npm run package:mac

# macOS /Applications 에 직접 설치
npm run install:app
```

---

## 📄 라이선스 (License)

MIT License. 자유롭게 사용, 수정, 배포하실 수 있습니다.

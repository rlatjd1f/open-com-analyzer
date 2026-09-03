# ⚡️ Open COM Analyzer

<div align="center">

![Platform](https://img.shields.io/badge/Platform-macOS%20%7C%20Windows-blue?style=for-the-badge&logo=apple&logoColor=white)
![Electron](https://img.shields.io/badge/Electron-44.1-47848F?style=for-the-badge&logo=electron&logoColor=white)
![React](https://img.shields.io/badge/React-19-61DAFB?style=for-the-badge&logo=react&logoColor=black)
![TypeScript](https://img.shields.io/badge/TypeScript-5.0-3178C6?style=for-the-badge&logo=typescript&logoColor=white)
![License](https://img.shields.io/badge/License-MIT-green?style=for-the-badge)

**Modern Cross-Platform Serial (RS-232/485) & TCP Packet Analyzer**  
*Windows 명작 COM Analyzer의 감성과 직관성을 계승하고, 최신 하드웨어 가속 기술로 재탄생한 크로스플랫폼 통신 분석기*

[📥 최신 릴리즈 다운로드 (Releases)](https://github.com/rlatjd1f/open-com-analyzer/releases)

</div>

---

## 📸 미리보기 (Screenshots)

### 1. 🪟 다중 윈도우 동시 실행 (Multi-Window Side-by-Side)
> `Cmd + N` (Windows: `Ctrl + N`) 또는 상단 **`[새 창]`** 버튼으로 독립된 세션을 가진 창을 여러 개 열어 **Master ↔ Slave 실시간 통신 대조 테스트**를 손쉽게 수행할 수 있습니다.

![Multi-Window Side-by-Side](assets/screenshots/multi-window.png)

---

### 2. 🕹️ 클래식 레트로 테마 (Classic Retro Theme)
> Windows 오리지널 COM Analyzer 특유의 직관적인 감성을 그대로 구현한 테마입니다. 개행 단위 패킷 스트림, `HH:mm:ss.SSS` 정밀 타임스탬프, 바이트 수 뱃지, 실시간 RX 반응발송 및 4종 계산기를 한 화면에서 직관적으로 다룰 수 있습니다.

![Classic Retro Theme](assets/screenshots/retro-theme.png)

---

### 3. 🌙 모던 다크 테마 (Modern Dark Theme)
> 야간 및 장시간 분석 작업 시 눈의 피로도를 최소화하는 고대비 딥 네이비/블랙 모던 다크 테마입니다.

![Modern Dark Theme](assets/screenshots/dark-theme.png)

---

## ✨ 핵심 기능 (Key Features)

### 1. 📐 개행 단위 패킷 스트림 & 완벽한 수직 정렬
- **밀리초 정밀 타임스탬프**: 각 패킷 행 좌측에 `HH:mm:ss.SSS` 시간, `[RX]`/`[TX]` 방향 뱃지, `8 B`/`165 B` 바이트 수 뱃지 표시
- **100% 수직 정렬**: 좌측 메타데이터 열 폭을 고정하여 패킷 길이에 상관없이 첫 번째 바이트 셀이 항상 완벽하게 수직 정렬
- **1:1 정사각형 바이트 셀**: 16진수(`01 03 A0 ...`) 및 ASCII 문자를 1:1 정사각형 블록으로 깔끔하게 렌더링
- **마우스 호버 인스펙터**: 바이트 셀에 마우스를 올리면 HEX, DEC, ASCII, 패킷 내부 바이트 오프셋(`#1`) 툴팁 즉시 팝업

### 2. 🔌 다중 통신 인터페이스 지원
- **Serial Port (COM)**: USB-to-UART, FTDI, CP210x, CH340 등 시리얼 포트 자동 감지 (9,600 ~ 921,600 bps, Data Bits, Parity, Stop Bits)
- **TCP Server 모드**: 기본 Port: 121로 소켓 서버를 열어 다중 클라이언트 접속 및 통신 패킷 실시간 모니터링
- **TCP Client 모드**: 원격 TCP 서버 IP/Port로 직접 접속하여 송수신 테스트
- **가상 장치 시뮬레이터 (Virtual Device)**: 하드웨어 장비가 없는 환경에서도 즉시 테스트 가능한 Modbus RTU Slave 에코 및 센서 스트리밍 시뮬레이터 내장

### 3. 🧮 4종 내장 계산 및 변환 도구 (Utility Panel)
1. **Sum Check**: 8-bit 및 16-bit 체크섬 실시간 연산
2. **CRC-16 Check**: 산업 표준 **Modbus RTU CRC** (LSB first: 예: `010600EF0001` 입력 시 `79 FF` 산출) 및 **CCITT CRC-16** 연산
3. **Binary → ASCII**: 16진수 바이트를 텍스트 문자열로 즉시 디코딩
4. **ASCII → Binary**: 텍스트 문자열을 16진수 HEX 바이트열로 즉시 인코딩
- 원클릭 "보내는데이터 적용" 및 클립보드 복사 지원

### 4. ⚡️ 듀얼 자동 송신 모드
- **`RX 반응발송` (1:1 반응형 자동 응답)**: 새로운 RX 패킷이 수신될 때마다 1:1로 대응하여 설정된 송신 데이터를 정확히 1회씩 자동 응답 전송 (하프 듀플렉스 타이밍용 지연 ms 조절 가능)
- **`주기전송` (반복 인터벌 전송)**: 설정한 주기(ms)마다 데이터를 지속적으로 자동 반복 발송

### 5. 🚀 초고속 렌더 파이프라인 & FIFO 링 버퍼 (60fps 고정)
- **`React.memo` & CSS Variables**: 신규 패킷 수신 시 기존 1,000줄의 패킷 리렌더링을 차단하고, 테마 변경 시 GPU 가속으로 0.001초 만에 즉시 색상 전환
- **`contain: layout style`**: 통신 도중 창 크기를 마구 리사이즈해도 프레임 드랍 없이 부드러운 반응성 유지
- **FIFO 링 버퍼 (기본 1,000줄)**: 장시간 통신 시에도 메모리 누수 없이 부드러운 스크롤 유지 (500 / 1,000 / 2,000 / 5,000 / 무제한 선택 가능)
- **실시간 버퍼 현황 및 원클릭 `화면 지우기` (`Cmd + K`)**

---

## ⌨️ 단축키 안내 (Keyboard Shortcuts)

| 단축키 (macOS) | 단축키 (Windows) | 동작 설명 |
| :--- | :--- | :--- |
| **`Cmd + N`** | **`Ctrl + N`** | **새 창 열기 (독립된 세션의 새 COM Analyzer 창 생성)** |
| **`Cmd + ,`** | **`Ctrl + ,`** | **환경설정 창 열기 / 닫기 (시리얼, TCP, 가상장치, 버퍼설정)** |
| **`Cmd + K`** | **`Ctrl + K`** | **화면 버퍼 즉시 초기화 (Clear Screen)** |
| **`Space`** | **`Space`** | **화면 일시정지 / 실시간 수신 재개 (Freeze / Resume)** |

---

## 🛠 기술 스택 (Tech Stack)

- **Desktop Framework**: Electron 44
- **Frontend**: React 19, TypeScript, Tailwind CSS, Vite, Lucide Icons
- **Communication Engine**: Node.js `serialport`, `net`, `ws`

---

## 🚀 개발 및 빌드 가이드 (Getting Started)

### 1. 레포지토리 클론 및 패키지 설치
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

# macOS 전용 (.app 패키징)
npm run package:mac

# Windows 전용 (x64 패키징)
npm run package:win

# macOS /Applications 에 직접 설치
npm run install:app
```

---

## 📄 라이선스 (License)

This project is licensed under the **MIT License**.
자유롭게 사용, 수정, 배포하실 수 있습니다.

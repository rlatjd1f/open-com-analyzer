## Open COM Analyzer v0.0.13 릴리즈 노트

Open COM Analyzer v0.0.13 업데이트에서는 **실시간 RX/TX 패킷 프로토콜 분석기(Packet Inspector)** 및 **Modbus 레지스터 페이로드 심층 디코더(2B/4B/8B 단위 및 Float32/Int32 자동 감지)**, **Function Code 및 파라미터 자동 동기화 기능**이 새롭게 추가되었습니다.

---

### ✨ 신규 기능 (New Features)

- **🔍 실시간 패킷 프로토콜 분석기 (Packet Inspector)**
  - 패킷 그리드에서 행 더블클릭 또는 `[분석]` 버튼 클릭 시 실행되는 전용 분석 팝업 지원
  - **다계층 프로토콜 자동 식별**: Modbus TCP(MBAP 헤더, TID, 프로토콜 ID, 국번, PDU), Modbus RTU(슬레이브 국번, 기능 코드, 데이터, CRC-16), 일반 표준/Raw 프레임(STX, ETX 등) 자동 분해
  - **실시간 CRC-16 검증**: Modbus RTU 수신 패킷의 CRC-16(LSB/MSB) 계산 및 일치 여부 실시간 검증 (`CRC✓` / `CRC✗`)
  - **인터랙티브 바이트 스트림 맵**: 필드별 컬러 하이라이트 및 개별 바이트 클릭 시 해당 필드 상세 포커스, ASCII 동시 변환 제공
  - **편의 액션**: `[전체 HEX 복사]`, `[분석 리포트 복사]`, `[전송창에 패킷 넣기]` 원클릭 지원

- **📊 Modbus 레지스터 페이로드 심층 디코더 (Register Data Decoder)**
  - **지능형 데이터 타입 자동 감지**: 수신된 레지스터 바이트열을 스캔하여 `4바이트 Float32 (IEEE 754 실수)`, `32비트 정수(UInt32/Int32)`, `64비트 Double`, `16비트 정수`를 자동 추정하고 추천 뱃지 제공
  - **단위 크기 전환**: `2B (16-bit)`, `4B (32-bit)`, `8B (64-bit)` 단위 선택
  - **표시 형식 지원**: `Float32`, `UInt32`, `Int32`, `UInt16`, `Int16`, `HEX`, `Binary`, `Double (Float64)`
  - **바이트 순서(Endian / Word-Swap) 즉시 변경**: `ABCD (표준 Big-Endian)`, `CDAB (Word-Swap / Modicon)`, `BADC (Byte-Swap)`, `DCBA (Little-Endian)` 지원
  - **레지스터 디코딩 표 & 일괄 복사**: 각 레지스터 구간별 HEX 및 실측 변환값 표 렌더링, `[디코딩 표 복사]` 및 개별 값 복사 기능 제공

- **🛠 패킷 생성기 4바이트(Float/DINT) 지원 및 샘플 생성**
  - 패킷 생성기(Packet Builder)에서 16-bit(2B) 및 32-bit(4B) 단위 토글 지원
  - 4바이트 Modbus 표준 엔디안(ABCD, CDAB, DCBA, BADC) 및 32-bit Float / 고정 / 순차 / 랜덤 샘플 자동 생성 옵션 추가

- **⚡ Function Code 및 요청 파라미터 자동 동기화**
  - Modbus RTU 및 TCP 응답 생성 시 수신된 요청의 Function Code(FC), 국번, 시작 주소, 수량을 기본값으로 자동 매핑
  - RX 반응발송(자동 응답) 모드에서 RTU 및 TCP 요청 형식(단일/다중 쓰기 에코 및 읽기 응답, CRC 재계산)에 맞춰 실시간 동기화 발송 지원

---

### 🛠 버그 수정 및 안정성 개선 (Bug Fixes & Improvements)

- **ESC 키보드 단축키 지원**: 패킷 상세 분석 팝업이 열려 있을 때 `ESC` 키를 눌러 즉시 닫을 수 있도록 개선
- **버튼 텍스트 줄바꿈 방지**: 패킷 그리드 좌측 정보 영역의 너비를 확장하고 `whitespace-nowrap`을 적용하여 `[분석]`, `[복사]` 버튼 라벨이 세로로 줄바꿈되지 않고 가로로 안정적으로 표시되도록 수정
- **원클릭 패킷 복사**: RX/TX 패킷 그리드 행 클릭 시 전체 HEX 문자열 클립보드 즉시 복사 및 초록색 하이라이트 시각 피드백 유지

---

### 🎨 UI/UX 편의성 향상 (UI/UX Enhancements)

- 패킷 생성기 멀티라인 레이아웃 정돈 (수량 설정, 순서/패턴 설정, 생성 적용 버튼 일관 배치)
- 다크 / 라이트 / 레트로 테마 전반에 걸쳐 패킷 분석기 및 레지스터 디코딩 패널의 시각적 일관성 확보

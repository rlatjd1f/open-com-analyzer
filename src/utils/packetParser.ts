import { calculateCrc16Modbus } from './crc';

export type ProtocolType = 'modbus-tcp' | 'modbus-rtu' | 'custom-frame' | 'raw';

export interface PacketField {
  name: string;
  bytes: number[];
  byteRange: [number, number]; // [startIndex, endIndex inclusive]
  hex: string;
  dec?: number | string;
  description: string;
  tagColor?: string;
}

export interface ParsedPacketResult {
  protocol: ProtocolType;
  protocolLabel: string;
  summary: string;
  isModbus: boolean;
  messageType?: 'request' | 'response' | 'exception';
  slaveOrUnitId?: number;
  functionCode?: number;
  functionName?: string;
  fields: PacketField[];
  isValidCrc?: boolean;
  notes?: string[];
  registerPayload?: number[];
}

const MODBUS_FUNCTION_NAMES: Record<number, string> = {
  1: 'Read Coils (0x01, 코일 상태 읽기)',
  2: 'Read Discrete Inputs (0x02, 이산 입력 읽기)',
  3: 'Read Holding Registers (0x03, 홀딩 레지스터 읽기)',
  4: 'Read Input Registers (0x04, 입력 레지스터 읽기)',
  5: 'Write Single Coil (0x05, 단일 코일 쓰기)',
  6: 'Write Single Register (0x06, 단일 레지스터 쓰기)',
  15: 'Write Multiple Coils (0x0F, 다중 코일 쓰기)',
  16: 'Write Multiple Registers (0x10, 다중 레지스터 쓰기)'
};

const MODBUS_EXCEPTION_NAMES: Record<number, string> = {
  1: '01 (Illegal Function, 지원하지 않는 기능 코드)',
  2: '02 (Illegal Data Address, 유효하지 않은 데이터 주소)',
  3: '03 (Illegal Data Value, 유효하지 않은 데이터 값/범위)',
  4: '04 (Slave Device Failure, 슬레이브 장비 내부 고장)',
  5: '05 (Acknowledge, 요청 수락 후 처리 중)',
  6: '06 (Slave Device Busy, 슬레이브 장비 사용 중)'
};

function bytesToHex(bytes: number[]): string {
  return bytes.map((b) => b.toString(16).toUpperCase().padStart(2, '0')).join(' ');
}

/**
 * 1. Parse Modbus TCP Frame (MBAP Header + PDU)
 */
export function parseModbusTcp(bytes: number[]): ParsedPacketResult | null {
  if (bytes.length < 7) return null;

  const protoId = (bytes[2] << 8) | bytes[3];
  if (protoId !== 0) return null; // Protocol ID must be 0 for Modbus

  const tid = (bytes[0] << 8) | bytes[1];
  const lengthField = (bytes[4] << 8) | bytes[5];
  const unitId = bytes[6];

  const remainingBytes = bytes.length - 6;
  if (Math.abs(lengthField - remainingBytes) > 2 && lengthField !== remainingBytes) {
    return null;
  }

  const fields: PacketField[] = [
    {
      name: '트랜잭션 ID (Transaction ID)',
      bytes: [bytes[0], bytes[1]],
      byteRange: [0, 1],
      hex: bytesToHex([bytes[0], bytes[1]]),
      dec: tid,
      description: `요청과 응답을 식별하는 고유 트랜잭션 번호 (0x${tid.toString(16).toUpperCase().padStart(4, '0')})`,
      tagColor: 'blue'
    },
    {
      name: '프로토콜 ID (Protocol ID)',
      bytes: [bytes[2], bytes[3]],
      byteRange: [2, 3],
      hex: bytesToHex([bytes[2], bytes[3]]),
      dec: 0,
      description: 'Modbus 프로토콜 식별자 (0x0000 = Modbus TCP 표준)',
      tagColor: 'zinc'
    },
    {
      name: '길이 필드 (Length)',
      bytes: [bytes[4], bytes[5]],
      byteRange: [4, 5],
      hex: bytesToHex([bytes[4], bytes[5]]),
      dec: `${lengthField} Bytes`,
      description: `이 필드 이후에 뒤따르는 바이트 수 (Unit ID 1B + PDU ${lengthField - 1}B)`,
      tagColor: 'zinc'
    },
    {
      name: '국번 (Unit ID)',
      bytes: [bytes[6]],
      byteRange: [6, 6],
      hex: bytesToHex([bytes[6]]),
      dec: unitId,
      description: `Modbus 슬레이브 장치 번호 (국번 ${unitId})`,
      tagColor: 'indigo'
    }
  ];

  if (bytes.length === 7) {
    return {
      protocol: 'modbus-tcp',
      protocolLabel: 'Modbus TCP',
      summary: `Modbus TCP 헤더 (TID: 0x${tid.toString(16).toUpperCase().padStart(4, '0')}, Unit: ${unitId})`,
      isModbus: true,
      slaveOrUnitId: unitId,
      fields
    };
  }

  const rawFc = bytes[7];
  let messageType: 'request' | 'response' | 'exception' = 'request';
  let functionCode = rawFc;
  let functionName = MODBUS_FUNCTION_NAMES[rawFc] || `Function Code ${rawFc}`;

  // Exception check (rawFc >= 0x80)
  if (rawFc >= 0x80) {
    messageType = 'exception';
    functionCode = rawFc - 0x80;
    const errCode = bytes.length > 8 ? bytes[8] : 0;
    const errDesc = MODBUS_EXCEPTION_NAMES[errCode] || `에러 코드 0x${errCode.toString(16).toUpperCase()}`;

    fields.push({
      name: '예외 기능 코드 (Exception FC)',
      bytes: [rawFc],
      byteRange: [7, 7],
      hex: bytesToHex([rawFc]),
      dec: `0x${rawFc.toString(16).toUpperCase()} (원래 FC: ${functionCode})`,
      description: `요청 실패 시 MSB가 1로 세팅된 예외 응답 코드 (FC ${functionCode} + 0x80)`,
      tagColor: 'rose'
    });

    if (bytes.length > 8) {
      fields.push({
        name: '예외 코드 (Exception Code)',
        bytes: [errCode],
        byteRange: [8, 8],
        hex: bytesToHex([errCode]),
        dec: errCode,
        description: errDesc,
        tagColor: 'rose'
      });
    }

    return {
      protocol: 'modbus-tcp',
      protocolLabel: 'Modbus TCP',
      summary: `[예외 응답] FC ${functionCode.toString().padStart(2, '0')} 오류 (${errDesc})`,
      isModbus: true,
      messageType,
      slaveOrUnitId: unitId,
      functionCode,
      functionName: `예외 응답 (FC 0x${rawFc.toString(16).toUpperCase()})`,
      fields
    };
  }

  // Normal Function Code
  fields.push({
    name: '기능 코드 (Function Code)',
    bytes: [rawFc],
    byteRange: [7, 7],
    hex: bytesToHex([rawFc]),
    dec: `0x${rawFc.toString(16).toUpperCase().padStart(2, '0')} (${rawFc})`,
    description: functionName,
    tagColor: 'emerald'
  });

  if (bytes.length === 12 && [1, 2, 3, 4, 5, 6].includes(rawFc)) {
    messageType = 'request';
    const addr = (bytes[8] << 8) | bytes[9];
    const qtyOrVal = (bytes[10] << 8) | bytes[11];

    fields.push({
      name: '시작 주소 (Start Address)',
      bytes: [bytes[8], bytes[9]],
      byteRange: [8, 9],
      hex: bytesToHex([bytes[8], bytes[9]]),
      dec: addr,
      description: `조회 또는 제어할 레지스터 시작 주소 (0x${addr.toString(16).toUpperCase().padStart(4, '0')})`,
      tagColor: 'amber'
    });

    fields.push({
      name: rawFc === 5 || rawFc === 6 ? '설정 값 (Value)' : '요청 개수 (Quantity)',
      bytes: [bytes[10], bytes[11]],
      byteRange: [10, 11],
      hex: bytesToHex([bytes[10], bytes[11]]),
      dec: qtyOrVal,
      description: rawFc === 5 || rawFc === 6
        ? `설정할 단일 값 (0x${qtyOrVal.toString(16).toUpperCase().padStart(4, '0')})`
        : `연속으로 읽어올 레지스터/코일 개수 (${qtyOrVal}개)`,
      tagColor: 'amber'
    });

    const actionText = rawFc <= 4 ? `읽기 요청 (주소: ${addr}, 수량: ${qtyOrVal}개)` : `쓰기 요청 (주소: ${addr}, 값: ${qtyOrVal})`;
    return {
      protocol: 'modbus-tcp',
      protocolLabel: 'Modbus TCP',
      summary: `[마스터 요청] FC ${rawFc.toString().padStart(2, '0')} ${actionText}`,
      isModbus: true,
      messageType,
      slaveOrUnitId: unitId,
      functionCode: rawFc,
      functionName,
      fields
    };
  } else if ([1, 2, 3, 4].includes(rawFc) && bytes.length >= 9) {
    messageType = 'response';
    const byteCount = bytes[8];
    const dataBytes = bytes.slice(9);

    fields.push({
      name: '응답 바이트 수 (Byte Count)',
      bytes: [byteCount],
      byteRange: [8, 8],
      hex: bytesToHex([byteCount]),
      dec: `${byteCount} Bytes`,
      description: `뒤따르는 데이터 바이트의 총 개수 (${Math.floor(byteCount / 2)}개 레지스터)`,
      tagColor: 'amber'
    });

    if (dataBytes.length > 0) {
      fields.push({
        name: '레지스터 데이터 (Register Data)',
        bytes: dataBytes,
        byteRange: [9, bytes.length - 1],
        hex: bytesToHex(dataBytes),
        dec: `${dataBytes.length} Bytes`,
        description: `슬레이브 장치에서 읽어온 데이터 페이로드 (${Math.floor(dataBytes.length / 2)}개 레지스터)`,
        tagColor: 'emerald'
      });
    }

    return {
      protocol: 'modbus-tcp',
      protocolLabel: 'Modbus TCP',
      summary: `[슬레이브 응답] FC ${rawFc.toString().padStart(2, '0')} 데이터 응답 (${dataBytes.length}B, ${Math.floor(dataBytes.length / 2)}개 레지스터)`,
      isModbus: true,
      messageType,
      slaveOrUnitId: unitId,
      functionCode: rawFc,
      functionName,
      fields,
      registerPayload: dataBytes
    };
  } else if ([5, 6, 15, 16].includes(rawFc) && bytes.length === 12) {
    messageType = 'response';
    const addr = (bytes[8] << 8) | bytes[9];
    const valOrQty = (bytes[10] << 8) | bytes[11];

    fields.push({
      name: '확인 주소 (Echo Address)',
      bytes: [bytes[8], bytes[9]],
      byteRange: [8, 9],
      hex: bytesToHex([bytes[8], bytes[9]]),
      dec: addr,
      description: `쓰기 성공 확인 시작 주소 (0x${addr.toString(16).toUpperCase().padStart(4, '0')})`,
      tagColor: 'amber'
    });

    fields.push({
      name: rawFc <= 6 ? '확인 값 (Echo Value)' : '확인 수량 (Echo Quantity)',
      bytes: [bytes[10], bytes[11]],
      byteRange: [10, 11],
      hex: bytesToHex([bytes[10], bytes[11]]),
      dec: valOrQty,
      description: `쓰기 정상 확인 파라미터 (${valOrQty})`,
      tagColor: 'amber'
    });

    return {
      protocol: 'modbus-tcp',
      protocolLabel: 'Modbus TCP',
      summary: `[슬레이브 응답] FC ${rawFc.toString().padStart(2, '0')} 쓰기 완료 에코 (주소: ${addr})`,
      isModbus: true,
      messageType,
      slaveOrUnitId: unitId,
      functionCode: rawFc,
      functionName,
      fields
    };
  }

  if (bytes.length > 8) {
    fields.push({
      name: 'PDU 페이로드 (Data Payload)',
      bytes: bytes.slice(8),
      byteRange: [8, bytes.length - 1],
      hex: bytesToHex(bytes.slice(8)),
      description: 'Modbus PDU 데이터 필드',
      tagColor: 'zinc'
    });
  }

  return {
    protocol: 'modbus-tcp',
    protocolLabel: 'Modbus TCP',
    summary: `Modbus TCP 프레임 (Unit: ${unitId}, FC: ${rawFc})`,
    isModbus: true,
    slaveOrUnitId: unitId,
    functionCode: rawFc,
    functionName,
    fields
  };
}

/**
 * 2. Parse Modbus RTU Frame (Slave ID + PDU + CRC-16)
 */
export function parseModbusRtu(bytes: number[]): ParsedPacketResult | null {
  if (bytes.length < 4) return null;

  const slaveId = bytes[0];
  const rawFc = bytes[1];

  if (bytes.length >= 7 && bytes[2] === 0 && bytes[3] === 0) {
    return null;
  }

  const payloadBytes = new Uint8Array(bytes.slice(0, -2));
  const calcCrc = calculateCrc16Modbus(payloadBytes);
  const calcLow = calcCrc & 0xFF;
  const calcHigh = (calcCrc >> 8) & 0xFF;

  const recvLow = bytes[bytes.length - 2];
  const recvHigh = bytes[bytes.length - 1];

  const isValidCrcLsb = recvLow === calcLow && recvHigh === calcHigh;
  const isValidCrcMsb = recvLow === calcHigh && recvHigh === calcLow;
  const isValidCrc = isValidCrcLsb || isValidCrcMsb;

  if (!isValidCrc && ![1, 2, 3, 4, 5, 6, 15, 16].includes(rawFc) && rawFc < 0x80) {
    return null;
  }

  const fields: PacketField[] = [
    {
      name: '국번 (Slave ID)',
      bytes: [slaveId],
      byteRange: [0, 0],
      hex: bytesToHex([slaveId]),
      dec: slaveId,
      description: `슬레이브 장치 국번 주소 (0x${slaveId.toString(16).toUpperCase().padStart(2, '0')})`,
      tagColor: 'indigo'
    }
  ];

  let messageType: 'request' | 'response' | 'exception' = 'request';
  let functionCode = rawFc;
  let functionName = MODBUS_FUNCTION_NAMES[rawFc] || `Function Code ${rawFc}`;
  let responseRegisterPayload: number[] | undefined;

  if (rawFc >= 0x80) {
    messageType = 'exception';
    functionCode = rawFc - 0x80;
    const errCode = bytes.length >= 5 ? bytes[2] : 0;
    const errDesc = MODBUS_EXCEPTION_NAMES[errCode] || `에러 코드 0x${errCode.toString(16).toUpperCase()}`;

    fields.push({
      name: '예외 기능 코드 (Exception FC)',
      bytes: [rawFc],
      byteRange: [1, 1],
      hex: bytesToHex([rawFc]),
      dec: `0x${rawFc.toString(16).toUpperCase()} (원래 FC: ${functionCode})`,
      description: `요청 실패 시 MSB가 1로 세팅된 예외 응답 코드 (FC ${functionCode} + 0x80)`,
      tagColor: 'rose'
    });

    if (bytes.length >= 5) {
      fields.push({
        name: '예외 코드 (Exception Code)',
        bytes: [errCode],
        byteRange: [2, 2],
        hex: bytesToHex([errCode]),
        dec: errCode,
        description: errDesc,
        tagColor: 'rose'
      });
    }
  } else {
    fields.push({
      name: '기능 코드 (Function Code)',
      bytes: [rawFc],
      byteRange: [1, 1],
      hex: bytesToHex([rawFc]),
      dec: `0x${rawFc.toString(16).toUpperCase().padStart(2, '0')} (${rawFc})`,
      description: functionName,
      tagColor: 'emerald'
    });

    if (bytes.length === 8 && [1, 2, 3, 4, 5, 6].includes(rawFc)) {
      messageType = 'request';
      const addr = (bytes[2] << 8) | bytes[3];
      const qtyOrVal = (bytes[4] << 8) | bytes[5];

      fields.push({
        name: '시작 주소 (Start Address)',
        bytes: [bytes[2], bytes[3]],
        byteRange: [2, 3],
        hex: bytesToHex([bytes[2], bytes[3]]),
        dec: addr,
        description: `조회 또는 제어할 레지스터 시작 주소 (0x${addr.toString(16).toUpperCase().padStart(4, '0')})`,
        tagColor: 'amber'
      });

      fields.push({
        name: rawFc === 5 || rawFc === 6 ? '설정 값 (Value)' : '요청 개수 (Quantity)',
        bytes: [bytes[4], bytes[5]],
        byteRange: [4, 5],
        hex: bytesToHex([bytes[4], bytes[5]]),
        dec: qtyOrVal,
        description: rawFc === 5 || rawFc === 6
          ? `설정할 단일 값 (0x${qtyOrVal.toString(16).toUpperCase().padStart(4, '0')})`
          : `연속으로 읽어올 레지스터/코일 개수 (${qtyOrVal}개)`,
        tagColor: 'amber'
      });
    } else if ([1, 2, 3, 4].includes(rawFc) && bytes.length >= 5) {
      messageType = 'response';
      const byteCount = bytes[2];
      const dataBytes = bytes.slice(3, -2);
      responseRegisterPayload = dataBytes;

      fields.push({
        name: '응답 바이트 수 (Byte Count)',
        bytes: [byteCount],
        byteRange: [2, 2],
        hex: bytesToHex([byteCount]),
        dec: `${byteCount} Bytes`,
        description: `뒤따르는 데이터 바이트 수 (${Math.floor(byteCount / 2)}개 레지스터)`,
        tagColor: 'amber'
      });

      if (dataBytes.length > 0) {
        fields.push({
          name: '레지스터 데이터 (Register Data)',
          bytes: dataBytes,
          byteRange: [3, bytes.length - 3],
          hex: bytesToHex(dataBytes),
          dec: `${dataBytes.length} Bytes`,
          description: `슬레이브에서 읽어온 데이터 페이로드 (${Math.floor(dataBytes.length / 2)}개 레지스터)`,
          tagColor: 'emerald'
        });
      }
    }
  }

  fields.push({
    name: '오류 검증 코드 (CRC-16 Modbus)',
    bytes: [recvLow, recvHigh],
    byteRange: [bytes.length - 2, bytes.length - 1],
    hex: bytesToHex([recvLow, recvHigh]),
    dec: `0x${((recvHigh << 8) | recvLow).toString(16).toUpperCase().padStart(4, '0')}`,
    description: isValidCrc
      ? `CRC-16 검증 통과 (계산값: 0x${calcCrc.toString(16).toUpperCase().padStart(4, '0')} ✓)`
      : `CRC 오류 (수신값: 0x${((recvHigh << 8) | recvLow).toString(16).toUpperCase().padStart(4, '0')}, 계산값: 0x${calcCrc.toString(16).toUpperCase().padStart(4, '0')} ✗)`,
    tagColor: isValidCrc ? 'emerald' : 'rose'
  });

  return {
    protocol: 'modbus-rtu',
    protocolLabel: 'Modbus RTU',
    summary: `Modbus RTU (Slave: ${slaveId}, FC: ${rawFc}${isValidCrc ? ', CRC✓' : ', CRC✗'})`,
    isModbus: true,
    messageType,
    slaveOrUnitId: slaveId,
    functionCode,
    functionName,
    isValidCrc,
    fields,
    registerPayload: responseRegisterPayload
  };
}

/**
 * 3. Parse Generic / Custom Standard Frame (STX/ETX, Header, Payload, Checksum)
 */
export function parseCustomOrRawFrame(bytes: number[]): ParsedPacketResult {
  const fields: PacketField[] = [];
  let summary = `일반 데이터 패킷 (${bytes.length} Bytes)`;

  const hasStx = bytes[0] === 0x02;
  const hasEtx = bytes[bytes.length - 1] === 0x03;

  if (hasStx) {
    fields.push({
      name: '시작 문자 (STX)',
      bytes: [0x02],
      byteRange: [0, 0],
      hex: '02',
      description: 'Start of Text (텍스트 시작 구분자)',
      tagColor: 'blue'
    });
  }

  const payloadStart = hasStx ? 1 : 0;
  const payloadEnd = hasEtx ? bytes.length - 2 : bytes.length - 1;

  if (payloadEnd >= payloadStart) {
    const payloadBytes = bytes.slice(payloadStart, payloadEnd + 1);
    const asciiText = payloadBytes.map((b) => (b >= 32 && b <= 126 ? String.fromCharCode(b) : '.')).join('');

    fields.push({
      name: '페이로드 데이터 (Payload)',
      bytes: payloadBytes,
      byteRange: [payloadStart, payloadEnd],
      hex: bytesToHex(payloadBytes),
      dec: asciiText,
      description: `본문 데이터 (${payloadBytes.length} Bytes, ASCII: "${asciiText}")`,
      tagColor: 'emerald'
    });
  }

  if (hasEtx) {
    fields.push({
      name: '종료 문자 (ETX)',
      bytes: [0x03],
      byteRange: [bytes.length - 1, bytes.length - 1],
      hex: '03',
      description: 'End of Text (텍스트 종료 구분자)',
      tagColor: 'blue'
    });
  }

  return {
    protocol: 'custom-frame',
    protocolLabel: '표준 / Raw 프레임',
    summary,
    isModbus: false,
    fields
  };
}

/**
 * Comprehensive Multi-Tier Packet Decoder
 */
export function analyzePacket(bytes: number[]): ParsedPacketResult {
  if (!bytes || bytes.length === 0) {
    return {
      protocol: 'raw',
      protocolLabel: '빈 데이터',
      summary: '0 바이트 패킷',
      isModbus: false,
      fields: []
    };
  }

  // 1. Try Modbus TCP
  const tcpResult = parseModbusTcp(bytes);
  if (tcpResult) return tcpResult;

  // 2. Try Modbus RTU
  const rtuResult = parseModbusRtu(bytes);
  if (rtuResult) return rtuResult;

  // 3. Fallback to Generic Frame
  return parseCustomOrRawFrame(bytes);
}

// -------------------------------------------------------------
// Modbus Register Payload Analysis & Type Heuristics
// -------------------------------------------------------------

export interface DecodedRegisterRow {
  index: number;
  registerRangeLabel: string;
  byteOffsetLabel: string;
  hex: string;
  formattedValue: string;
  rawValue: number | bigint | string;
  binaryStr?: string;
}

export interface HeuristicTypeGuess {
  unitSize: 2 | 4 | 8;
  dataType: 'float32' | 'uint32' | 'int32' | 'uint16' | 'int16' | 'float64';
  byteOrder: string;
  confidence: 'high' | 'medium' | 'default';
  label: string;
  description: string;
}

/**
 * Heuristic auto-detector for Modbus register byte arrays.
 * Differentiates 2-byte, 4-byte (Float32 / Int32), 8-byte (Double / Int64).
 */
export function guessModbusDataType(bytes: number[]): HeuristicTypeGuess {
  if (!bytes || bytes.length < 2) {
    return {
      unitSize: 2,
      dataType: 'uint16',
      byteOrder: 'AB',
      confidence: 'default',
      label: '2바이트 UInt16',
      description: '기본 16비트 레지스터'
    };
  }

  // 1. Check 4-byte Float32 (ABCD: Big-Endian, CDAB: Word-Swap)
  if (bytes.length >= 4 && bytes.length % 4 === 0) {
    const totalChunks = bytes.length / 4;

    // Test ABCD
    let validFloatAbcd = 0;
    for (let i = 0; i < bytes.length; i += 4) {
      const b0 = bytes[i];
      const b1 = bytes[i + 1];
      const b2 = bytes[i + 2];
      const b3 = bytes[i + 3];

      if (b0 === 0 && b1 === 0 && b2 === 0 && b3 === 0) {
        validFloatAbcd++;
        continue;
      }

      const exp = ((b0 & 0x7F) << 1) | ((b1 & 0x80) >> 7);
      if (exp >= 80 && exp <= 165) {
        const view = new DataView(new ArrayBuffer(4));
        view.setUint8(0, b0);
        view.setUint8(1, b1);
        view.setUint8(2, b2);
        view.setUint8(3, b3);
        const val = view.getFloat32(0, false);
        if (!isNaN(val) && isFinite(val) && Math.abs(val) < 1e12) {
          validFloatAbcd++;
        }
      }
    }

    if (validFloatAbcd / totalChunks >= 0.7) {
      return {
        unitSize: 4,
        dataType: 'float32',
        byteOrder: 'ABCD',
        confidence: 'high',
        label: '4바이트 Float32 (IEEE 754 Big-Endian)',
        description: `연속된 ${totalChunks}개 레지스터 쌍 중 ${validFloatAbcd}개가 정상 부동소수점 실수(Float) 패턴과 일치합니다.`
      };
    }

    // Test CDAB (Word-Swap Float32)
    let validFloatCdab = 0;
    for (let i = 0; i < bytes.length; i += 4) {
      const b0 = bytes[i + 2];
      const b1 = bytes[i + 3];
      const b2 = bytes[i];
      const b3 = bytes[i + 1];

      if (b0 === 0 && b1 === 0 && b2 === 0 && b3 === 0) {
        validFloatCdab++;
        continue;
      }

      const exp = ((b0 & 0x7F) << 1) | ((b1 & 0x80) >> 7);
      if (exp >= 80 && exp <= 165) {
        const view = new DataView(new ArrayBuffer(4));
        view.setUint8(0, b0);
        view.setUint8(1, b1);
        view.setUint8(2, b2);
        view.setUint8(3, b3);
        const val = view.getFloat32(0, false);
        if (!isNaN(val) && isFinite(val) && Math.abs(val) < 1e12) {
          validFloatCdab++;
        }
      }
    }

    if (validFloatCdab / totalChunks >= 0.7) {
      return {
        unitSize: 4,
        dataType: 'float32',
        byteOrder: 'CDAB',
        confidence: 'high',
        label: '4바이트 Float32 (Word-Swap CDAB)',
        description: `연속된 ${totalChunks}개 레지스터 쌍 중 ${validFloatCdab}개가 워드 스왑 부동소수점 실수(Float) 패턴과 일치합니다.`
      };
    }

    // Test Int32 padding pattern (e.g. 00 00 XX XX)
    let int32PadCount = 0;
    for (let i = 0; i < bytes.length; i += 4) {
      if (bytes[i] === 0 && bytes[i + 1] === 0 && (bytes[i + 2] !== 0 || bytes[i + 3] !== 0)) {
        int32PadCount++;
      }
    }
    if (int32PadCount / totalChunks >= 0.6) {
      return {
        unitSize: 4,
        dataType: 'uint32',
        byteOrder: 'ABCD',
        confidence: 'medium',
        label: '4바이트 UInt32 (Big-Endian)',
        description: `연속된 4바이트 정수 상위 패딩(0x0000) 패턴이 감지되었습니다.`
      };
    }
  }

  // 2. Check 8-byte Double / Float64
  if (bytes.length >= 8 && bytes.length % 8 === 0) {
    const totalDoubleChunks = bytes.length / 8;
    let validDoubleCount = 0;
    for (let i = 0; i < bytes.length; i += 8) {
      const b0 = bytes[i];
      const b1 = bytes[i + 1];
      const exp = ((b0 & 0x7F) << 4) | ((b1 & 0xF0) >> 4);
      if (exp >= 900 && exp <= 1100) {
        validDoubleCount++;
      }
    }
    if (validDoubleCount / totalDoubleChunks >= 0.7) {
      return {
        unitSize: 8,
        dataType: 'float64',
        byteOrder: 'ABCDEFGH',
        confidence: 'medium',
        label: '8바이트 Double (Float64)',
        description: `8바이트 64비트 배정밀도 부동소수점 패턴이 감지되었습니다.`
      };
    }
  }

  // Default: 2-byte UInt16
  return {
    unitSize: 2,
    dataType: 'uint16',
    byteOrder: 'AB',
    confidence: 'default',
    label: '2바이트 UInt16 (표준 Modbus 1워드)',
    description: '16비트 단일 레지스터 기본 단위'
  };
}

/**
 * Decode register payload bytes into structured rows according to chosen unit size, data type, and byte order.
 */
export function decodeRegisterPayload(
  bytes: number[],
  unitSize: 2 | 4 | 8,
  dataType: string,
  byteOrder: string,
  startRegisterOffset: number = 0
): DecodedRegisterRow[] {
  if (!bytes || bytes.length === 0) return [];

  const rows: DecodedRegisterRow[] = [];
  const chunkSize = unitSize;
  const wordCount = unitSize / 2;

  for (let offset = 0; offset + chunkSize <= bytes.length; offset += chunkSize) {
    const rawChunk = bytes.slice(offset, offset + chunkSize);
    const itemIndex = Math.floor(offset / chunkSize);
    const regStart = startRegisterOffset + itemIndex * wordCount;
    const regEnd = regStart + wordCount - 1;

    const regLabel = wordCount === 1 ? `Reg #${regStart}` : `Reg #${regStart}..#${regEnd} (${wordCount}W)`;
    const byteOffsetLabel = `+${offset}B..+${offset + chunkSize - 1}B`;
    const hexStr = rawChunk.map((b) => b.toString(16).toUpperCase().padStart(2, '0')).join(' ');

    // Reorder bytes according to byteOrder
    let ordered: number[] = [];
    if (unitSize === 2) {
      if (byteOrder === 'BA') {
        ordered = [rawChunk[1], rawChunk[0]];
      } else {
        ordered = [rawChunk[0], rawChunk[1]]; // 'AB'
      }
    } else if (unitSize === 4) {
      if (byteOrder === 'CDAB') {
        ordered = [rawChunk[2], rawChunk[3], rawChunk[0], rawChunk[1]];
      } else if (byteOrder === 'BADC') {
        ordered = [rawChunk[1], rawChunk[0], rawChunk[3], rawChunk[2]];
      } else if (byteOrder === 'DCBA') {
        ordered = [rawChunk[3], rawChunk[2], rawChunk[1], rawChunk[0]];
      } else {
        ordered = [rawChunk[0], rawChunk[1], rawChunk[2], rawChunk[3]]; // 'ABCD'
      }
    } else if (unitSize === 8) {
      if (byteOrder === 'GHEFCDAB') {
        ordered = [rawChunk[6], rawChunk[7], rawChunk[4], rawChunk[5], rawChunk[2], rawChunk[3], rawChunk[0], rawChunk[1]];
      } else if (byteOrder === 'HGFEDCBA') {
        ordered = [...rawChunk].reverse();
      } else {
        ordered = [...rawChunk]; // 'ABCDEFGH'
      }
    }

    // Convert ordered bytes to value
    let formattedValue = '';
    let rawValue: number | bigint | string = 0;
    const buf = new ArrayBuffer(unitSize);
    const view = new DataView(buf);
    ordered.forEach((b, i) => view.setUint8(i, b));

    if (unitSize === 2) {
      if (dataType === 'int16') {
        const val = view.getInt16(0, false);
        rawValue = val;
        formattedValue = String(val);
      } else if (dataType === 'hex') {
        const val = view.getUint16(0, false);
        rawValue = `0x${val.toString(16).toUpperCase().padStart(4, '0')}`;
        formattedValue = rawValue;
      } else if (dataType === 'binary') {
        const val = view.getUint16(0, false);
        rawValue = val.toString(2).padStart(16, '0');
        formattedValue = `${rawValue.slice(0, 8)} ${rawValue.slice(8)}`;
      } else {
        // uint16 default
        const val = view.getUint16(0, false);
        rawValue = val;
        formattedValue = String(val);
      }
    } else if (unitSize === 4) {
      if (dataType === 'float32') {
        const val = view.getFloat32(0, false);
        rawValue = val;
        // Format float cleanly
        if (Number.isInteger(val)) {
          formattedValue = val.toFixed(1);
        } else {
          formattedValue = parseFloat(val.toPrecision(7)).toString();
        }
      } else if (dataType === 'int32') {
        const val = view.getInt32(0, false);
        rawValue = val;
        formattedValue = val.toLocaleString();
      } else if (dataType === 'hex') {
        const val = view.getUint32(0, false);
        rawValue = `0x${val.toString(16).toUpperCase().padStart(8, '0')}`;
        formattedValue = rawValue;
      } else {
        // uint32 default
        const val = view.getUint32(0, false);
        rawValue = val;
        formattedValue = val.toLocaleString();
      }
    } else if (unitSize === 8) {
      if (dataType === 'float64') {
        const val = view.getFloat64(0, false);
        rawValue = val;
        formattedValue = parseFloat(val.toPrecision(10)).toString();
      } else if (dataType === 'int64') {
        const val = view.getBigInt64(0, false);
        rawValue = val;
        formattedValue = val.toString();
      } else {
        // uint64 default
        const val = view.getBigUint64(0, false);
        rawValue = val;
        formattedValue = val.toString();
      }
    }

    rows.push({
      index: itemIndex,
      registerRangeLabel: regLabel,
      byteOffsetLabel,
      hex: hexStr,
      formattedValue,
      rawValue
    });
  }

  return rows;
}


// Client-side CRC, Checksum, and Radix Conversion Utilities

export function hexStringToBytes(hexStr: string): Uint8Array {
  const clean = hexStr.replace(/[^0-9a-fA-F]/g, '');
  const bytes = new Uint8Array(Math.floor(clean.length / 2));
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(clean.substring(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}

export function bytesToHexString(bytes: Uint8Array | number[]): string {
  return Array.from(bytes)
    .map(b => b.toString(16).toUpperCase().padStart(2, '0'))
    .join(' ');
}

export function bytesToAscii(bytes: Uint8Array | number[]): string {
  return Array.from(bytes)
    .map(b => (b >= 32 && b <= 126 ? String.fromCharCode(b) : '.'))
    .join('');
}

export function asciiToBytes(str: string): Uint8Array {
  const enc = new TextEncoder();
  return enc.encode(str);
}

export function calculateSumCheck8(data: Uint8Array): number {
  let sum = 0;
  for (let i = 0; i < data.length; i++) {
    sum = (sum + data[i]) & 0xFF;
  }
  return sum;
}

export function calculateSumCheck16(data: Uint8Array): number {
  let sum = 0;
  for (let i = 0; i < data.length; i++) {
    sum = (sum + data[i]) & 0xFFFF;
  }
  return sum;
}

export function calculateXorLrc(data: Uint8Array): number {
  let xor = 0;
  for (let i = 0; i < data.length; i++) {
    xor ^= data[i];
  }
  return xor & 0xFF;
}

/**
 * Modbus RTU CRC-16 (Polynomial: 0xA001, Init: 0xFFFF)
 * Returns 16-bit number
 */
export function calculateCrc16Modbus(data: Uint8Array): number {
  let crc = 0xFFFF;
  for (let i = 0; i < data.length; i++) {
    crc ^= data[i];
    for (let j = 0; j < 8; j++) {
      if ((crc & 0x0001) !== 0) {
        crc = (crc >> 1) ^ 0xA001;
      } else {
        crc = crc >> 1;
      }
    }
  }
  return crc;
}

/**
 * CCITT CRC-16 (Polynomial: 0x1021, Init: 0xFFFF)
 */
export function calculateCrc16Ccitt(data: Uint8Array): number {
  let crc = 0xFFFF;
  for (let i = 0; i < data.length; i++) {
    crc ^= (data[i] << 8);
    for (let j = 0; j < 8; j++) {
      if ((crc & 0x8000) !== 0) {
        crc = ((crc << 1) ^ 0x1021) & 0xFFFF;
      } else {
        crc = (crc << 1) & 0xFFFF;
      }
    }
  }
  return crc;
}

/**
 * CRC-32 (IEEE 802.3, Polynomial: 0xEDB88320)
 */
export function calculateCrc32(data: Uint8Array): number {
  let crc = 0xFFFFFFFF;
  for (let i = 0; i < data.length; i++) {
    crc ^= data[i];
    for (let j = 0; j < 8; j++) {
      crc = (crc >>> 1) ^ ((crc & 1) ? 0xEDB88320 : 0);
    }
  }
  return (crc ^ 0xFFFFFFFF) >>> 0;
}

/**
 * Multi-Radix & IEEE-754 Float Converter Utilities (HEX / DEC / OCT / BIN / FLOAT32)
 */
export interface RadixValues {
  hex: string;
  dec: string;
  oct: string;
  bin: string;
  float32: string;
}

/**
 * Convert HEX string (e.g. "3FC0", "3F C0", "3FC00000") to IEEE-754 32-bit Float
 */
export function hexToFloat32(
  hexStr: string,
  byteOrder: 'ABCD' | 'CDAB' | 'BADC' | 'DCBA' = 'ABCD'
): { float32: number | null; formatted: string; fullHexPadded: string } {
  const clean = hexStr.replace(/[^0-9a-fA-F]/g, '');
  if (!clean) return { float32: null, formatted: '-', fullHexPadded: '' };

  // Pad to 8 hex chars (4 bytes)
  let padded = clean;
  if (padded.length < 8) {
    padded = padded.padEnd(8, '0');
  } else if (padded.length > 8) {
    padded = padded.substring(0, 8);
  }

  const b0 = parseInt(padded.substring(0, 2), 16);
  const b1 = parseInt(padded.substring(2, 4), 16);
  const b2 = parseInt(padded.substring(4, 6), 16);
  const b3 = parseInt(padded.substring(6, 8), 16);

  let ordered = [b0, b1, b2, b3];
  if (byteOrder === 'CDAB') ordered = [b2, b3, b0, b1];
  else if (byteOrder === 'BADC') ordered = [b1, b0, b3, b2];
  else if (byteOrder === 'DCBA') ordered = [b3, b2, b1, b0];

  const buf = new ArrayBuffer(4);
  const view = new DataView(buf);
  ordered.forEach((b, i) => view.setUint8(i, b));
  const val = view.getFloat32(0, false);

  const fullHexPadded = `${padded.substring(0, 2)} ${padded.substring(2, 4)} ${padded.substring(4, 6)} ${padded.substring(6, 8)}`.toUpperCase();

  if (isNaN(val)) return { float32: null, formatted: 'NaN', fullHexPadded };
  if (!isFinite(val)) return { float32: val, formatted: val > 0 ? '+Infinity' : '-Infinity', fullHexPadded };

  const formatted = Number.isInteger(val) ? val.toFixed(1) : parseFloat(val.toPrecision(7)).toString();
  return { float32: val, formatted, fullHexPadded };
}

/**
 * Convert float number (e.g. 1.5) to IEEE-754 32-bit HEX string
 */
export function float32ToHex(
  num: number,
  byteOrder: 'ABCD' | 'CDAB' | 'BADC' | 'DCBA' = 'ABCD'
): { hex: string; hexFormatted: string } {
  if (isNaN(num)) return { hex: '', hexFormatted: '' };
  const buf = new ArrayBuffer(4);
  const view = new DataView(buf);
  view.setFloat32(0, num, false);

  const b0 = view.getUint8(0);
  const b1 = view.getUint8(1);
  const b2 = view.getUint8(2);
  const b3 = view.getUint8(3);

  let ordered = [b0, b1, b2, b3];
  if (byteOrder === 'CDAB') ordered = [b2, b3, b0, b1];
  else if (byteOrder === 'BADC') ordered = [b1, b0, b3, b2];
  else if (byteOrder === 'DCBA') ordered = [b3, b2, b1, b0];

  const rawHex = ordered.map((b) => b.toString(16).toUpperCase().padStart(2, '0')).join('');
  const hexFormatted = ordered.map((b) => b.toString(16).toUpperCase().padStart(2, '0')).join(' ');
  return { hex: rawHex, hexFormatted };
}

export function convertFromRadix(
  value: string,
  sourceRadix: 'hex' | 'dec' | 'oct' | 'bin' | 'float32'
): RadixValues {
  const clean = value.trim();
  if (!clean) {
    return { hex: '', dec: '', oct: '', bin: '', float32: '' };
  }

  // 1. If user typed in Float32 (e.g. "1.5", "-3.14")
  if (sourceRadix === 'float32') {
    const floatVal = parseFloat(clean);
    if (isNaN(floatVal)) {
      return { hex: '', dec: '', oct: '', bin: '', float32: clean };
    }
    const { hex: rawHex, hexFormatted } = float32ToHex(floatVal, 'ABCD');
    const u32 = parseInt(rawHex, 16);
    return {
      hex: hexFormatted,
      dec: u32.toString(10),
      oct: u32.toString(8),
      bin: formatBinaryChunks(u32.toString(2)),
      float32: clean
    };
  }

  let num = 0n;
  try {
    if (sourceRadix === 'hex') {
      const sanitized = clean.replace(/[^0-9a-fA-F]/g, '');
      if (!sanitized) return { hex: '', dec: '', oct: '', bin: '', float32: '' };
      num = BigInt('0x' + sanitized);
    } else if (sourceRadix === 'dec') {
      const sanitized = clean.replace(/[^0-9-]/g, '');
      if (!sanitized || sanitized === '-') return { hex: '', dec: '', oct: '', bin: '', float32: '' };
      num = BigInt(sanitized);
    } else if (sourceRadix === 'oct') {
      const sanitized = clean.replace(/[^0-7]/g, '');
      if (!sanitized) return { hex: '', dec: '', oct: '', bin: '', float32: '' };
      num = BigInt('0o' + sanitized);
    } else if (sourceRadix === 'bin') {
      const sanitized = clean.replace(/[^01]/g, '');
      if (!sanitized) return { hex: '', dec: '', oct: '', bin: '', float32: '' };
      num = BigInt('0b' + sanitized);
    }
  } catch (e) {
    return { hex: '', dec: '', oct: '', bin: '', float32: '' };
  }

  if (num < 0n) {
    // Negative integer representation
    return {
      hex: '-' + (-num).toString(16).toUpperCase(),
      dec: num.toString(10),
      oct: '-' + (-num).toString(8),
      bin: '-' + formatBinaryChunks((-num).toString(2)),
      float32: '-'
    };
  }

  const rawHex = num.toString(16).toUpperCase();
  const rawDec = num.toString(10);
  const rawOct = num.toString(8);
  const rawBin = num.toString(2);

  // Compute float32 representation from the hex string
  // If hex string has <= 8 characters (32-bit), pad with trailing zeros (e.g. "3FC0" -> "3FC00000" -> 1.5)
  let float32Str = '-';
  if (rawHex.length <= 8) {
    const padded = rawHex.padEnd(8, '0');
    const { formatted } = hexToFloat32(padded, 'ABCD');
    float32Str = formatted;
  }

  return {
    hex: formatHexChunks(rawHex),
    dec: rawDec,
    oct: rawOct,
    bin: formatBinaryChunks(rawBin),
    float32: float32Str
  };
}

function formatBinaryChunks(binStr: string): string {
  const padLen = (4 - (binStr.length % 4)) % 4;
  const padded = '0'.repeat(padLen) + binStr;
  const chunks = [];
  for (let i = 0; i < padded.length; i += 4) {
    chunks.push(padded.substring(i, i + 4));
  }
  return chunks.join(' ');
}

function formatHexChunks(hexStr: string): string {
  const padded = hexStr.length % 2 !== 0 ? '0' + hexStr : hexStr;
  const chunks = [];
  for (let i = 0; i < padded.length; i += 2) {
    chunks.push(padded.substring(i, i + 2));
  }
  return chunks.join(' ');
}

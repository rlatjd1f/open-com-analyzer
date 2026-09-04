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
 * Multi-Radix Converter Utilities (HEX / DEC / OCT / BIN)
 */
export interface RadixValues {
  hex: string;
  dec: string;
  oct: string;
  bin: string;
}

export function convertFromRadix(value: string, sourceRadix: 'hex' | 'dec' | 'oct' | 'bin'): RadixValues {
  const clean = value.trim();
  if (!clean) {
    return { hex: '', dec: '', oct: '', bin: '' };
  }

  let num = 0n;
  try {
    if (sourceRadix === 'hex') {
      const sanitized = clean.replace(/[^0-9a-fA-F]/g, '');
      if (!sanitized) return { hex: '', dec: '', oct: '', bin: '' };
      num = BigInt('0x' + sanitized);
    } else if (sourceRadix === 'dec') {
      const sanitized = clean.replace(/[^0-9-]/g, '');
      if (!sanitized || sanitized === '-') return { hex: '', dec: '', oct: '', bin: '' };
      num = BigInt(sanitized);
    } else if (sourceRadix === 'oct') {
      const sanitized = clean.replace(/[^0-7]/g, '');
      if (!sanitized) return { hex: '', dec: '', oct: '', bin: '' };
      num = BigInt('0o' + sanitized);
    } else if (sourceRadix === 'bin') {
      const sanitized = clean.replace(/[^01]/g, '');
      if (!sanitized) return { hex: '', dec: '', oct: '', bin: '' };
      num = BigInt('0b' + sanitized);
    }
  } catch (e) {
    return { hex: '', dec: '', oct: '', bin: '' };
  }

  if (num < 0n) {
    // Negative number representation
    return {
      hex: '-' + (-num).toString(16).toUpperCase(),
      dec: num.toString(10),
      oct: '-' + (-num).toString(8),
      bin: '-' + formatBinaryChunks((-num).toString(2))
    };
  }

  const rawHex = num.toString(16).toUpperCase();
  const rawDec = num.toString(10);
  const rawOct = num.toString(8);
  const rawBin = num.toString(2);

  return {
    hex: formatHexChunks(rawHex),
    dec: rawDec,
    oct: rawOct,
    bin: formatBinaryChunks(rawBin)
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

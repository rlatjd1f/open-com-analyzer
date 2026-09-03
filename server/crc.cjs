// CRC and Checksum Calculation Utilities

/**
 * Calculates 8-bit Sum Check
 * @param {Buffer|Uint8Array} data 
 * @returns {number} 8-bit sum (0-255)
 */
function calculateSumCheck8(data) {
  let sum = 0;
  for (let i = 0; i < data.length; i++) {
    sum = (sum + data[i]) & 0xFF;
  }
  return sum;
}

/**
 * Calculates 16-bit Sum Check
 * @param {Buffer|Uint8Array} data 
 * @returns {number} 16-bit sum (0-65535)
 */
function calculateSumCheck16(data) {
  let sum = 0;
  for (let i = 0; i < data.length; i++) {
    sum = (sum + data[i]) & 0xFFFF;
  }
  return sum;
}

/**
 * Calculates Modbus CRC-16 (Polynomial: 0xA001, Init: 0xFFFF)
 * @param {Buffer|Uint8Array} data 
 * @returns {number} 16-bit CRC
 */
function calculateCrc16Modbus(data) {
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
 * Calculates CCITT CRC-16 (Polynomial: 0x1021, Init: 0xFFFF)
 * @param {Buffer|Uint8Array} data 
 * @returns {number} 16-bit CRC
 */
function calculateCrc16Ccitt(data) {
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

module.exports = {
  calculateSumCheck8,
  calculateSumCheck16,
  calculateCrc16Modbus,
  calculateCrc16Ccitt
};

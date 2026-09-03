// Virtual Device Simulator for immediate hardware-free testing
const { calculateCrc16Modbus } = require('./crc.cjs');

class VirtualDevice {
  constructor(onData, onStatusChange) {
    this.onData = onData;
    this.onStatusChange = onStatusChange;
    this.isRunning = false;
    this.timer = null;
    this.mode = 'echo'; // 'echo' | 'modbus' | 'stream'
  }

  start(mode = 'echo') {
    this.isRunning = true;
    this.mode = mode;
    this.onStatusChange({
      connected: true,
      type: 'virtual',
      info: `Virtual Device (${mode.toUpperCase()} Mode)`
    });

    if (mode === 'stream') {
      let counter = 0;
      this.timer = setInterval(() => {
        if (!this.isRunning) return;
        // Generate simulated sensor packet: [0x01, 0x03, 0x04, dataH, dataL, tempH, tempL, crcL, crcH]
        const val1 = (Math.sin(counter / 10) * 100 + 150) & 0xFFFF;
        const val2 = (Math.cos(counter / 10) * 50 + 250) & 0xFFFF;
        const payload = Buffer.from([
          0x01, 0x03, 0x04,
          (val1 >> 8) & 0xFF, val1 & 0xFF,
          (val2 >> 8) & 0xFF, val2 & 0xFF
        ]);
        const crc = calculateCrc16Modbus(payload);
        const packet = Buffer.concat([payload, Buffer.from([crc & 0xFF, (crc >> 8) & 0xFF])]);
        this.onData(packet, 'rx', 'Virtual Device');
        counter++;
      }, 1000);
    }
  }

  stop() {
    this.isRunning = false;
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    this.onStatusChange({ connected: false, info: 'Virtual Device stopped' });
  }

  handleWrite(buffer) {
    if (!this.isRunning) {
      throw new Error('Virtual device is not running');
    }

    // Emit TX
    this.onData(buffer, 'tx', 'Virtual Device');

    // Simulate reply after 50ms
    setTimeout(() => {
      if (!this.isRunning) return;

      if (this.mode === 'echo') {
        // Echo back with modified header or exact echo
        this.onData(buffer, 'rx', 'Virtual Echo');
      } else if (this.mode === 'modbus') {
        // Standard Modbus RTU Response simulation
        if (buffer.length >= 6) {
          const slaveId = buffer[0];
          const funcCode = buffer[1];
          if (funcCode === 0x03) {
            // Read holding registers response
            const resp = Buffer.from([slaveId, 0x03, 0x04, 0x00, 0x64, 0x01, 0xF4]);
            const crc = calculateCrc16Modbus(resp);
            const full = Buffer.concat([resp, Buffer.from([crc & 0xFF, (crc >> 8) & 0xFF])]);
            this.onData(full, 'rx', 'Virtual Modbus Slave');
          } else if (funcCode === 0x06) {
            // Preset single register echo
            this.onData(buffer, 'rx', 'Virtual Modbus Slave');
          } else {
            this.onData(buffer, 'rx', 'Virtual Modbus Slave');
          }
        } else {
          this.onData(buffer, 'rx', 'Virtual Echo');
        }
      }
    }, 40);
  }
}

module.exports = VirtualDevice;

const { SerialPort } = require('serialport');

class SerialService {
  constructor(onData, onStatusChange) {
    this.port = null;
    this.onData = onData;
    this.onStatusChange = onStatusChange;
    this.currentConfig = null;
  }

  async listPorts() {
    try {
      const ports = await SerialPort.list();
      // On macOS, prioritize USB serial devices: /dev/cu.usbserial*, /dev/cu.usbmodem*, etc.
      return ports.map(p => ({
        path: p.path,
        manufacturer: p.manufacturer || '',
        serialNumber: p.serialNumber || '',
        vendorId: p.vendorId || '',
        productId: p.productId || '',
        isUsb: /usb|modem|uart|ftdi|ch34/i.test(p.path) || Boolean(p.vendorId)
      }));
    } catch (err) {
      console.error('Failed to list serial ports:', err);
      return [];
    }
  }

  isOpen() {
    return this.port && this.port.isOpen;
  }

  async open(config) {
    // config: { path, baudRate, dataBits, stopBits, parity, rtscts }
    if (this.isOpen()) {
      await this.close();
    }

    return new Promise((resolve, reject) => {
      try {
        this.port = new SerialPort({
          path: config.path,
          baudRate: parseInt(config.baudRate, 10) || 9600,
          dataBits: parseInt(config.dataBits, 10) || 8,
          stopBits: parseFloat(config.stopBits) || 1,
          parity: config.parity || 'none',
          rtscts: Boolean(config.rtscts),
          autoOpen: false
        });

        this.port.open((err) => {
          if (err) {
            this.port = null;
            this.onStatusChange({ connected: false, error: err.message });
            return reject(err);
          }

          this.currentConfig = config;
          this.onStatusChange({
            connected: true,
            type: 'serial',
            info: `${config.path} @ ${config.baudRate}bps`
          });
          resolve(true);
        });

        this.port.on('data', (chunk) => {
          if (this.onData) {
            this.onData(chunk, 'rx', 'serial');
          }
        });

        this.port.on('error', (err) => {
          console.error('Serial port error:', err);
          this.onStatusChange({ connected: false, error: err.message });
        });

        this.port.on('close', () => {
          this.currentConfig = null;
          this.onStatusChange({ connected: false, info: 'Port closed' });
        });
      } catch (err) {
        reject(err);
      }
    });
  }

  async close() {
    if (!this.port) return;
    return new Promise((resolve) => {
      if (this.port.isOpen) {
        this.port.close(() => {
          this.port = null;
          resolve();
        });
      } else {
        this.port = null;
        resolve();
      }
    });
  }

  async write(buffer) {
    if (!this.isOpen()) {
      throw new Error('Serial port is not open');
    }

    return new Promise((resolve, reject) => {
      this.port.write(buffer, (err) => {
        if (err) return reject(err);
        this.port.drain((drainErr) => {
          if (drainErr) return reject(drainErr);
          if (this.onData) {
            this.onData(buffer, 'tx', 'serial');
          }
          resolve();
        });
      });
    });
  }
}

module.exports = SerialService;

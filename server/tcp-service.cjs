const net = require('net');

class TcpService {
  constructor(onData, onStatusChange) {
    this.server = null;
    this.clientSocket = null;
    this.serverClients = new Set();
    this.onData = onData;
    this.onStatusChange = onStatusChange;
    this.mode = null; // 'server' | 'client'
    this.config = null;
  }

  isServerRunning() {
    return Boolean(this.server && this.server.listening);
  }

  isClientConnected() {
    return Boolean(this.clientSocket && !this.clientSocket.destroyed);
  }

  // --- TCP Server Mode ---
  startServer(port = 121) {
    return new Promise((resolve, reject) => {
      if (this.isServerRunning()) {
        this.stopServer();
      }

      try {
        this.server = net.createServer((socket) => {
          this.serverClients.add(socket);
          const remoteAddr = `${socket.remoteAddress}:${socket.remotePort}`;

          this._emitStatus({
            type: 'tcp-server',
            connected: true,
            port: port,
            clientCount: this.serverClients.size,
            info: `TCP Server PORT:${port}, 접속자 수:${this.serverClients.size}`
          });

          socket.on('data', (chunk) => {
            if (this.onData) {
              this.onData(chunk, 'rx', `tcp-server (${remoteAddr})`);
            }
          });

          socket.on('close', () => {
            this.serverClients.delete(socket);
            if (this.isServerRunning() && !this.isClosing) {
              this._emitStatus({
                type: 'tcp-server',
                connected: true,
                port: port,
                clientCount: this.serverClients.size,
                info: `TCP Server PORT:${port}, 접속자 수:${this.serverClients.size}`
              });
            }
          });

          socket.on('error', (err) => {
            console.error(`Socket error from ${remoteAddr}:`, err.message);
          });
        });

        this.server.on('error', (err) => {
          console.error('TCP Server error:', err);
          this._emitStatus({ connected: false, error: err.message });
          reject(err);
        });

        this.server.listen(port, '0.0.0.0', () => {
          this.mode = 'server';
          this.config = { port };
          this.isClosing = false;
          this._emitStatus({
            type: 'tcp-server',
            connected: true,
            port: port,
            clientCount: 0,
            info: `TCP Server PORT:${port}, 접속자 수:0`
          });
          resolve(true);
        });
      } catch (err) {
        reject(err);
      }
    });
  }

  stopServer() {
    return new Promise((resolve) => {
      this.isClosing = true;
      if (this.server) {
        for (const client of this.serverClients) {
          try {
            client.removeAllListeners();
            client.destroy();
          } catch (e) {}
        }
        this.serverClients.clear();
        try {
          this.server.close(() => {
            this.server = null;
            this.mode = null;
            this.isClosing = false;
            this._emitStatus({ connected: false, type: null, info: '연결되지 않음' });
            resolve();
          });
        } catch (e) {
          this.server = null;
          this.mode = null;
          this.isClosing = false;
          this._emitStatus({ connected: false, type: null, info: '연결되지 않음' });
          resolve();
        }
      } else {
        this.mode = null;
        this.isClosing = false;
        this._emitStatus({ connected: false, type: null, info: '연결되지 않음' });
        resolve();
      }
    });
  }

  // --- TCP Client Mode ---
  connectClient(host = '127.0.0.1', port = 121) {
    return new Promise((resolve, reject) => {
      if (this.isClientConnected()) {
        this.disconnectClient();
      }

      this.clientSocket = new net.Socket();
      this.isClosing = false;

      this.clientSocket.connect(port, host, () => {
        this.mode = 'client';
        this.config = { host, port };
        this._emitStatus({
          type: 'tcp-client',
          connected: true,
          info: `Connected to TCP ${host}:${port}`
        });
        resolve(true);
      });

      this.clientSocket.on('data', (chunk) => {
        if (this.onData) {
          this.onData(chunk, 'rx', 'tcp-client');
        }
      });

      this.clientSocket.on('close', () => {
        if (!this.isClosing) {
          this.clientSocket = null;
          this.mode = null;
          this._emitStatus({ connected: false, type: null, info: '연결되지 않음' });
        }
      });

      this.clientSocket.on('error', (err) => {
        if (!this.isClosing) {
          this._emitStatus({ connected: false, type: null, error: err.message, info: '연결 오류' });
          reject(err);
        }
      });
    });
  }

  disconnectClient() {
    this.isClosing = true;
    if (this.clientSocket) {
      try {
        this.clientSocket.removeAllListeners();
        this.clientSocket.destroy();
      } catch (e) {}
      this.clientSocket = null;
    }
    this.mode = null;
    this.isClosing = false;
    this._emitStatus({ connected: false, type: null, info: '연결되지 않음' });
  }

  // Unified close for both server and client modes
  async close() {
    if (this.mode === 'server' || this.server) {
      await this.stopServer();
    } else if (this.mode === 'client' || this.clientSocket) {
      this.disconnectClient();
    } else {
      this._emitStatus({ connected: false, type: null, info: '연결되지 않음' });
    }
  }

  // --- Send Data ---
  async write(buffer) {
    if (this.mode === 'server') {
      if (this.serverClients.size === 0) {
        throw new Error('No TCP clients connected to server');
      }
      for (const client of this.serverClients) {
        client.write(buffer);
      }
      if (this.onData) {
        this.onData(buffer, 'tx', 'tcp-server');
      }
    } else if (this.mode === 'client') {
      if (!this.isClientConnected()) {
        throw new Error('TCP client is not connected');
      }
      this.clientSocket.write(buffer);
      if (this.onData) {
        this.onData(buffer, 'tx', 'tcp-client');
      }
    } else {
      throw new Error('TCP service is not running');
    }
  }

  _emitStatus(status) {
    if (this.onStatusChange) {
      this.onStatusChange(status);
    }
  }
}

module.exports = TcpService;

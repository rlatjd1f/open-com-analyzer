const http = require('http');
const { WebSocketServer } = require('ws');
const SerialService = require('./serial-service.cjs');
const TcpService = require('./tcp-service.cjs');
const VirtualDevice = require('./virtual-device.cjs');
const UpdaterService = require('./updater-service.cjs');
const { calculateSumCheck8, calculateSumCheck16, calculateCrc16Modbus, calculateCrc16Ccitt } = require('./crc.cjs');

const PORT = 4001;
const updaterService = new UpdaterService();
const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ name: 'COM Analyzer Backend Server', status: 'running' }));
});

const wss = new WebSocketServer({ server });

wss.on('connection', async (ws) => {
  // Per-window connection state & services
  let activeService = null; // 'serial' | 'tcp' | 'virtual'
  let connectionStatus = {
    connected: false,
    type: null,
    info: '연결되지 않음'
  };

  // Dedicated data callback for this specific window
  const handleIncomingData = (buffer, direction, source) => {
    if (ws.readyState !== 1) return; // ws.OPEN
    const bytes = Array.from(buffer);
    const hex = buffer.toString('hex').toUpperCase();
    const ascii = buffer.toString('utf-8');

    ws.send(JSON.stringify({
      type: 'DATA_PACKET',
      direction,
      source,
      timestamp: Date.now(),
      bytes,
      hex,
      ascii,
      length: bytes.length
    }));
  };

  // Dedicated status callback for this specific window
  const handleStatusChange = (status) => {
    connectionStatus = status;
    if (ws.readyState === 1) {
      ws.send(JSON.stringify({
        type: 'STATUS_UPDATE',
        status
      }));
    }
  };

  // Independent service instances per window
  const serialService = new SerialService(handleIncomingData, handleStatusChange);
  const tcpService = new TcpService(handleIncomingData, handleStatusChange);
  const virtualDevice = new VirtualDevice(handleIncomingData, handleStatusChange);

  const closeAll = async () => {
    try {
      await Promise.allSettled([
        serialService.close(),
        tcpService.close(),
        Promise.resolve(virtualDevice.stop())
      ]);
    } catch (err) {
      console.warn('Error during service cleanup:', err);
    } finally {
      activeService = null;
      handleStatusChange({
        connected: false,
        type: null,
        info: '연결되지 않음'
      });
    }
  };

  // Send initial status
  ws.send(JSON.stringify({
    type: 'STATUS_UPDATE',
    status: connectionStatus
  }));

  // Send available serial ports
  try {
    const ports = await serialService.listPorts();
    ws.send(JSON.stringify({
      type: 'PORT_LIST',
      ports
    }));
  } catch (e) {
    console.warn('Failed to list initial ports:', e);
  }

  ws.on('message', async (data) => {
    try {
      const msg = JSON.parse(data);
      switch (msg.action) {
        case 'LIST_PORTS': {
          const ports = await serialService.listPorts();
          ws.send(JSON.stringify({ type: 'PORT_LIST', ports }));
          break;
        }

        case 'OPEN_SERIAL': {
          await closeAll();
          try {
            await serialService.open(msg.config);
            activeService = 'serial';
          } catch (err) {
            ws.send(JSON.stringify({ type: 'ERROR', message: `시리얼 포트 열기 실패: ${err.message}` }));
          }
          break;
        }

        case 'START_TCP_SERVER': {
          await closeAll();
          try {
            const port = parseInt(msg.port, 10) || 121;
            await tcpService.startServer(port);
            activeService = 'tcp';
          } catch (err) {
            ws.send(JSON.stringify({ type: 'ERROR', message: `TCP 서버 시작 실패: ${err.message}` }));
          }
          break;
        }

        case 'CONNECT_TCP_CLIENT': {
          await closeAll();
          try {
            await tcpService.connectClient(msg.host || '127.0.0.1', parseInt(msg.port, 10) || 121);
            activeService = 'tcp';
          } catch (err) {
            ws.send(JSON.stringify({ type: 'ERROR', message: `TCP 접속 실패: ${err.message}` }));
          }
          break;
        }

        case 'START_VIRTUAL': {
          await closeAll();
          virtualDevice.start(msg.mode || 'echo');
          activeService = 'virtual';
          break;
        }

        case 'DISCONNECT': {
          await closeAll();
          break;
        }

        case 'SEND_DATA': {
          const { raw, format } = msg;
          let buf;
          if (format === 'hex') {
            const cleanHex = (raw || '').replace(/[^0-9a-fA-F]/g, '');
            if (cleanHex.length % 2 !== 0) {
              ws.send(JSON.stringify({ type: 'ERROR', message: 'HEX 길이가 짝수가 아닙니다.' }));
              return;
            }
            buf = Buffer.from(cleanHex, 'hex');
          } else {
            buf = Buffer.from(raw || '', 'utf-8');
          }

          if (buf.length === 0) return;

          if (activeService === 'serial' && serialService.isOpen()) {
            await serialService.write(buf);
          } else if (activeService === 'tcp') {
            await tcpService.write(buf);
          } else if (activeService === 'virtual' && virtualDevice.isRunning) {
            virtualDevice.handleWrite(buf);
          } else {
            ws.send(JSON.stringify({ type: 'ERROR', message: '활성화된 통신 연결이 없습니다.' }));
          }
          break;
        }

        case 'CALCULATE': {
          const { calcType, input, format } = msg;
          let buf;
          if (format === 'hex') {
            const cleanHex = (input || '').replace(/[^0-9a-fA-F]/g, '');
            buf = Buffer.from(cleanHex, 'hex');
          } else {
            buf = Buffer.from(input || '', 'utf-8');
          }

          let result = {};
          if (calcType === 'sum') {
            const sum8 = calculateSumCheck8(buf);
            const sum16 = calculateSumCheck16(buf);
            result = {
              sum8Hex: sum8.toString(16).toUpperCase().padStart(2, '0'),
              sum8Dec: sum8,
              sum16Hex: sum16.toString(16).toUpperCase().padStart(4, '0'),
              sum16Dec: sum16
            };
          } else if (calcType === 'crc16') {
            const modbus = calculateCrc16Modbus(buf);
            const ccitt = calculateCrc16Ccitt(buf);
            result = {
              modbusHex: modbus.toString(16).toUpperCase().padStart(4, '0'),
              modbusLsbFirst: `${(modbus & 0xFF).toString(16).toUpperCase().padStart(2, '0')} ${((modbus >> 8) & 0xFF).toString(16).toUpperCase().padStart(2, '0')}`,
              ccittHex: ccitt.toString(16).toUpperCase().padStart(4, '0')
            };
          }
          ws.send(JSON.stringify({ type: 'CALC_RESULT', calcType, result }));
          break;
        }

        case 'CHECK_FOR_UPDATES': {
          try {
            const updateInfo = await updaterService.checkForUpdates();
            ws.send(JSON.stringify({ type: 'UPDATE_CHECK_RESULT', ...updateInfo }));
          } catch (err) {
            ws.send(JSON.stringify({ type: 'UPDATE_CHECK_ERROR', message: err.message }));
          }
          break;
        }

        case 'START_UPDATE': {
          try {
            const { assetUrl } = msg;
            ws.send(JSON.stringify({ type: 'UPDATE_STATUS', status: 'downloading', message: '업데이트 다운로드 중...' }));

            await updaterService.installUpdate(assetUrl, (progress) => {
              ws.send(JSON.stringify({
                type: 'UPDATE_PROGRESS',
                percent: progress.percent,
                downloaded: progress.downloaded,
                total: progress.total
              }));
            });

            ws.send(JSON.stringify({ type: 'UPDATE_STATUS', status: 'completed', message: '업데이트 완료! 앱을 재실행합니다.' }));
          } catch (err) {
            ws.send(JSON.stringify({ type: 'UPDATE_ERROR', message: `업데이트 실패: ${err.message}` }));
          }
          break;
        }
      }
    } catch (err) {
      console.error('Error handling WebSocket message:', err);
      ws.send(JSON.stringify({ type: 'ERROR', message: err.message }));
    }
  });

  // When this window closes, release its hardware/socket connection cleanly
  ws.on('close', () => {
    closeAll();
  });
});

server.listen(PORT, () => {
  console.log(`COM Analyzer WebSocket server running on http://localhost:${PORT}`);
});

module.exports = { server, wss };

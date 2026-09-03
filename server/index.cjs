const http = require('http');
const { WebSocketServer } = require('ws');
const SerialService = require('./serial-service.cjs');
const TcpService = require('./tcp-service.cjs');
const VirtualDevice = require('./virtual-device.cjs');
const { calculateSumCheck8, calculateSumCheck16, calculateCrc16Modbus, calculateCrc16Ccitt } = require('./crc.cjs');

const PORT = 4001;
const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ name: 'COM Analyzer macOS Server', status: 'running' }));
});

const wss = new WebSocketServer({ server });

// Shared connection states
let activeService = null; // 'serial' | 'tcp' | 'virtual'
let currentConnectionInfo = {
  connected: false,
  type: null,
  info: '연결되지 않음'
};

function broadcast(msg) {
  const payload = JSON.stringify(msg);
  for (const client of wss.clients) {
    if (client.readyState === 1) { // OPEN
      client.send(payload);
    }
  }
}

// Data callback
function handleIncomingData(buffer, direction, source) {
  // Convert buffer to hex array and ascii string
  const bytes = Array.from(buffer);
  const hex = buffer.toString('hex').toUpperCase();
  const ascii = buffer.toString('utf-8');

  broadcast({
    type: 'DATA_PACKET',
    direction, // 'rx' | 'tx'
    source,
    timestamp: Date.now(),
    bytes,
    hex,
    ascii,
    length: bytes.length
  });
}

// Status callback
function handleStatusChange(status) {
  currentConnectionInfo = status;
  broadcast({
    type: 'STATUS_UPDATE',
    status
  });
}

const serialService = new SerialService(handleIncomingData, handleStatusChange);
const tcpService = new TcpService(handleIncomingData, handleStatusChange);
const virtualDevice = new VirtualDevice(handleIncomingData, handleStatusChange);

wss.on('connection', async (ws) => {
  // Send current status immediately
  ws.send(JSON.stringify({
    type: 'STATUS_UPDATE',
    status: currentConnectionInfo
  }));

  // Send available serial ports
  const ports = await serialService.listPorts();
  ws.send(JSON.stringify({
    type: 'PORT_LIST',
    ports
  }));

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
          const { raw, format } = msg; // format: 'hex' | 'ascii'
          let buf;
          if (format === 'hex') {
            // Remove spaces, sanitize hex string
            const cleanHex = (raw || '').replace(/[^0-9a-fA-F]/g, '');
            if (cleanHex.length % 2 !== 0) {
              ws.send(JSON.stringify({ type: 'ERROR', message: 'HEX 길이가 짝수가 아닙니다.' }));
              return;
            }
            buf = Buffer.from(cleanHex, 'hex');
          } else {
            buf = Buffer.from(raw || '', 'utf-8');
          }

          if (buf.length === 0) {
            return;
          }

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
          // Calculator request
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

        default:
          console.warn('Unknown action:', msg.action);
      }
    } catch (err) {
      console.error('WebSocket message handling error:', err);
      ws.send(JSON.stringify({ type: 'ERROR', message: err.message }));
    }
  });
});

async function closeAll() {
  if (serialService.isOpen()) {
    await serialService.close();
  }
  if (tcpService.isServerRunning()) {
    tcpService.stopServer();
  }
  if (tcpService.isClientConnected()) {
    tcpService.disconnectClient();
  }
  if (virtualDevice.isRunning) {
    virtualDevice.stop();
  }
  activeService = null;
  currentConnectionInfo = { connected: false, info: '연결 종료됨' };
  handleStatusChange(currentConnectionInfo);
}

server.listen(PORT, () => {
  console.log(`COM Analyzer backend service running on http://localhost:${PORT}`);
});

const net = require('net');
const { WebSocket } = require('ws');
const { spawn } = require('child_process');
const path = require('path');
const { calculateCrc16Modbus, calculateSumCheck8 } = require('../server/crc.cjs');

async function runTests() {
  console.log('--- 1. Testing CRC & Checksum Calculations ---');
  // Modbus test packet from screenshot: 01 06 00 EF 00 01 -> CRC: 79 FF
  const modbusPayload = Buffer.from('010600EF0001', 'hex');
  const modbusCrc = calculateCrc16Modbus(modbusPayload);
  const lowByte = (modbusCrc & 0xFF).toString(16).toUpperCase().padStart(2, '0');
  const highByte = ((modbusCrc >> 8) & 0xFF).toString(16).toUpperCase().padStart(2, '0');
  console.log(`Modbus CRC computed: ${lowByte} ${highByte}`);
  if (lowByte === '79' && highByte === 'FF') {
    console.log('✓ CRC-16 Modbus matches screenshot exactly: 79 FF');
  } else {
    throw new Error(`CRC Modbus mismatch: expected 79 FF, got ${lowByte} ${highByte}`);
  }

  const sum8 = calculateSumCheck8(modbusPayload);
  console.log(`✓ 8-bit Sum Check computed: 0x${sum8.toString(16).toUpperCase().padStart(2, '0')}`);

  console.log('\n--- 2. Starting Backend Server ---');
  const serverProc = spawn('node', [path.join(__dirname, '../server/index.cjs')], {
    stdio: 'inherit'
  });

  // Wait for server to start
  await new Promise((resolve) => setTimeout(resolve, 1000));

  try {
    console.log('\n--- 3. Connecting to WebSocket (Port 4001) ---');
    const ws = new WebSocket('ws://localhost:4001');

    await new Promise((resolve, reject) => {
      ws.on('open', resolve);
      ws.on('error', reject);
    });
    console.log('✓ WebSocket connected successfully');

    // Test Listing Ports
    console.log('\n--- 4. Testing Port Listing ---');
    ws.send(JSON.stringify({ action: 'LIST_PORTS' }));
    await new Promise((resolve) => {
      const handler = (data) => {
        const msg = JSON.parse(data.toString());
        if (msg.type === 'PORT_LIST') {
          console.log(`✓ Received port list (${msg.ports.length} ports found)`);
          ws.off('message', handler);
          resolve();
        }
      };
      ws.on('message', handler);
    });

    // Test TCP Server mode on port 121 (as in screenshot)
    console.log('\n--- 5. Testing TCP Server (Port 121) ---');
    ws.send(JSON.stringify({ action: 'START_TCP_SERVER', port: 121 }));

    await new Promise((resolve) => {
      const handler = (data) => {
        const msg = JSON.parse(data.toString());
        if (msg.type === 'STATUS_UPDATE' && msg.status.type === 'tcp-server') {
          console.log(`✓ TCP Server status updated: ${msg.status.info}`);
          ws.off('message', handler);
          resolve();
        }
      };
      ws.on('message', handler);
    });

    // Connect a real TCP client to port 121
    console.log('\n--- 6. Connecting TCP Client and Sending Test Packet ---');
    const client = new net.Socket();
    await new Promise((resolve, reject) => {
      client.connect(121, '127.0.0.1', () => {
        console.log('✓ TCP Client connected to 127.0.0.1:121');
        resolve();
      });
      client.on('error', reject);
    });

    // Send the screenshot test packet
    const testPacket = Buffer.from('010600EF000179FF', 'hex');
    client.write(testPacket);

    // Verify WebSocket receives DATA_PACKET
    await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('Timeout waiting for DATA_PACKET')), 3000);
      ws.on('message', (data) => {
        const msg = JSON.parse(data.toString());
        if (msg.type === 'DATA_PACKET') {
          clearTimeout(timeout);
          console.log(`✓ DATA_PACKET received via WebSocket:`);
          console.log(`   Direction: ${msg.direction}`);
          console.log(`   HEX: ${msg.hex}`);
          console.log(`   Length: ${msg.length} Bytes`);
          if (msg.hex === '010600EF000179FF') {
            console.log('✓ Packet data matches test packet perfectly!');
            resolve();
          } else {
            reject(new Error(`Packet data mismatch: got ${msg.hex}`));
          }
        }
      });
    });

    client.destroy();

    // Test Virtual Device Simulator
    console.log('\n--- 7. Testing Virtual Simulator (Modbus RTU Mode) ---');
    ws.send(JSON.stringify({ action: 'START_VIRTUAL', mode: 'modbus' }));
    await new Promise((resolve) => setTimeout(resolve, 300));

    // Send data to virtual device
    ws.send(JSON.stringify({
      action: 'SEND_DATA',
      raw: '010600EF000179FF',
      format: 'hex'
    }));

    await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('Timeout waiting for virtual response')), 3000);
      let seenTx = false;
      const handler = (data) => {
        const msg = JSON.parse(data.toString());
        if (msg.type === 'DATA_PACKET') {
          if (msg.direction === 'tx') {
            seenTx = true;
            console.log(`✓ Virtual TX emitted: ${msg.hex}`);
          } else if (msg.direction === 'rx') {
            clearTimeout(timeout);
            console.log(`✓ Virtual RX response received: ${msg.hex}`);
            ws.off('message', handler);
            resolve();
          }
        }
      };
      ws.on('message', handler);
    });

    ws.close();
    console.log('\n=========================================');
    console.log('🎉 ALL COM ANALYZER TESTS PASSED 100%!');
    console.log('=========================================');
  } finally {
    serverProc.kill();
  }
}

runTests().catch((err) => {
  console.error('Test failed:', err);
  process.exit(1);
});

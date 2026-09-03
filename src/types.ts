export type DataDirection = 'rx' | 'tx';

export interface ByteItem {
  id: number;
  byte: number;
  direction: DataDirection;
  timestamp: number;
  source?: string;
}

export interface Packet {
  id: string;
  direction: DataDirection;
  bytes: number[];
  hex: string;
  ascii: string;
  length: number;
  timestamp: number;
  source?: string;
}

export interface ConnectionStatus {
  connected: boolean;
  type?: 'serial' | 'tcp-server' | 'tcp-client' | 'virtual' | null;
  info?: string;
  port?: number;
  clientCount?: number;
  error?: string;
}

export interface SerialPortInfo {
  path: string;
  manufacturer?: string;
  serialNumber?: string;
  vendorId?: string;
  productId?: string;
  isUsb?: boolean;
}

export interface SerialConfig {
  path: string;
  baudRate: number;
  dataBits: number;
  stopBits: number;
  parity: 'none' | 'even' | 'odd' | 'mark' | 'space';
  rtscts: boolean;
}

export interface AppTheme {
  name: 'modern-dark' | 'modern-light' | 'classic-retro';
  rxColor: string;
  txColor: string;
  textColor: string;
}

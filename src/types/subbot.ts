export interface SubBotConfig {
  id: string;
  ownerJid: string;
  ownerName: string;
  phoneNumber: string;
  sessionPath: string;
  prefix: string;
  name: string;
  active: boolean;
  createdAt: number;
  connectedAt?: number;
  status: 'pending' | 'connecting' | 'connected' | 'disconnected' | 'error';
  pairingCode?: string;
  pairingCodeRequestedAt?: number;
}

export interface SubBotMessage {
  type: 'command' | 'status' | 'pairingCode' | 'error' | 'ready';
  subBotId: string;
  payload: unknown;
}

export interface SubBotStatus {
  id: string;
  status: SubBotConfig['status'];
  name: string;
  phoneNumber: string;
  ownerJid: string;
  connectedAt?: number;
}

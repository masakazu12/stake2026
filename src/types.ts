export interface ClaimConfig {
  delayMs: number;
  autoCloseLimit: boolean;
  audioAlert: boolean;
  keywords: string[];
}

export interface ClaimedCode {
  code: string;
  timestamp: number;
  status: 'claimed' | 'limit_reached' | 'invalid' | 'already_processed' | 'pending';
  source: string;
}

export interface LogEntry {
  id: string;
  timestamp: number;
  type: 'info' | 'success' | 'warn' | 'error';
  message: string;
}

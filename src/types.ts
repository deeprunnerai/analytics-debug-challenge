export interface AnalyticsEvent {
  eventId: string;
  userId: string | number;
  sessionId: string;
  eventType: string;
  timestamp: string;
  properties: Record<string, unknown>;
  metadata: {
    source: string;
    version: string;
    processedAt?: string;
  };
}

export interface ProcessedEvent extends AnalyticsEvent {
  indexedAt: string;
  processingTimeMs: number;
}

export interface KafkaMessage {
  key: string | null;
  value: Buffer | null;
  timestamp: string;
  offset: string;
}

export interface BulkIndexResult {
  successful: number;
  failed: number;
  took: number;
}

export interface WebSocketMessage {
  type: 'event' | 'stats' | 'error';
  payload: unknown;
}

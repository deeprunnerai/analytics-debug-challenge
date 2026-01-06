import { Kafka, Consumer, EachBatchPayload } from 'kafkajs';
import { v4 as uuidv4 } from 'uuid';
import { AnalyticsEvent, ProcessedEvent } from '../types';
import { ElasticsearchService } from '../elasticsearch/client';

const KAFKA_BROKERS = (process.env.KAFKA_BROKERS || 'localhost:9092').split(',');
const KAFKA_TOPIC = process.env.KAFKA_TOPIC || 'analytics-events';
const KAFKA_GROUP_ID = process.env.KAFKA_GROUP_ID || 'analytics-consumer-group';
const BATCH_SIZE = parseInt(process.env.BATCH_SIZE || '100', 10);

export class AnalyticsConsumer {
  private kafka: Kafka;
  private consumer: Consumer;
  private esService: ElasticsearchService;
  private isRunning: boolean = false;
  private eventHandlers: ((event: ProcessedEvent) => void)[] = [];
  private stats = {
    processed: 0,
    indexed: 0,
    errors: 0
  };

  constructor(esService: ElasticsearchService) {
    this.kafka = new Kafka({
      clientId: 'analytics-ingestion',
      brokers: KAFKA_BROKERS,
      retry: {
        initialRetryTime: 100,
        retries: 8
      }
    });
    this.consumer = this.kafka.consumer({
      groupId: KAFKA_GROUP_ID,
      sessionTimeout: 30000,
      heartbeatInterval: 3000
    });
    this.esService = esService;
  }

  onEvent(handler: (event: ProcessedEvent) => void): void {
    this.eventHandlers.push(handler);
  }

  private notifyHandlers(event: ProcessedEvent): void {
    this.eventHandlers.forEach(handler => {
      try {
        handler(event);
      } catch (err) {
        console.error('Event handler error:', err);
      }
    });
  }

  async start(): Promise<void> {
    await this.consumer.connect();
    await this.consumer.subscribe({
      topic: KAFKA_TOPIC,
      fromBeginning: false
    });

    this.isRunning = true;

    await this.consumer.run({
      eachBatchAutoResolve: false,
      eachBatch: async (payload: EachBatchPayload) => {
        await this.processBatch(payload);
      }
    });

    console.log('Analytics consumer started');
  }

  private async processBatch(payload: EachBatchPayload): Promise<void> {
    const { batch, resolveOffset, heartbeat, commitOffsetsIfNecessary } = payload;
    const events: ProcessedEvent[] = [];

    for (const message of batch.messages) {
      if (!message.value) continue;

      try {
        const rawEvent = JSON.parse(message.value.toString()) as AnalyticsEvent;
        const processedEvent = this.transformEvent(rawEvent);
        events.push(processedEvent);
        this.stats.processed++;

        if (events.length >= BATCH_SIZE) {
          await this.flushEvents(events);
          events.length = 0;
          await heartbeat();
        }
      } catch (err) {
        console.error('Failed to parse message:', err);
        this.stats.errors++;
      }

      resolveOffset(message.offset);
    }

    if (events.length > 0) {
      await this.flushEvents(events);
    }

    await commitOffsetsIfNecessary();
  }

  private transformEvent(raw: AnalyticsEvent): ProcessedEvent {
    const startTime = Date.now();

    return {
      ...raw,
      eventId: raw.eventId || uuidv4(),
      indexedAt: new Date().toISOString(),
      processingTimeMs: Date.now() - startTime,
      metadata: {
        ...raw.metadata,
        processedAt: new Date().toISOString()
      }
    };
  }

  private async flushEvents(events: ProcessedEvent[]): Promise<void> {
    const result = await this.esService.bulkIndex(events);
    this.stats.indexed += result.successful;

    events.forEach(event => this.notifyHandlers(event));

    console.log(`Indexed ${result.successful} events in ${result.took}ms`);
  }

  getStats(): typeof this.stats {
    return { ...this.stats };
  }

  async stop(): Promise<void> {
    this.isRunning = false;
    await this.consumer.disconnect();
    console.log('Analytics consumer stopped');
  }
}

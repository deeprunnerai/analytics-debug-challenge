import { ElasticsearchService } from './elasticsearch/client';
import { AnalyticsConsumer } from './kafka/consumer';
import { EventStreamServer } from './websocket/server';

class AnalyticsIngestionService {
  private esService: ElasticsearchService;
  private consumer: AnalyticsConsumer;
  private wsServer: EventStreamServer;
  private statsInterval: NodeJS.Timeout | null = null;

  constructor() {
    this.esService = new ElasticsearchService();
    this.consumer = new AnalyticsConsumer(this.esService);
    this.wsServer = new EventStreamServer();
  }

  async start(): Promise<void> {
    console.log('Starting Analytics Ingestion Service...');

    await this.esService.initialize();
    console.log('Elasticsearch initialized');

    this.consumer.onEvent((event) => {
      this.wsServer.broadcast(event);
    });

    await this.consumer.start();

    this.startStatsReporting();

    console.log('Analytics Ingestion Service is running');
  }

  private startStatsReporting(): void {
    this.statsInterval = setInterval(async () => {
      const consumerStats = this.consumer.getStats();
      const esCount = await this.esService.getEventCount();
      const wsClients = this.wsServer.getClientCount();

      console.log(JSON.stringify({
        timestamp: new Date().toISOString(),
        stats: {
          kafka: consumerStats,
          elasticsearch: { documentCount: esCount },
          websocket: { connectedClients: wsClients }
        }
      }));
    }, 30000);
  }

  async shutdown(): Promise<void> {
    console.log('Shutting down...');

    if (this.statsInterval) {
      clearInterval(this.statsInterval);
    }

    await this.consumer.stop();
    this.wsServer.close();

    console.log('Shutdown complete');
    process.exit(0);
  }
}

async function main(): Promise<void> {
  const service = new AnalyticsIngestionService();

  process.on('SIGINT', () => service.shutdown());
  process.on('SIGTERM', () => service.shutdown());

  try {
    await service.start();
  } catch (error) {
    console.error('Failed to start service:', error);
    process.exit(1);
  }
}

main();

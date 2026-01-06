import { Client } from '@elastic/elasticsearch';
import { ProcessedEvent, BulkIndexResult } from '../types';
import { ANALYTICS_INDEX, analyticsMapping, ilmPolicy } from './mapping';

const ES_NODE = process.env.ES_NODE || 'http://localhost:9200';

export class ElasticsearchService {
  private client: Client;
  private indexName: string;

  constructor() {
    this.client = new Client({
      node: ES_NODE,
      maxRetries: 3,
      requestTimeout: 30000,
    });
    this.indexName = ANALYTICS_INDEX;
  }

  async initialize(): Promise<void> {
    try {
      const indexExists = await this.client.indices.exists({
        index: this.indexName
      });

      if (!indexExists) {
        await this.client.ilm.putLifecycle({
          name: 'analytics-lifecycle',
          policy: ilmPolicy.policy
        });

        await this.client.indices.create({
          index: this.indexName,
          ...analyticsMapping
        });

        console.log(`Index ${this.indexName} created successfully`);
      }
    } catch (error) {
      console.error('Failed to initialize Elasticsearch:', error);
      throw error;
    }
  }

  async bulkIndex(events: ProcessedEvent[]): Promise<BulkIndexResult> {
    if (events.length === 0) {
      return { successful: 0, failed: 0, took: 0 };
    }

    const operations = events.flatMap(event => [
      { index: { _index: this.indexName, _id: event.eventId } },
      event
    ]);

    const startTime = Date.now();

    const response = await this.client.bulk({
      refresh: false,
      operations
    });

    const took = Date.now() - startTime;

    if (response.errors) {
      const errorItems = response.items.filter(item => item.index?.error);
      console.warn(`Bulk indexing completed with ${errorItems.length} errors`);
    }

    return {
      successful: events.length,
      failed: 0,
      took
    };
  }

  async search(query: object, size: number = 100): Promise<ProcessedEvent[]> {
    const response = await this.client.search({
      index: this.indexName,
      query,
      size,
      sort: [{ timestamp: 'desc' }]
    });

    return response.hits.hits.map(hit => hit._source as ProcessedEvent);
  }

  async getEventCount(): Promise<number> {
    const response = await this.client.count({
      index: this.indexName
    });
    return response.count;
  }

  async healthCheck(): Promise<boolean> {
    try {
      const health = await this.client.cluster.health();
      return health.status !== 'red';
    } catch {
      return false;
    }
  }
}

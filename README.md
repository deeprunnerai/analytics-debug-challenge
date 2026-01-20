# Analytics Ingestion Service - Debug Challenge

## Overview

This service is responsible for ingesting analytics events from a Kafka topic, indexing them into Elasticsearch, and streaming them to connected dashboard clients via WebSocket.

## Architecture

```
┌─────────────┐     ┌──────────────────┐     ┌───────────────┐
│   Kafka     │────▶│  Ingestion       │────▶│ Elasticsearch │
│   Topic     │     │  Service         │     │               │
└─────────────┘     └────────┬─────────┘     └───────────────┘
                             │
                             ▼
                    ┌────────────────┐
                    │   WebSocket    │
                    │   Clients      │
                    └────────────────┘
```

## The Problem

The analytics team has reported that **dashboard metrics don't match expected values**. Specifically:

1. The dashboard shows approximately **15-30% fewer events** than what the upstream systems report sending
2. Certain user segments appear to have **no analytics data at all**
3. The discrepancy seems **random** - some batches are fine, others have missing data
4. **No errors appear in the application logs** - the service reports successful processing

### What We Know

- Kafka consumer lag is consistently low (< 100 messages)
- Elasticsearch cluster health is green
- The service has been running without restarts for 2 weeks
- Memory and CPU utilization are normal
- Network connectivity is stable

### Business Impact

- Marketing team cannot accurately measure campaign effectiveness
- Product team is missing conversion funnel data for certain user cohorts
- Finance is seeing discrepancies in revenue attribution

## Your Task

Identify the root cause of the data loss and propose a fix.

## Running Locally

### Prerequisites

- Docker and Docker Compose
- Node.js 20+

### Setup

```bash
# Start infrastructure
docker-compose up -d

# Install dependencies
npm install

# Build the service
npm run build

# Run the service
npm start
```

### Generating Test Events

The docker-compose includes a test producer that generates sample events:

```bash
docker-compose up event-producer
```

### Test Scripts

Additional test scripts are available in `scripts/`:

```bash
cd scripts && npm install

# Send burst of 1000 events
npm run burst

# Send smaller burst (100 events)
npm run burst:small

# Send larger burst (5000 events)
npm run burst:large

# Check Elasticsearch document count
npm run verify
```

### Observed Test Results

When testing with the burst script, we observed the following:

| Events Sent | Events Indexed | Result |
|-------------|----------------|--------|
| 1000 | 739 | ~26% missing |

### Useful Commands

```bash
# Check Elasticsearch document count
curl http://localhost:9200/analytics-events/_count

# View recent documents
curl http://localhost:9200/analytics-events/_search?size=10

# Check Kafka consumer group lag
docker-compose exec kafka kafka-consumer-groups \
  --bootstrap-server localhost:9092 \
  --group analytics-consumer-group \
  --describe

# View service logs
docker-compose logs -f analytics-service
```

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| ES_NODE | http://localhost:9200 | Elasticsearch endpoint |
| KAFKA_BROKERS | localhost:9092 | Kafka broker addresses |
| KAFKA_TOPIC | analytics-events | Source topic for events |
| KAFKA_GROUP_ID | analytics-consumer-group | Consumer group ID |
| WS_PORT | 8080 | WebSocket server port |
| BATCH_SIZE | 100 | Events per bulk index operation |

## Project Structure

```
src/
├── index.ts                 # Service entry point
├── types.ts                 # TypeScript interfaces
├── kafka/
│   └── consumer.ts          # Kafka consumer implementation
├── elasticsearch/
│   ├── client.ts            # ES client and bulk indexing
│   └── mapping.ts           # Index mapping and ILM policy
└── websocket/
    └── server.ts            # Real-time event streaming
```

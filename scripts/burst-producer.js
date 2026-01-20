const { Kafka } = require('kafkajs');
const { v4: uuidv4 } = require('uuid');

const KAFKA_BROKERS = (process.env.KAFKA_BROKERS || 'localhost:9092').split(',');
const KAFKA_TOPIC = process.env.KAFKA_TOPIC || 'analytics-events';
const BURST_SIZE = parseInt(process.env.BURST_SIZE || '1000', 10);
const BATCH_SIZE = parseInt(process.env.BATCH_SIZE || '100', 10);

const kafka = new Kafka({
  clientId: 'burst-producer',
  brokers: KAFKA_BROKERS,
});

const producer = kafka.producer();

const eventTypes = [
  'page_view',
  'button_click',
  'form_submit',
  'search',
  'purchase',
  'signup',
  'login',
  'logout'
];

const sources = ['web', 'mobile-ios', 'mobile-android', 'api'];

function generateUserId(source) {
  const id = Math.floor(Math.random() * 1000000);
  if (source === 'api') {
    return uuidv4();
  }
  return id;
}

function generateEvent() {
  const eventType = eventTypes[Math.floor(Math.random() * eventTypes.length)];
  const source = sources[Math.floor(Math.random() * sources.length)];

  return {
    eventId: uuidv4(),
    userId: generateUserId(source),
    sessionId: uuidv4(),
    eventType,
    timestamp: new Date().toISOString(),
    properties: {
      url: `https://example.com/${eventType}`,
      referrer: Math.random() > 0.5 ? 'https://google.com' : null,
      duration: Math.floor(Math.random() * 10000),
    },
    metadata: {
      source,
      version: '1.0.0',
    },
  };
}

async function sendBurst() {
  console.log(`Connecting to Kafka at ${KAFKA_BROKERS.join(', ')}...`);
  await producer.connect();
  console.log('Producer connected');

  console.log(`Sending ${BURST_SIZE} events in batches of ${BATCH_SIZE}...`);

  let totalSent = 0;
  const startTime = Date.now();

  for (let i = 0; i < BURST_SIZE; i += BATCH_SIZE) {
    const batchCount = Math.min(BATCH_SIZE, BURST_SIZE - i);
    const events = Array.from({ length: batchCount }, generateEvent);

    await producer.send({
      topic: KAFKA_TOPIC,
      messages: events.map(event => ({
        key: event.userId.toString(),
        value: JSON.stringify(event),
      })),
    });

    totalSent += batchCount;
    console.log(`Sent batch ${Math.floor(i / BATCH_SIZE) + 1}: ${totalSent}/${BURST_SIZE} events`);
  }

  const elapsed = Date.now() - startTime;
  console.log(`\nBurst complete!`);
  console.log(`Total events sent: ${totalSent}`);
  console.log(`Time elapsed: ${elapsed}ms`);
  console.log(`Rate: ${Math.round(totalSent / (elapsed / 1000))} events/second`);

  await producer.disconnect();
  console.log('Producer disconnected');
}

sendBurst().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});

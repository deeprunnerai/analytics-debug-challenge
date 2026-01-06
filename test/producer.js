const { Kafka } = require('kafkajs');
const { v4: uuidv4 } = require('uuid');

const KAFKA_BROKERS = (process.env.KAFKA_BROKERS || 'localhost:9092').split(',');
const KAFKA_TOPIC = process.env.KAFKA_TOPIC || 'analytics-events';
const EVENTS_PER_SECOND = parseInt(process.env.EVENTS_PER_SECOND || '10', 10);

const kafka = new Kafka({
  clientId: 'event-producer',
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

async function run() {
  await producer.connect();
  console.log('Producer connected');

  setInterval(async () => {
    const events = Array.from({ length: EVENTS_PER_SECOND }, generateEvent);

    await producer.send({
      topic: KAFKA_TOPIC,
      messages: events.map(event => ({
        key: event.userId.toString(),
        value: JSON.stringify(event),
      })),
    });

    console.log(`Sent ${events.length} events`);
  }, 1000);
}

run().catch(console.error);

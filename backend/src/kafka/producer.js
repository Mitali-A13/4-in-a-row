// backend/src/kafka/producer.js
const { Kafka } = require('kafkajs');

const kafka = new Kafka({
  clientId: '4-in-a-row-game',
  brokers: [process.env.KAFKA_BROKER || 'localhost:9092'],
  retry: {
    retries: 3
  },
  logLevel: 0 // Disable logs
});

const producer = kafka.producer();
let isConnected = false;

async function connectProducer() {
  try {
    await producer.connect();
    isConnected = true;
    console.log('Kafka producer connected');
  } catch (error) {
    console.error('Kafka producer connection error:', error.message);
    console.log('Continuing without Kafka...');
  }
}

async function sendGameEvent(event) {
  if (!isConnected) {
    console.log('Kafka not connected, skipping event:', event.type);
    return;
  }

  try {
    await producer.send({
      topic: 'game-events',
      messages: [
        {
          key: event.gameId,
          value: JSON.stringify(event),
          timestamp: event.timestamp.toString()
        }
      ]
    });
    console.log('Event sent to Kafka:', event.type);
  } catch (error) {
    console.error('Error sending event to Kafka:', error.message);
  }
}

async function disconnectProducer() {
  if (isConnected) {
    await producer.disconnect();
    console.log('Kafka producer disconnected');
  }
}

// Connect on startup
connectProducer();

// Graceful shutdown
process.on('SIGINT', async () => {
  await disconnectProducer();
  process.exit(0);
});

module.exports = {
  sendGameEvent,
  connectProducer,
  disconnectProducer
};
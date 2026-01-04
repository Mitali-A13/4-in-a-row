// backend/src/kafka/consumer.js
const { Kafka } = require('kafkajs');
const { Pool } = require('pg');

const kafka = new Kafka({
  clientId: '4-in-a-row-analytics',
  brokers: [process.env.KAFKA_BROKER || 'localhost:9092']
});

const consumer = kafka.consumer({ groupId: 'analytics-group' });

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || '4in_a_row',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres'
});

async function initAnalyticsDB() {
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS analytics_events (
        id SERIAL PRIMARY KEY,
        event_type VARCHAR(50) NOT NULL,
        game_id UUID,
        username VARCHAR(100),
        data JSONB,
        timestamp BIGINT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_event_type ON analytics_events(event_type);
      CREATE INDEX IF NOT EXISTS idx_game_id ON analytics_events(game_id);
      CREATE INDEX IF NOT EXISTS idx_timestamp ON analytics_events(timestamp);
    `);

    console.log('Analytics database initialized');
  } catch (error) {
    console.error('Analytics DB initialization error:', error);
  } finally {
    client.release();
  }
}

async function saveEvent(event) {
  const client = await pool.connect();
  try {
    await client.query(
      `INSERT INTO analytics_events (event_type, game_id, username, data, timestamp)
       VALUES ($1, $2, $3, $4, $5)`,
      [event.type, event.gameId, event.username, JSON.stringify(event), event.timestamp]
    );
  } catch (error) {
    console.error('Error saving analytics event:', error);
  } finally {
    client.release();
  }
}

async function runConsumer() {
  try {
    await initAnalyticsDB();
    await consumer.connect();
    await consumer.subscribe({ topic: 'game-events', fromBeginning: true });

    console.log('Kafka consumer connected and subscribed');

    await consumer.run({
      eachMessage: async ({ topic, partition, message }) => {
        const event = JSON.parse(message.value.toString());
        
        console.log('Received event:', {
          type: event.type,
          gameId: event.gameId,
          timestamp: new Date(event.timestamp).toISOString()
        });

        // Save event to database
        await saveEvent(event);

        // Process different event types
        switch (event.type) {
          case 'PLAYER_JOINED':
            console.log(`Player ${event.username} joined game ${event.gameId}`);
            break;
          
          case 'MOVE_MADE':
            console.log(`Move made in game ${event.gameId} by player ${event.player}`);
            break;
          
          case 'GAME_ENDED':
            console.log(`🏁 Game ${event.gameId} ended. Duration: ${event.duration}ms`);
            if (event.winner) {
              console.log(`   Winner: Player ${event.winner}`);
            } else {
              console.log(`   Result: Draw`);
            }
            await updateGameMetrics(event);
            break;
        }
      }
    });
  } catch (error) {
    console.error('Kafka consumer error:', error);
    console.log('Analytics service will run without Kafka');
  }
}

async function updateGameMetrics(event) {
  const client = await pool.connect();
  try {
    // Create or update daily metrics
    await client.query(`
      CREATE TABLE IF NOT EXISTS daily_metrics (
        date DATE PRIMARY KEY,
        total_games INTEGER DEFAULT 0,
        total_duration BIGINT DEFAULT 0,
        avg_duration INTEGER DEFAULT 0,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await client.query(`
      INSERT INTO daily_metrics (date, total_games, total_duration, avg_duration)
      VALUES (CURRENT_DATE, 1, $1, $1)
      ON CONFLICT (date) DO UPDATE SET
        total_games = daily_metrics.total_games + 1,
        total_duration = daily_metrics.total_duration + $1,
        avg_duration = (daily_metrics.total_duration + $1) / (daily_metrics.total_games + 1),
        updated_at = CURRENT_TIMESTAMP
    `, [event.duration]);

  } catch (error) {
    console.error('Error updating metrics:', error);
  } finally {
    client.release();
  }
}

async function getAnalytics() {
  const client = await pool.connect();
  try {
    // Get overall stats
    const stats = await client.query(`
      SELECT 
        COUNT(*) as total_events,
        COUNT(DISTINCT game_id) as total_games,
        COUNT(DISTINCT username) as unique_players
      FROM analytics_events
    `);

    // Get event type distribution
    const eventTypes = await client.query(`
      SELECT event_type, COUNT(*) as count
      FROM analytics_events
      GROUP BY event_type
      ORDER BY count DESC
    `);

    // Get recent metrics
    const metrics = await client.query(`
      SELECT * FROM daily_metrics
      ORDER BY date DESC
      LIMIT 7
    `);

    return {
      overall: stats.rows[0],
      eventTypes: eventTypes.rows,
      dailyMetrics: metrics.rows
    };
  } catch (error) {
    console.error('Error fetching analytics:', error);
    return null;
  } finally {
    client.release();
  }
}

// shutdown
process.on('SIGINT', async () => {
  await consumer.disconnect();
  await pool.end();
  console.log('Analytics service stopped');
  process.exit(0);
});

// Run if executed directly
if (require.main === module) {
  runConsumer();
}

module.exports = {
  runConsumer,
  getAnalytics
};
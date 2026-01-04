// backend/src/database/db.js
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

async function initDB() {
  const client = await pool.connect();
  try {
    // Check if games table exists and has old schema
    const checkColumn = await client.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'games' AND column_name = 'winner'
    `);

    // If old column exists, drop and recreate the table
    if (checkColumn.rows.length > 0) {
      console.log('Migrating games table to new schema...');
      await client.query('DROP TABLE IF EXISTS games CASCADE');
    }

    await client.query(`
      CREATE TABLE IF NOT EXISTS games (
        id UUID PRIMARY KEY,
        player1_username VARCHAR(100) NOT NULL,
        player2_username VARCHAR(100) NOT NULL,
        winner_username VARCHAR(100),
        is_draw BOOLEAN DEFAULT FALSE,
        start_time BIGINT NOT NULL,
        end_time BIGINT NOT NULL,
        duration INTEGER NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS leaderboard (
        username VARCHAR(100) PRIMARY KEY,
        wins INTEGER DEFAULT 0,
        losses INTEGER DEFAULT 0,
        draws INTEGER DEFAULT 0,
        total_games INTEGER DEFAULT 0,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    console.log('Database initialized successfully');
  } catch (error) {
    console.error('Database initialization error:', error);
  } finally {
    client.release();
  }
}

async function saveGame(gameData) {
  const client = await pool.connect();
  try {
    // Save game record
    await client.query(
      `INSERT INTO games (id, player1_username, player2_username, winner_username, is_draw, start_time, end_time, duration)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        gameData.gameId,
        gameData.player1,
        gameData.player2,
        gameData.winner,
        gameData.isDraw,
        gameData.timestamp - gameData.duration,
        gameData.timestamp,
        gameData.duration
      ]
    );

    // Update leaderboard for player 1
    const player1Won = gameData.winner === gameData.player1;
    await updateLeaderboard(client, gameData.player1, player1Won, gameData.isDraw);
    
    // Update leaderboard for player 2
    const player2Won = gameData.winner === gameData.player2;
    await updateLeaderboard(client, gameData.player2, player2Won, gameData.isDraw);

    console.log('Game saved to leaderboard:', gameData.gameId);
  } catch (error) {
    console.error('Error saving game:', error);
    throw error;
  } finally {
    client.release();
  }
}

async function updateLeaderboard(client, username, won, draw) {
  await client.query(
    `INSERT INTO leaderboard (username, wins, losses, draws, total_games)
     VALUES ($1, $2, $3, $4, 1)
     ON CONFLICT (username) DO UPDATE SET
       wins = leaderboard.wins + $2,
       losses = leaderboard.losses + $3,
       draws = leaderboard.draws + $4,
       total_games = leaderboard.total_games + 1,
       updated_at = CURRENT_TIMESTAMP`,
    [username, won ? 1 : 0, (!won && !draw) ? 1 : 0, draw ? 1 : 0]
  );
}

async function getLeaderboard(limit = 10) {
  const client = await pool.connect();
  try {
    const result = await client.query(
      `SELECT username, wins, losses, draws, total_games
       FROM leaderboard
       ORDER BY wins DESC, total_games ASC
       LIMIT $1`,
      [limit]
    );
    return result.rows;
  } catch (error) {
    console.error('Error fetching leaderboard:', error);
    return [];
  } finally {
    client.release();
  }
}

async function getGameStats() {
  const client = await pool.connect();
  try {
    const avgDuration = await client.query(
      'SELECT AVG(duration) as avg_duration FROM games'
    );

    const gamesPerDay = await client.query(
      `SELECT DATE(created_at) as date, COUNT(*) as count
       FROM games
       GROUP BY DATE(created_at)
       ORDER BY date DESC
       LIMIT 7`
    );

    const topWinners = await client.query(
      `SELECT username, wins
       FROM leaderboard
       ORDER BY wins DESC
       LIMIT 5`
    );

    return {
      avgDuration: avgDuration.rows[0]?.avg_duration || 0,
      gamesPerDay: gamesPerDay.rows,
      topWinners: topWinners.rows
    };
  } catch (error) {
    console.error('Error fetching game stats:', error);
    return null;
  } finally {
    client.release();
  }
}

module.exports = {
  initDB,
  saveGame,
  getLeaderboard,
  getGameStats
};

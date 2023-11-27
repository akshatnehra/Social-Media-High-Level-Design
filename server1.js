const express = require('express');
const axios = require('axios');
const { createClient } = require('redis');
const mysql = require('mysql2/promise');

const app = express();
const port = 4000;

const cors = require('cors');
app.use(cors());

const { Kafka, Partitioners } = require('kafkajs');

const kafka = new Kafka({
  clientId: 'my-app',
  brokers: ['localhost:9092'],
});

const producer = kafka.producer({ createPartitioner: Partitioners.LegacyPartitioner });

const centralServerURL = 'http://localhost:3000/heartbeat';

// The interval (in milliseconds) for sending heartbeat signals
const heartbeatInterval = 5000;

// Timestamp of the last heartbeat sent
let lastHeartbeatTimestamp = 0;

let redisClient;

const connectRedis = async () => {
    // Create Redis client
    const client = createClient({
        password: 'm22BEoM1Gpa9s2boSDcQlX51IctLKWOA',
        socket: {
            host: 'redis-11604.c321.us-east-1-2.ec2.cloud.redislabs.com',
            port: 11604
        }
    });

    // Connect to Redis
    await client.connect();
    console.log('Redis connected');
    redisClient = client; // Assign the connected client to redisClient
}

connectRedis();

var mysqlConnection;

async function connectMySql() {
  // Create the connection
  mysqlConnection = await mysql.createConnection({
      host: 'localhost',
      port: 3306,
      user: 'root',
      password: '',
      database: 'social_media'
  });

  // Connect to the database
  await mysqlConnection.connect();

  // Log the connection status
  console.log(`MySQL social_media connected`);
}

connectMySql();


async function sendHeartbeat() {
  const currentTimestamp = Date.now();
  lastHeartbeatTimestamp = currentTimestamp;

  try {
    // Send the heartbeat to the central server
    await axios.post(
      centralServerURL,
      {
        timestamp: currentTimestamp,
        ipAddress: 'http://localhost:4000',
      },
      {
        timeout: 5000, // Set a timeout of 5 seconds (adjust as needed)
      }
    );
    console.log(`Heartbeat sent: ${currentTimestamp}`);
  } catch (error) {
    console.error('Failed to send heartbeat:', error.message);
  }
}

// Regularly send heartbeat signals
setInterval(() => {
  // Trigger the heartbeat route within the interval
  sendHeartbeat();
}, heartbeatInterval);

app.listen(port, () => {
  console.log(`Heartbeat service is running on port ${port}`);
});

// Middleware to set response in Redis cache for '/getUser/userID', here userID is a dynamic parameter
app.get('/getUser/:userID', async (req, res) => {
  const userid = req.params.userID;
  // Check if the data is present in Redis cache
  const cacheKey = `userID:${userid}`;

  const responseData = {
    userID: userid,
    name: 'John Doe',
    email: 'chacha@gmail.com'
  };

  try {
    // Example response data
    const responseToCache = {
      status: 200,
      data: responseData,
    };

    // Response from server 2
    console.log('Response from server 1');

    // Store the response in Redis cache
    await redisClient.set(cacheKey, JSON.stringify(responseToCache), {'EX': 50});
    console.log('Data cached in Redis for /getUser');

    res.status(responseToCache.status).json(responseToCache.data);
  } catch (error) {
    console.error('Error retrieving data from Redis:', error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
});

// Create a post request to /posttesting
app.post('/changeName/:userID/:newName', async (req, res) => {
  // get userid
  const userid = req.params.userID;

  // get new name
  const newName = req.params.newName;

  // Update the database
  const sql = `UPDATE users SET username = '${newName}' WHERE userID = '${userid}'`;
  await mysqlConnection.query(sql);
  await produceMessage(sql);

  res.send('Testing from server 1');
});

const produceMessage = async (query) => {
  await producer.connect();
  
  console.log('Producing message:', query);
  await producer.send({
    topic: 'data-sync-topic',
    messages: [{ value: JSON.stringify(query) }],
  });

  console.log('Message sent successfully');
  await producer.disconnect();
};

const express = require('express');
const axios = require('axios');
const { createClient } = require('redis');

const app = express();
const port = 6000;

const cors = require('cors');
app.use(cors());

const centralServerURL = 'http://localhost:3000/heartbeat';

// The interval (in milliseconds) for sending heartbeat signals
const heartbeatInterval = 5000; 

// Timestamp of the last heartbeat sent
let lastHeartbeatTimestamp = 0;

const { Kafka } = require('kafkajs');
const mysql = require('mysql2/promise');

const kafka = new Kafka({
  clientId: 'my-app',
  brokers: ['localhost:9092'],
});

const consumer = kafka.consumer({ groupId: 'db2-group' });

var mysqlConnection;

async function connectToMySQL() {
    mysqlConnection = await mysql.createConnection({
        host: 'localhost',
        port: 3306,
        user: 'root',
        password: '',
        database: 'social_media_rc2',
      });
      
      // Connect to the database
      await mysqlConnection.connect();
}

// Connect to the database
connectToMySQL();

const runConsumer = async () => {
  console.log('Running social_media_rc2 consumer');
  await consumer.connect();
  await consumer.subscribe({ topic: 'data-sync-topic', fromBeginning: true });

  await consumer.run({
    eachMessage: async ({ topic, partition, message }) => {
      const query = JSON.parse(message.value.toString());
      console.log('Received message in social_media_rc2 consumer:', query);

      // Perform database operation in db1
      const [rows] = await mysqlConnection.query(query);
      console.log('Inserted into social_media_rc2:', rows);
    },
  });
};

runConsumer();


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

// Endpoint to send heartbeat to central server
function sendHeartbeat() {
    const currentTimestamp = Date.now();
    lastHeartbeatTimestamp = currentTimestamp;

    // Send the heartbeat to the central server
    axios
        .post(centralServerURL, { timestamp: currentTimestamp, ipAddress: "http://localhost:6000" })
        .then(() => {
        console.log(`Heartbeat sent: ${currentTimestamp}`);
        })
        .catch((error) => {
        console.error('Failed to send heartbeat:', error.message);
        });
}

// Regularly send heartbeat signals
setInterval(() => {
  // Trigger the heartbeat route within the interval
  sendHeartbeat();
}, heartbeatInterval);

app.listen(port, () => {
  console.log(`Heartbeat service is running on port ${port}`);
});

// Create a get request to /
app.get('/', (req, res) => {
    res.send('Hello from server 3!');
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
    console.log('Response from server 3');

    // Store the response in Redis cache
    await redisClient.set(cacheKey, JSON.stringify(responseToCache), {'EX': 50});
    console.log('Data cached in Redis for /getUser');

    res.status(responseToCache.status).json(responseToCache.data);
  } catch (error) {
    console.error('Error retrieving data from Redis:', error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
});
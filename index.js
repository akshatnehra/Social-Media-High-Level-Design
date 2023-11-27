const express = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');

const app = express();
const port = 3000;
const cors = require('cors');

const sendSMS = require('./twilio');

const { createClient } = require('redis');

const expectedHeartbeatInterval = 10000; // 10 seconds

// Store the last received heartbeats from instances
const lastHeartbeats = {};

app.use(express.json());

var time;

// Define your backend servers
const backendServers = [
  'http://localhost:4000',
  'http://localhost:5000',
  'http://localhost:6000'
];

app.use(cors());

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

// Create if not exist or append in request_log.txt
const fs = require('fs');
const path = require('path');

const requestLogPath = path.join(__dirname, 'log_request.txt');
const errorLogPath = path.join(__dirname, 'log_error.txt');

// Create an object to track the number of connections to each server
const connectionCount = {};
backendServers.forEach(server => {
  connectionCount[server] = 0;
});

// Endpoint to receive heartbeat signals
app.post('/heartbeat', (req, res) => {
    const { timestamp, ipAddress } = req.body; // Get the IP address of the instance sending the heartbeat
    const currentTime = Date.now();
  
    // Store the timestamp of the last received heartbeat
    lastHeartbeats[ipAddress] = currentTime;
  
    console.log(`Received heartbeat from ${ipAddress}: ${timestamp}`);
  
    // Check if the server is in the list of available servers
    if (!backendServers.includes(ipAddress)) {
      console.log(`${ipAddress} server added to available servers.`);

      sendSMS(`${ipAddress} is back online, server added to available servers.`);
  
      // Add the server to the list of available servers
      backendServers.push(ipAddress);
  
      // Log the new list of available servers
      console.log(`Available servers: ${backendServers}`);
    }
  
    res.status(200).send('Heartbeat received');
});

// Custom middleware to implement Least Connections strategy
app.use(async (req, res, next) => {
  time = Date.now();

  // Sleep for 5 seconds
  await new Promise(resolve => setTimeout(resolve, 5000));

  if (req.method === 'POST') {
    // Redirect all POST requests to server1

    // Log the request
    const log = `Request: ${req.method} ${req.originalUrl} ${Date.now()}`;
    fs.appendFileSync(requestLogPath, log + '\n');

    // Create the proxy middleware for server1 with the path
    const proxy = createProxyMiddleware({
      target: 'http://localhost:4000', // Replace with the actual URL of server1
      changeOrigin: true,
      pathRewrite: {
        [`^/`]: req.baseUrl !== '/' ? req.baseUrl : '',
      },
    });

    // Use the proxy middleware for POST requests
    proxy(req, res, next);
    
    var time2 = Date.now();
    var response_time = time2 - time;
    console.log(`Response time: ${response_time}ms`);

    if(response_time > 5000) {
      console.log('Response time is greater than 5 seconds!');
      sendSMS(`Response time is greater than 5 seconds! ${response_time}ms, Kindly check the server!`);
    }
  } else if (req.method === 'GET') {

    // Log the request
    const log = `Request: ${req.method} ${req.originalUrl} ${Date.now()}`;
    fs.appendFileSync(requestLogPath, log + '\n');

    // Check if the data is present in Redis cache
    const cacheKey = `userID:${req.body.userID}`; // Using the request URL as cache key for GET requests

    try {
     
      const cachedData = await redisClient.get(cacheKey);

      if (cachedData) {
        // If the data is present in Redis cache, send the response
        console.log('Response from Redis cache');
        const { status, data } = JSON.parse(cachedData);
        return res.status(status).json(data);
      }

      // Find the server with the least connections for GET requests
      const leastConnectionsServer = backendServers.reduce((prev, current) => {
        return connectionCount[current] < connectionCount[prev] ? current : prev;
      });

      // Increment the connection count for the selected server
      connectionCount[leastConnectionsServer]++;

      // Create the proxy middleware for the selected server with the path
      const proxy = createProxyMiddleware({
        target: leastConnectionsServer,
        changeOrigin: true,
        pathRewrite: {
          [`^/`]: req.baseUrl !== '/' ? req.baseUrl : '',
        },
      });
      
      proxy(req, res, next); // Proceed to the next middleware
      
      var time2 = Date.now();
      var response_time = time2 - time;
      console.log(`Response time: ${response_time}ms`);

      if(response_time > 5000) {
        console.log('Response time is greater than 5 seconds!');
        sendSMS(`Response time is greater than 5 seconds! ${response_time}ms, Kindly check the server!`);
      }
    } catch (error) {
      console.error('Error retrieving data from Redis:', error);

      // Log the error
      const log = `Error: ${error.message} ${Date.now()}`;
      fs.appendFileSync(errorLogPath, log + '\n');

      return res.status(500).json({ error: 'Internal Server Error' });
    }
  } else {
    // For other HTTP methods, proceed to the next middleware
    next();
  }
});

// Middleware to decrement the connection count when a response is sent
app.use((req, res, next) => {
  res.on('finish', () => {
    connectionCount[req.baseUrl]--; // Decrement the connection count for the corresponding server
  });
  next();
});

app.listen(port, () => {
  console.log(`Load balancer is running on port ${port}`);
});

// Continuously check for missing heartbeats every 5 seconds
setInterval(() => {
    // Copy backendServers array
    const slaveServers = [...backendServers];

    // Get the current timestamp
    const currentTime = Date.now();
    
    // Check for missing heartbeats
    slaveServers.forEach((server) => {
        console.log(`Checking heartbeat for ${server} server...`);
      if (currentTime - lastHeartbeats[server] > expectedHeartbeatInterval) {
        console.log(`${server} server is "unhealthy".`);

        // Check if the master server is "unhealthy"
        if (server === backendServers[0]) {
          console.log('Master server is "unhealthy".');
  
          // Make the next available server the master server
          backendServers.shift();
  
          // Log the new master server
          console.log(`New master server is ${backendServers[0]}`);
          sendSMS(`Master server was "unhealthy". New master server is ${backendServers[0]}`);

          // Log error
          const log = `Error: Master server was "unhealthy". ${Date.now()}`;
          fs.appendFileSync(errorLogPath, log + '\n');
        } else {
            // Remove the "unhealthy" server from the list of available servers
            backendServers.splice(backendServers.indexOf(server), 1);
        }

        console.log(`${server} server removed from available servers.`);
  
        // Log the new list of available servers
        console.log(`Available servers: ${backendServers}`);
  
        console.log('Failover complete.');
      }
    });
}, 5000);
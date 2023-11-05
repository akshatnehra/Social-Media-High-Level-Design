const express = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');

const app = express();
const port = 3000;
const cors = require('cors');

const expectedHeartbeatInterval = 10000; // 10 seconds

// Store the last received heartbeats from instances
const lastHeartbeats = {};

app.use(express.json());

// Define your backend servers
const backendServers = [
  'http://localhost:4000',
  'http://localhost:5000',
  'http://localhost:6000'
];

app.use(cors());

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
  
      // Add the server to the list of available servers
      backendServers.push(ipAddress);
  
      // Log the new list of available servers
      console.log(`Available servers: ${backendServers}`);
    }
  
    res.status(200).send('Heartbeat received');
});

// Custom middleware to implement Least Connections strategy
app.use((req, res, next) => {
  // Find the server with the least connections
  const leastConnectionsServer = backendServers.reduce((prev, current) => {
    return connectionCount[current] < connectionCount[prev] ? current : prev;
  });

  // Increment the connection count for the selected server
  connectionCount[leastConnectionsServer]++;

  // Create the proxy middleware for the selected server
  const proxy = createProxyMiddleware({
    target: leastConnectionsServer,
    changeOrigin: true,
  });

  // Use the proxy middleware for the incoming request
  proxy(req, res, next);
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
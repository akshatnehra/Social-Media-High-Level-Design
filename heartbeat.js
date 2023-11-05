const express = require('express');
const axios = require('axios');

const app = express();
const port = 3001;

const centralServerURL = 'http://localhost:3000/heartbeat';

// The interval (in milliseconds) for sending heartbeat signals
const heartbeatInterval = 5000; 

// Timestamp of the last heartbeat sent
let lastHeartbeatTimestamp = 0;

// Endpoint to send heartbeat to central server
app.get('/heartbeat', (req, res) => {
  const currentTimestamp = Date.now();
  lastHeartbeatTimestamp = currentTimestamp;

  // Send the heartbeat to the central server
  axios
    .post(centralServerURL, { timestamp: currentTimestamp, ipAddress: "https://localhost:4000" })
    .then(() => {
      res.status(200).send(`Heartbeat sent: ${currentTimestamp}`);
    })
    .catch((error) => {
      console.error('Failed to send heartbeat:', error.message);
      res.status(500).send('Internal Server Error');
    });
});

// Regularly send heartbeat signals
setInterval(() => {
  app.get('/heartbeat', (req, res) => {
    // Trigger the heartbeat route
    req.route.stack[0].handle(req, res);
  }, heartbeatInterval);
}, heartbeatInterval);

app.listen(port, () => {
  console.log(`Heartbeat service is running on port ${port}`);
});

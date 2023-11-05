const express = require('express');
const axios = require('axios');

const app = express();
const port = 5000;

const cors = require('cors');
app.use(cors());

const centralServerURL = 'http://localhost:3000/heartbeat';

// The interval (in milliseconds) for sending heartbeat signals
const heartbeatInterval = 5000; 

// Timestamp of the last heartbeat sent
let lastHeartbeatTimestamp = 0;

function sendHeartbeat() {
    const currentTimestamp = Date.now();
    lastHeartbeatTimestamp = currentTimestamp;

    // Send the heartbeat to the central server
    axios
        .post(centralServerURL, { timestamp: currentTimestamp, ipAddress: "http://localhost:5000" })
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
    res.send('Hello from server 2!');
  });
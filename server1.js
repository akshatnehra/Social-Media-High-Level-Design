const express = require('express');
const axios = require('axios');

const app = express();
const port = 4000;

const cors = require('cors');
app.use(cors());

const centralServerURL = 'http://localhost:3000/heartbeat';

// The interval (in milliseconds) for sending heartbeat signals
const heartbeatInterval = 5000; 

// Timestamp of the last heartbeat sent
let lastHeartbeatTimestamp = 0;

async function sendHeartbeat() {
    const currentTimestamp = Date.now();
    lastHeartbeatTimestamp = currentTimestamp;

    try {
        // Send the heartbeat to the central server
        await axios.post(centralServerURL, {
            timestamp: currentTimestamp,
            ipAddress: "http://localhost:4000"
        }, {
            timeout: 5000 // Set a timeout of 5 seconds (adjust as needed)
        });
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

// Create a get request to /
app.get('/', (req, res) => {
  res.send('Hello from server 1!');
});

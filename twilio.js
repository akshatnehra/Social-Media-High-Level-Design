// Use dot env
require('dotenv').config();

function sendSMS(message) {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const client = require('twilio')(accountSid, authToken);

  client.messages
    .create({
      body: message,
      from: '+12677444856',
      to: '+12269610954'
    })
    .then(message => console.log("Message Sent and its id: " + message.sid));
}

module.exports = sendSMS;
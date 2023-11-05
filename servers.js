const express = require('express');

// Create the first Express app
const app1 = express();
const port1 = 4000;

// Server 1 
app1.get('/', (req, res) => {
  res.send('Server 1 is running on port ' + port1);
});

app1.listen(port1, () => {
  console.log('Server 1 is listening on port ' + port1);
});

// Server 2
const app2 = express();
const port2 = 5000;

app2.get('/', (req, res) => {
  res.send('Server 2 is running on port ' + port2);
});

app2.listen(port2, () => {
  console.log('Server 2 is listening on port ' + port2);
});

// Server 3
const app3 = express();
const port3 = 6000;

app3.get('/', (req, res) => {
    res.send('Server 3 is running on port ' + port3);
});

app3.listen(port3, () => {
    console.log('Server 3 is listening on port ' + port3);
    }
);

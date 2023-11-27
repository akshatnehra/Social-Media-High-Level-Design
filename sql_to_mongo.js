const mysql = require('mysql2/promise');
const mongoose = require('mongoose');

// Define Mongoose schema
const userSchema = new mongoose.Schema({
  userID: { type: Number, required: true },
  username: { type: String, required: true },
  email: { type: String, required: true },
  password: { type: String, required: true },
  mongodbUserID: { type: String },
});

const User = mongoose.model('User', userSchema);

async function migrateData() {
  try {
    // Connect to MySQL
    const mysqlConnection = await mysql.createConnection({
      host: 'localhost',
      port: 3306,
      user: 'root',
      password: '',
      database: 'social_media',
    });

    // Connect to MongoDB
    const mongoURL = 'mongodb://127.0.0.1:27017/social_media_migrated';
    await mongoose.connect(mongoURL);

    // Fetch data from MySQL
    const [rows] = await mysqlConnection.query('SELECT * FROM users');

    // Transform and insert data into MongoDB using Mongoose
    for (const row of rows) {
      const { userID, username, email, password, mongodbUserID } = row;

      // Transform data if needed
      const transformedUser = {
        userID,
        username,
        email,
        password,
        mongodbUserID,
      };

      // Print transformed data
        console.log(transformedUser);

      // Insert into MongoDB using Mongoose
      await User.create(transformedUser);
    }

    console.log('Data migration successful');
  } catch (error) {
    console.error('Error:', error);
  } finally {
    // Close connections
    await mongoose.disconnect();
  }
}

migrateData();

const { MongoClient } = require('mongodb');
const mysql = require('mysql2/promise');

const mongoURL = 'mongodb://127.0.0.1:27017';
const mysqlConfig = {
  host: 'localhost',
  port: 3306,
  user: 'root',
  password: '',
};

async function migrateData() {
  let mongoClient;
  let mysqlConnection;

  try {
    // Connect to MongoDB
    mongoClient = await MongoClient.connect(mongoURL, { useNewUrlParser: true, useUnifiedTopology: true });
    const mongoDB = mongoClient.db('social_media');

    // Print all collections in MongoDB
    const collections = await mongoDB.listCollections().toArray();
    console.log('MongoDB collections:', collections);

    // Connect to MySQL
    mysqlConnection = await mysql.createConnection(mysqlConfig);

    // Create MySQL database if not exists
    await mysqlConnection.execute('CREATE DATABASE IF NOT EXISTS social_media_migrated');
    await mysqlConnection.changeUser({ database: 'social_media_migrated' });

    // Create MySQL table if not exists
    await mysqlConnection.execute(`
      CREATE TABLE IF NOT EXISTS User_Data (
        userID INT PRIMARY KEY,
        city VARCHAR(255),
        country VARCHAR(255),
        bio TEXT,
        dateOfBirth DATE,
        interests TEXT,
        posts TEXT
      )
    `);

    // Fetch data from MongoDB from User_Data collection
    const mongoData = await mongoDB.collection('User_Data').find().toArray();
    console.log('MongoDB data:', mongoData);

    // Transform and insert data into MySQL
    for (const userData of mongoData) {
        const { userID, profileDetails, posts } = userData;
    
        // Transform data if needed
        const transformedUser = {
        userID,
        city: profileDetails.city,
        country: profileDetails.country,
        bio: profileDetails.bio,
        dateOfBirth: profileDetails.dateOfBirth,
        interests: profileDetails.interests.join(','), // Convert array to comma-separated string
        posts,
        };
    
        // Convert the object into an array of values
        const values = Object.values(transformedUser);
    
        // Print transformed data
        console.log('Transformed data:', transformedUser);
    
        // Insert into MySQL
        await mysqlConnection.execute('INSERT INTO User_Data (userID, city, country, bio, dateOfBirth, interests, posts) VALUES (?, ?, ?, ?, ?, ?, ?)', values);
    }

    console.log('Data migration from MongoDB to MySQL successful');
  } catch (error) {
    console.error('Error:', error);
  } finally {
    // Close connections
    if (mongoClient) await mongoClient.close();
    if (mysqlConnection) await mysqlConnection.end();
  }
}

migrateData();

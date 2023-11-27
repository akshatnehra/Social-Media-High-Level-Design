const mysql = require('mysql2/promise');
const { MongoClient } = require('mongodb');
const neo4j = require('neo4j-driver');
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const debug = require('debug');
// Suppress deprecation warnings for faker
debug.disable('@faker-js/faker:address');
debug.disable('@faker-js/faker:random.word');

const { faker } = require('@faker-js/faker');

const numUsers = process.argv[2] ? parseInt(process.argv[2], 10) : 1; // Number of users from command line argument
const limitForFriends = 50; // Limit for number of friends per user
const maxFriendsLimit = limitForFriends<=numUsers/2 ? limitForFriends : numUsers/2; // Maximum number of friends per user

var mysqlConnection;
var mysqlConnection2;
var mysqlConnection3;
var mongoClient;
var neo4jDriver;
var neo4jSession;

// Function to clear all databases
async function clearAllDatabases() {
    await mysqlConnection.execute('DROP TABLE IF EXISTS Users');
    await mysqlConnection2.execute('DROP TABLE IF EXISTS Users');
    await mysqlConnection3.execute('DROP TABLE IF EXISTS Users');
    console.log('MySQL cleared');
    
    // await neo4jSession.run('MATCH (n) DETACH DELETE n');
    // console.log('Neo4j cleared');

    // List all collections in MongoDB currently I have mongoClient that has mongoose.connection
    // const collections = await mongoClient.db().listCollections().toArray();
}

async function connectMySql() {
    // Create the connection
    mysqlConnection = await mysql.createConnection({
        host: 'localhost',
        port: 3306,
        user: 'root',
        password: '',
        database: 'social_media'
    });

    // Create the connection
    mysqlConnection2 = await mysql.createConnection({
        host: 'localhost',
        port: 3306,
        user: 'root',
        password: '',
        database: 'social_media_rc1'
    });

    // Create the connection
    mysqlConnection3 = await mysql.createConnection({
        host: 'localhost',
        port: 3306,
        user: 'root',
        password: '',
        database: 'social_media_rc2'
    });

    // Connect to the database
    await mysqlConnection.connect();

    // Log the connection status
    console.log(`MySQL social_media connected`);

    // Connect to the database
    await mysqlConnection2.connect();

    // Log the connection status
    console.log(`MySQL social_media_rc1 connected`);

    // Connect to the database
    await mysqlConnection3.connect();

    // Log the connection status
    console.log(`MySQL social_media_rc2 connected`);
}

async function connectMongo() {
    const mongoURL = 'mongodb://127.0.0.1:27017/social_media';

    // Connect to MongoDB
    await mongoose.connect(mongoURL);

    const db = mongoose.connection;


    console.log('MongoDB connected');
    return db;
}

async function createUserSchema() {
    try {
        // Create Users table
        await mysqlConnection.execute(`
            CREATE TABLE IF NOT EXISTS Users (
                userID INT AUTO_INCREMENT PRIMARY KEY,
                username VARCHAR(255) NOT NULL,
                email VARCHAR(255) NOT NULL,
                password VARCHAR(255) NOT NULL,
                mongodbUserID VARCHAR(255),
                UNIQUE KEY unique_username (username),
                UNIQUE KEY unique_email (email)
            )
        `);

        // Create Users table
        await mysqlConnection2.execute(`
            CREATE TABLE IF NOT EXISTS Users (
                userID INT AUTO_INCREMENT PRIMARY KEY,
                username VARCHAR(255) NOT NULL,
                email VARCHAR(255) NOT NULL,
                password VARCHAR(255) NOT NULL,
                mongodbUserID VARCHAR(255),
                UNIQUE KEY unique_username (username),
                UNIQUE KEY unique_email (email)
            )
        `);

        // Create Users table
        await mysqlConnection3.execute(`
            CREATE TABLE IF NOT EXISTS Users (
                userID INT AUTO_INCREMENT PRIMARY KEY,
                username VARCHAR(255) NOT NULL,
                email VARCHAR(255) NOT NULL,
                password VARCHAR(255) NOT NULL,
                mongodbUserID VARCHAR(255),
                UNIQUE KEY unique_username (username),
                UNIQUE KEY unique_email (email)
            )
        `);

        console.log('MySQL User schema created successfully');

    } catch (error) {
        console.error('Error creating MySQL User schema:', error);
    } 
}

async function main() {
    try {
        await connectMySql();
        mongoClient = await connectMongo();
        neo4jDriver = neo4j.driver('neo4j+s://8b927876.databases.neo4j.io', neo4j.auth.basic('neo4j', 'jgxRGMWS6loV6QSBW_56afaXESc9uTm5-iJbzVxIlxE'));
        neo4jSession = neo4jDriver.session();
        console.log(`Neo4j connected`);

        // Clear all databases
        await clearAllDatabases();

        // Create MySQL schema
        await createUserSchema();

        for (let i = 0; i < numUsers; i++) {
            // Step 1: Create user in MySQL
            const username = faker.internet.userName();
            const email = faker.internet.email();
            const password = faker.internet.password();
            const userID = await createUserInMySQL(username, email, password);

            // Step 2: Get userID from MySQL
            const retrievedUserID = await getUserIDFromMySQL(username);

            // Steps 3-4: Create entry in MongoDB and update mongodbUserID in MySQL
            const mongodbUserID = await createMongoDBEntry(retrievedUserID);
            await updateMongoDBUserIDInMySQL(retrievedUserID, mongodbUserID);

            // Step 5: Insert User_Node into Neo4j
            await insertUserNodeIntoNeo4j(retrievedUserID, username);

            // Step 6: Create random friend relations in Neo4j

            // Random number of friends per user
            const numFriends = Math.floor(Math.random() * (maxFriendsLimit + 1)); // Random number of friends
            for (let j = 0; j < numFriends; j++) {
                const friendUserID = await getRandomUserIDFromMySQL(userID); // Get a random user from MySQL as a friend

                // Check if the friendUserID is null
                if (friendUserID === null) {
                    continue;
                }

                // Check if the friend relationship already exists in Neo4j
                const result = await neo4jSession.run(
                    `MATCH (u1:User_Node {userID: ${userID}})-[r:Follows]->(u2:User_Node {userID: ${friendUserID}}) ` +
                    `RETURN r`
                );

                if (result.records.length > 0) {
                    continue; // Friend relationship already exists
                }
                
                // Create friend relationship in Neo4j
                await createRandomFriendRelations(userID, friendUserID);
            }
        }

    } catch (error) {
        console.error(error);
    } finally {
        // Close connections
        await mysqlConnection.end();
        await mongoClient.close();
        await neo4jSession.close();
        neo4jDriver.close();
    }
}

async function createUserInMySQL(username, email, password) {
    const hashedPassword = await hashPassword(password); // Hash the password

    const [rows, fields] = await mysqlConnection.execute(
        'INSERT INTO Users (username, email, password) VALUES (?, ?, ?)',
        [username, email, hashedPassword]
    );

    // Execute the query for social_media_rc1
    const [rows2, fields2] = await mysqlConnection2.execute(
        'INSERT INTO Users (username, email, password) VALUES (?, ?, ?)',
        [username, email, hashedPassword]
    );

    // Execute the query for social_media_rc2
    const [rows3, fields3] = await mysqlConnection3.execute(
        'INSERT INTO Users (username, email, password) VALUES (?, ?, ?)',
        [username, email, hashedPassword]
    );

    return rows.insertId; // Return the auto-generated userID
}

async function getUserIDFromMySQL(username) {
    const [rows, fields] = await mysqlConnection.execute(
        'SELECT userID FROM Users WHERE username = ?',
        [username]
    );

    if (rows.length > 0) {
        return rows[0].userID;
    }

    return null; // User not found
}

async function createMongoDBEntry(userID) {
    const profileDetails = generateRandomProfileDetails(); // Generate random profile details

    const userDoc = {
        userID: userID,
        profileDetails: profileDetails,
        posts: '',
    };

    const result = await mongoClient.collection('User_Data').insertOne(userDoc);

    return result.insertedId;
}

async function updateMongoDBUserIDInMySQL(userID, mongodbUserID) {
    console.log(`Updating mongodbUserID for userID ${userID} to ${mongodbUserID}`);
    await mysqlConnection.execute(
        `UPDATE Users SET mongodbUserID = '${mongodbUserID}' WHERE userID = '${userID}'`
    );
}

async function insertUserNodeIntoNeo4j(userID, username) {
    await neo4jSession.run(
        'CREATE (u:User_Node {userID: $userID, username: $username})',
        { userID: userID, username: username }
    );
}

async function createRandomFriendRelations(userID, friendUserID) {
    await neo4jSession.run(
        'MATCH (u1:User_Node {userID: $userID}), (u2:User_Node {userID: $friendUserID}) ' +
        'CREATE (u1)-[:Follows]->(u2)',
        { userID: userID, friendUserID: friendUserID }
    );

    // Create bidirectional relationship
    await neo4jSession.run(
        'MATCH (u1:User_Node {userID: $userID}), (u2:User_Node {userID: $friendUserID}) ' +
        'CREATE (u1)-[:Follows]->(u2)',
        { userID: friendUserID, friendUserID: userID }
    );
}

async function getRandomUserIDFromMySQL(excludeUserID) {
    const [rows, fields] = await mysqlConnection.execute(
        'SELECT userID FROM Users WHERE userID <> ? ORDER BY RAND() LIMIT 1',
        [excludeUserID]
    );

    if (rows.length > 0) {
        return rows[0].userID;
    }

    return null; // No other users found
}

// Function to hash passwords using bcrypt
async function hashPassword(password) {
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(password, saltRounds);
    return hashedPassword;
}

// Function to generate random profile details
function generateRandomProfileDetails() {
    return {
        city: faker.address.city(),
        country: faker.address.country(),
        bio: faker.lorem.sentence(),
        dateOfBirth: faker.date.past(),
        interests: Array.from({ length: 3 }, () => faker.random.word()), // Generate an array of 3 random words as interests
    };
}

main();
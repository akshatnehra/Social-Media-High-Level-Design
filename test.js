const connectRedis = async () => {
    // Create Redis client
    const client = createClient({
        password: 'm22BEoM1Gpa9s2boSDcQlX51IctLKWOA',
        socket: {
            host: 'redis-11604.c321.us-east-1-2.ec2.cloud.redislabs.com',
            port: 11604
        }
    });

    await client.connect();
    console.log('Redis connected');
}

connectRedis();

// Set data in Redis
const setData = async (key, value) => {
    await client.set(key, value);
}

// Set data in Redis 
setData('name', 'John Doe');
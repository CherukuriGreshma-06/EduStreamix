require('dotenv').config();
const mongoose = require('mongoose');

async function testAtlasConnection() {
    console.log('Attempting to connect to MongoDB Atlas...');
    console.log('URI:', process.env.MONGO_URI.replace(/:([^@]+)@/, ':****@')); // Hide password in logs

    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log('\n✅ SUCCESS: Connection to MongoDB Atlas established!');
        console.log('Your database is now accessible from this machine.');
        
        // Check for collections
        const collections = await mongoose.connection.db.listCollections().toArray();
        console.log(`Found ${collections.length} collections.`);
        
        await mongoose.disconnect();
        process.exit(0);
    } catch (err) {
        console.error('\n❌ CONNECTION FAILED!');
        console.error('Error:', err.message);
        console.log('\nPossible causes:');
        console.log('1. Your current IP address is not whitelisted in Atlas.');
        console.log('2. The password in your .env file is incorrect.');
        console.log('3. Your firewall or ISP is blocking the connection.');
        process.exit(1);
    }
}

testAtlasConnection();

const mongoose = require('mongoose');

// ==========================================
// CONFIGURATION
// ==========================================
const LOCAL_URI = 'mongodb://127.0.0.1:27017/EduStreamX';

// TODO: Paste your MongoDB Atlas Connection String here
// Example: 'mongodb+srv://<username>:<password>@cluster0.xxxxx.mongodb.net/EduStreamX'
const ATLAS_URI = 'mongodb://greshma:greshma25@ac-qr9jlcr-shard-00-00.ige3uf5.mongodb.net:27017,ac-qr9jlcr-shard-00-01.ige3uf5.mongodb.net:27017,ac-qr9jlcr-shard-00-02.ige3uf5.mongodb.net:27017/EduStreamX?ssl=true&replicaSet=atlas-2qr7ei-shard-0&authSource=admin&retryWrites=true&w=majority&appName=EduStreamix';

async function migrateDatabase() {
    if (ATLAS_URI === 'YOUR_ATLAS_CONNECTION_STRING_HERE') {
        console.error('\n❌ ERROR: Please replace YOUR_ATLAS_CONNECTION_STRING_HERE with your actual MongoDB Atlas connection string in migrateDB.js\n');
        process.exit(1);
    }

    let localConnection;
    let atlasConnection;

    try {
        console.log('Connecting to local database...');
        localConnection = await mongoose.createConnection(LOCAL_URI).asPromise();
        console.log('✅ Connected to local database');

        console.log('Connecting to Atlas database...');
        atlasConnection = await mongoose.createConnection(ATLAS_URI).asPromise();
        console.log('✅ Connected to Atlas database');

        // Get all collections from the local database
        const collections = await localConnection.db.listCollections().toArray();

        for (let collection of collections) {
            const collectionName = collection.name;
            console.log(`\n📦 Processing collection: ${collectionName}`);

            // Fetch all documents from the local collection
            const documents = await localConnection.db.collection(collectionName).find({}).toArray();
            console.log(`Found ${documents.length} documents in local collection`);

            if (documents.length > 0) {
                // Drop the atlas collection if it exists to start fresh (optional, but good for exact copies)
                try {
                    await atlasConnection.db.collection(collectionName).drop();
                    console.log(`Cleared existing collection in Atlas: ${collectionName}`);
                } catch (e) {
                    // Ignore error if collection doesn't exist
                }

                // Insert documents into Atlas
                await atlasConnection.db.collection(collectionName).insertMany(documents);
                console.log(`✅ Successfully copied ${documents.length} documents to Atlas collection: ${collectionName}`);
            } else {
                console.log(`Skipped empty collection: ${collectionName}`);
            }
        }

        console.log('\n🎉 Database migration completed successfully!');

    } catch (error) {
        console.error('\n❌ Migration failed:', error);
    } finally {
        if (localConnection) await localConnection.close();
        if (atlasConnection) await atlasConnection.close();
        process.exit(0);
    }
}

migrateDatabase();

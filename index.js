const dns = require("node:dns");
dns.setServers(["8.8.8.8", "8.8.4.4"]);

const express = require('express')
const cors = require('cors');
const dotenv=require('dotenv')
const { MongoClient, ServerApiVersion } = require('mongodb');
dotenv.config()
const app = express()
const port = process.env.SERVER_PORT ||8000
const uri =process.env.MONGODB_URI;
app.use(cors());
app.use(express.json());

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});



async function run() {
  try {
    
    const database = client.db("drivefleet_db");
    const carsCollection = database.collection("cars");

    console.log("Successfully connected to MongoDB!");

    //  API (Explore Cars Page )
    app.get('/cars', async (req, res) => {
      try {
        const cursor = carsCollection.find({});
        const result = await cursor.toArray();
        res.send(result);
      } catch (error) {
        res.status(500).send({ message: "Data fetch problem" });
      }
    });

  } catch (error) {
    console.error("Database connection error:", error);
  }
  
}
run().catch(console.dir);

app.get('/', (req, res) => {
  res.send('DriveFleet Server is running');
});

app.listen(port, () => {
  console.log(`Server listening on port ${port}`);
});
const dns = require("node:dns");
dns.setServers(["8.8.8.8", "8.8.4.4"]);

const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const { createRemoteJWKSet, jwtVerify } = require("jose-cjs");

dotenv.config();
const app = express();
const port = process.env.SERVER_PORT || 8000;

const uri = process.env.MONGODB_URI;
app.use(
  cors({
    origin: ["http://localhost:3000", process.env.CLIENT_URL],
    credentials: true,
  }),
);

app.use(express.json());
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});


// Better Auth JWKS


const JWKS = createRemoteJWKSet(
  new URL(`${process.env.CLIENT_URL}/api/auth/jwks`),
);


// Verify Token Middleware


const verifyToken = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader) {
      return res.status(401).json({
        message: "Unauthorized",
      });
    }

    const token = authHeader.split(" ")[1];

    if (!token) {
      return res.status(401).json({
        message: "Unauthorized",
      });
    }

    const { payload } = await jwtVerify(token, JWKS, {
      issuer: process.env.CLIENT_URL,
    });

    req.user = payload;

    next();
  } catch (error) {
    console.log("JWT VERIFY ERROR =>", error);

    return res.status(403).json({
      message: "Forbidden",
      error: error.message,
    });
  }
};


async function run() {
  try {
    const database = client.db("drivefleet_db");

    const carsCollection = database.collection("cars");

    const bookingsCollection = database.collection("bookings");

    console.log("Successfully connected to MongoDB!");

    app.get("/cars", async (req, res) => {
      const limit = parseInt(req.query.limit);

      let cursor = carsCollection.find({});

      if (limit) {
        cursor = cursor.limit(limit);
      }

      const result = await cursor.toArray();

      res.send(result);
    });


    app.get("/cars/:id", verifyToken, async (req, res) => {
      try {
        const result = await carsCollection.findOne({
          _id: new ObjectId(req.params.id),
        });

        if (!result) {
          return res.status(404).send({
            message: "Car not found",
          });
        }

        res.send(result);
      } catch (error) {
        res.status(500).send({
          message: "Server Error",
        });
      }
    });

    app.post("/cars", verifyToken, async (req, res) => {
      try {
        const newCar = req.body;

        if (!newCar.carName || !newCar.pricePerDay || !newCar.carType) {
          return res.status(400).send({
            message: "Required fields are missing!",
          });
        }

        const carData = {
          ...newCar,

          pricePerDay: parseFloat(newCar.pricePerDay),

          seats: parseInt(newCar.seats) || 4,

          isAvailable: true,

          createdAt: new Date(),

          createdBy: req.user.email,
        };

        const result = await carsCollection.insertOne(carData);

        res.status(201).send({
          success: true,
          message: "Car added successfully!",
          result,
        });
      } catch (error) {
        console.log(error);

        res.status(500).send({
          message: "Server Error",
        });
      }
    });

  
    app.post("/bookings", verifyToken, async (req, res) => {
      try {
        const bookingInfo = req.body;

        if (!bookingInfo.carId || !bookingInfo.bookedByEmail) {
          return res.status(400).send({
            message: "Missing required booking information!",
          });
        }

        const result = await bookingsCollection.insertOne(bookingInfo);

        res.status(201).send({
          success: true,
          message: "Booking saved!",
          result,
        });
      } catch (error) {
        res.status(500).send({
          message: "Server Error",
          error: error.message,
        });
      }
    });


    app.get("/bookings", verifyToken, async (req, res) => {
      try {
        const email = req.query.email;

        if (!email) {
          return res.status(400).send({
            message: "User email is required!",
          });
        }

       
        if (req.user.email !== email) {
          return res.status(403).send({
            message: "Forbidden Access",
          });
        }

        const query = {
          bookedByEmail: email,
        };

        const result = await bookingsCollection.find(query).toArray();

        res.send(result);
      } catch (error) {
        res.status(500).send({
          message: "Server Error",
        });
      }
    });

    app.delete("/bookings/:id", verifyToken, async (req, res) => {
      try {
        const id = req.params.id;

        const booking = await bookingsCollection.findOne({
          _id: new ObjectId(id),
        });

        if (!booking) {
          return res.status(404).send({
            message: "Booking not found",
          });
        }

       
        if (booking.bookedByEmail !== req.user.email) {
          return res.status(403).send({
            message: "Forbidden Access",
          });
        }

        const result = await bookingsCollection.deleteOne({
          _id: new ObjectId(id),
        });

        if (result.deletedCount === 1) {
          res.send({
            success: true,
            message: "Booking cancelled successfully!",
          });
        } else {
          res.status(404).send({
            message: "No booking found with this ID",
          });
        }
      } catch (error) {
        res.status(500).send({
          message: "Server Error",
        });
      }
    });
  } catch (error) {
    console.error("MongoDB connection failed:", error);
  }
}

run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("DriveFleet Server is running...");
});
app.listen(port, () => {
  console.log(`DriveFleet listening on port ${port}`);
});

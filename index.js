const express = require("express");
const { MongoClient } = require("mongodb");
const cors = require("cors");

const app = express();
const PORT = 3000;
const MONGO_URI =
  "mongodb+srv://magicDB:r0DZphRYovNPylxM@cluster0.tx9lkv1.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0";
const DB_NAME = "eventsDB";

app.use(cors());
app.use(express.json());

let db;
MongoClient.connect(MONGO_URI, { useUnifiedTopology: true })
  .then((client) => {
    console.log("Connected to MongoDB");
    db = client.db(DB_NAME);
  })
  .catch((err) => console.error("MongoDB connection failed:", err));

app.get("/", (req, res) => {
  res.send("Hello, World!");
});

app.post("/api/events", async (req, res) => {
  const {
    title,
    description,
    eventType,
    thumbnailUrl,
    location,
    eventDate,
    createdBy,
  } = req.body;

  app.get("/api/events/upcoming", async (req, res) => {
    try {
      const now = new Date();

      const upcomingEvents = await db
        .collection("events")
        .find({ eventDate: { $gte: now } }) // Filter only future events
        .sort({ eventDate: 1 }) // Sort by soonest first
        .toArray();

      res.status(200).json(upcomingEvents);
    } catch (error) {
      console.error("Error fetching upcoming events:", error);
      res.status(500).json({ message: "Failed to fetch events." });
    }
  });

  if (
    !title ||
    !description ||
    !eventType ||
    !thumbnailUrl ||
    !location ||
    !eventDate ||
    !createdBy
  ) {
    return res.status(400).json({ message: "All fields are required." });
  }

  const eventDateObj = new Date(eventDate);
  const now = new Date();
  if (isNaN(eventDateObj.getTime())) {
    return res.status(400).json({ message: "Invalid date format." });
  }
  if (eventDateObj <= now) {
    return res
      .status(400)
      .json({ message: "Event date must be in the future." });
  }

  const newEvent = {
    title,
    description,
    eventType,
    thumbnailUrl,
    location,
    eventDate: eventDateObj,
    createdBy,
    createdAt: new Date(),
  };

  try {
    const result = await db.collection("events").insertOne(newEvent);
    if (result.insertedId) {
      res.status(201).json({ message: "Event created successfully." });
    } else {
      res.status(500).json({ message: "Failed to create event." });
    }
  } catch (error) {
    console.error("Error inserting event:", error);
    res.status(500).json({ message: "Internal server error." });
  }
});

app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});

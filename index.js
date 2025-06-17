const express = require("express");
const { MongoClient } = require("mongodb");
const { ObjectId } = require("mongodb");
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

    app.listen(PORT, () => {
      console.log(`Server is running on http://localhost:${PORT}`);
    });
  })
  .catch((err) => console.error("MongoDB connection failed:", err));

// Default route
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

app.get("/api/events/upcoming", async (req, res) => {
  const now = new Date();
  const upcomingEvents = await db
    .collection("events")
    .find({ eventDate: { $gt: now } })
    .sort({ eventDate: 1 })
    .toArray();

  res.json(upcomingEvents);
});

app.post("/api/join-event", async (req, res) => {
  const { eventId, name, email } = req.body;

  if (!eventId || !name || !email) {
    return res.status(400).json({ message: "Missing fields" });
  }

  if (!ObjectId.isValid(eventId)) {
    return res.status(400).json({ message: "Invalid event ID" });
  }

  try {
    const joinData = {
      eventId: new ObjectId(eventId),
      name,
      email,
      joinedAt: new Date(),
    };

    await db.collection("event_joins").insertOne(joinData);

    res.status(200).json({ message: "Join successful" });
  } catch (err) {
    console.error("Join event error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

app.get("/api/events/:id", async (req, res) => {
  const { id } = req.params;

  if (!ObjectId.isValid(id)) {
    return res.status(400).json({ message: "Invalid event ID" });
  }

  try {
    const event = await db
      .collection("events")
      .findOne({ _id: new ObjectId(id) });
    if (!event) {
      return res.status(404).json({ message: "Event not found" });
    }
    res.json(event);
  } catch (err) {
    console.error("Error fetching event:", err);
    res.status(500).json({ message: "Server error" });
  }
});

app.get("/api/joined-events", async (req, res) => {
  const userEmail = req.query.email;

  if (!userEmail) {
    return res.status(400).json({ message: "Email is required" });
  }

  try {
    const joinedRecords = await db
      .collection("event_joins")
      .find({ email: userEmail })
      .toArray();

    const eventIds = joinedRecords.map((j) => j.eventId);

    if (!eventIds.length) {
      return res.status(200).json([]);
    }

    const joinedEvents = await db
      .collection("events")
      .find({ _id: { $in: eventIds } })
      .sort({ eventDate: 1 })
      .toArray();

    res.status(200).json(joinedEvents);
  } catch (error) {
    console.error("Error fetching joined events:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

app.get("/api/events", async (req, res) => {
  const createdBy = req.query.createdBy;
  if (!createdBy) {
    return res
      .status(400)
      .json({ message: "createdBy query parameter is required" });
  }

  try {
    const events = await db
      .collection("events")
      .find({ createdBy: createdBy })
      .sort({ eventDate: 1 })
      .toArray();

    res.json(events);
  } catch (err) {
    console.error("Error fetching events:", err);
    res.status(500).json({ message: "Internal server error" });
  }
});

app.put("/api/events/:id", async (req, res) => {
  const { id } = req.params;

  if (!ObjectId.isValid(id)) {
    return res.status(400).json({ message: "Invalid event ID" });
  }

  const { title, description, eventType, thumbnailUrl, location, eventDate } =
    req.body;

  if (!title || !eventDate) {
    return res
      .status(400)
      .json({ message: "Title and eventDate are required." });
  }

  const eventDateObj = new Date(eventDate);
  if (isNaN(eventDateObj.getTime())) {
    return res.status(400).json({ message: "Invalid date format." });
  }

  try {
    const result = await db.collection("events").findOneAndUpdate(
      { _id: new ObjectId(id) },
      {
        $set: {
          title,
          description,
          eventType,
          thumbnailUrl,
          location,
          eventDate: eventDateObj,
        },
      },
      { returnDocument: "after" }
    );

    if (!result.value) {
      return res.status(404).json({ message: "Event not found." });
    }

    res.status(200).json(result.value);
  } catch (error) {
    console.error("Error updating event:", error);
    res.status(500).json({ message: "Internal server error." });
  }
});

app.delete("/api/events/:id", async (req, res) => {
  const { id } = req.params;

  if (!ObjectId.isValid(id)) {
    return res.status(400).json({ message: "Invalid event ID" });
  }

  try {
    const result = await db
      .collection("events")
      .deleteOne({ _id: new ObjectId(id) });

    if (result.deletedCount === 0) {
      return res.status(404).json({ message: "Event not found" });
    }

    res.status(200).json({ message: "Event deleted successfully" });
  } catch (error) {
    console.error("Error deleting event:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

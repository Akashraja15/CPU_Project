// Load environment variables from .env
require("dotenv").config();

const express = require("express");
const mongoose = require("mongoose");
const os = require("os");
const app = express();

app.use(express.json());

mongoose
  .connect(process.env.MONGO_URI)
  .then(() => {
    console.log("MongoDB Atlas connected successfully");
  })
  .catch((err) => {
    console.error("MongoDB Atlas connection error:", err);
  });


const messageSchema = new mongoose.Schema({

  message: {
    type: String,
    required: true
  },
  scheduledAt: {
    type: Date,
    required: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

const Message = mongoose.model("Message", messageSchema);


function getCPUUsage() {

  const cpus = os.cpus();
  let idle = 0;
  let total = 0;


  cpus.forEach((cpu) => {
    idle += cpu.times.idle;

    total +=
      cpu.times.user +
      cpu.times.nice +
      cpu.times.sys +
      cpu.times.irq +
      cpu.times.idle;
  });


  return {
    idle,
    total
  };
}

function calculateCPUUsage(previous, current) {
  const idleDifference = current.idle - previous.idle;
  const totalDifference = current.total - previous.total;
  const idlePercentage = (idleDifference / totalDifference) * 100;
  const cpuUsage = 100 - idlePercentage;
  return cpuUsage;
}

let previousCPU = getCPUUsage();

setInterval(() => {
  const currentCPU = getCPUUsage();
  const cpuUsage = calculateCPUUsage(
    previousCPU,
    currentCPU
  );
  previousCPU = currentCPU;
  console.log(`CPU Usage: ${cpuUsage.toFixed(2)}%`);

  if (cpuUsage >= 70) {
    console.log("CPU usage is above 70%. Restarting server...");
    process.exit(1);
  }
}, 5000);


app.post("/messages", async (req, res) => {
  try {
    const {
      message,
      day,
      time
    } = req.body;

    if (!message || !day || !time) {
      return res.status(400).json({
        message:
          "message, day and time are required"
      });
    }

    const scheduledDate =
      new Date(`${day}T${time}`);

    if (isNaN(scheduledDate.getTime())) {
      return res.status(400).json({
        message:
          "Invalid day or time"
      });
    }

    const now = new Date();
    if (scheduledDate <= now) {
      return res.status(400).json({
        message:
          "Scheduled time must be in the future"
      });
    }

    const delay =
      scheduledDate.getTime() -
      now.getTime();

    console.log(`Message scheduled for: ${scheduledDate}`);

    setTimeout(async () => {
      try {
        const newMessage =
          await Message.create({
            message: message,
            scheduledAt: scheduledDate
          });
        console.log("Message inserted into MongoDB Atlas:");
        console.log(newMessage);
      } catch (error) {
        console.error("Failed to insert message:", error);
      }
    }, delay);

    res.status(201).json({
      message:
        "Message scheduled successfully",
      scheduledAt:
        scheduledDate
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      message:
        "Internal server error"
    });
  }
});

app.get("/messages", async (req, res) => {
  try {
    const messages =
      await Message.find()
        .sort({
          scheduledAt: 1
        });
    res.json(messages);
  } catch (error) {
    console.error(error);
    res.status(500).json({
      message:
        "Failed to fetch messages"
    });
  }
});

const PORT = 3000;
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
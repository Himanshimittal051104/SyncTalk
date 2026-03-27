const express = require("express"); // create backend server
const http = require("http"); // needed because socket.io works on http server not directly on express
const { Server } = require("socket.io"); // enables real time communication
const cors = require("cors"); // allows frontend (different port) to call backend
const mongoose = require("mongoose"); //connects backend with mongodb
const Message = require("./models/Message"); // needed to store chat messages in db
const messageRoutes = require("./routes/message"); // handles chat history api
const authRoutes = require("./routes/auth");
require("dotenv").config(); // loads .env file 

//app setup
const app = express(); // main backend app
app.use(cors()); // allows frontend request
app.use(express.json()); //parse json body

//routes
app.use("/api/messages", messageRoutes);
app.use("/api/auth", authRoutes);

// create http server
const server = http.createServer(app);

// Socket setup
const io = new Server(server, {
  cors: {
    origin: "*",
  },
});// initializes real time server

//mongodb connection
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log("MongoDB connected"))
  .catch(err => console.log(err));

// Test route
app.get("/", (req, res) => {
  res.send("SyncTalk backend running");
});

const authMiddleware = require("./middleware/authMiddleware");

app.get("/protected", authMiddleware, (req, res) => {
  res.json({
    message: "Protected route accessed",
    user: req.user,
  });
});

let onlineUsers = {};
// Socket logic (basic)
io.on("connection", (socket) => {
  console.log("User connected:", socket.id);

  // Register user
  socket.on("register", (userId) => {
    onlineUsers[userId] = socket.id;
    console.log("Online users:", onlineUsers);
  });

  // Send message
  socket.on("send_message", async (data) => {
    const { senderId, receiverId, message } = data;

    try {
      // Save to MongoDB
      const newMessage = await Message.create({
        senderId,
        receiverId,
        message,
      });

      const receiverSocketId = onlineUsers[receiverId];

      // Send to receiver
      if (receiverSocketId) {
        io.to(receiverSocketId).emit("receive_message", newMessage);
      }

      // Send back to sender
      socket.emit("receive_message", newMessage);

    } catch (err) {
      console.log("Error saving message:", err);
    }
  });

  // Disconnect
  socket.on("disconnect", () => {
    for (let userId in onlineUsers) {
      if (onlineUsers[userId] === socket.id) {
        delete onlineUsers[userId];
      }
    }
    console.log("User disconnected:", socket.id);
  });
});

//test api
app.post("/test-message", async (req, res) => {
  const Message = require("./models/Message");

  const { senderId, receiverId, message } = req.body;

  const newMessage = await Message.create({
    senderId,
    receiverId,
    message,
  });

  res.json(newMessage);
});

//start server
server.listen(5000, () => {
  console.log("Server running on port 5000");
});
const express = require("express");
const cors = require("cors");
const { createServer } = require("http");
const path = require("path");
const { Server } = require("socket.io");
const requestIp = require("request-ip");

const app = express();
app.use(cors());

const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: "*" /* had to google it */,
  },
});

io.use((socket, next) => {
  const ip_room = requestIp.getClientIp(socket.request);
  const { deviceName, forced } = socket.handshake.auth;
  if (forced) {
    next();
  } else {
    let room_obj = io.sockets.adapter.rooms.get(ip_room + deviceName);
    if (room_obj != undefined) {
      const err = new Error("same-device");
      next(err);
    } else {
      next();
    }
  }
});

io.on("connection", (socket) => {
  const ip_room = requestIp.getClientIp(socket.request);
  const { deviceName } = socket.handshake.auth;

  socket.join(ip_room);
  socket.join(ip_room + deviceName);

  let room_obj = io.sockets.adapter.rooms.get(ip_room); // list of all the clients

  io.to(ip_room).emit("room-size", room_obj.size); /* googled this too */

  io.to(socket.id).emit("room-members", [
    ...room_obj,
  ]); /* should be manually seralized */

  io.to(ip_room).emit("new-room-member", socket.id);

  socket.on("transfer-offer", (from, to, data) => {
    //console.log(from, to, "offer");
    io.to(to).emit("receive-offer", from, data);
  });

  socket.on("transfer-answer", (from, to, data) => {
    //console.log(from, to, "answer");
    io.to(to).emit("receive-answer", from, data);
  });

  socket.on("transfer-ice", (from, to, data) => {
    //console.log(from, to, "ice");
    io.to(to).emit("receive-ice", from, data);
  });

  socket.on("disconnect", () => {
    let room_obj = io.sockets.adapter.rooms.get(ip_room);
    if (room_obj) {
      io.to(ip_room).emit("room-size", room_obj.size);
      io.to(ip_room).emit("remove-room-member", socket.id);
    }
  });
});

app.get("/", (req, res) => {
  res.send("ok");
});

httpServer.listen(8080);

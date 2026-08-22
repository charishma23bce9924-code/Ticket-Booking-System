let ioInstance = null;

function initSocket(io) {
  ioInstance = io;
  io.on('connection', (socket) => {
    socket.on('joinEvent', (eventId) => {
      socket.join(`event:${eventId}`);
    });
    socket.on('leaveEvent', (eventId) => {
      socket.leave(`event:${eventId}`);
    });
  });
}

// Broadcast a seat status change to everyone viewing that event's seat map
function broadcastSeatUpdate(eventId, showSeat) {
  if (!ioInstance) return;
  ioInstance.to(`event:${eventId}`).emit('seatUpdate', showSeat);
}

module.exports = { initSocket, broadcastSeatUpdate };

const { v4: uuidv4 } = require('uuid');

function generateBookingRef() {
  const rand = uuidv4().split('-')[0].toUpperCase();
  return `BK-${rand}`;
}

function generateToken() {
  return uuidv4();
}

module.exports = { generateBookingRef, generateToken };

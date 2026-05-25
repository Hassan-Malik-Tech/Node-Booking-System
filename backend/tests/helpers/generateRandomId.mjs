import crypto from 'node:crypto';

// Creates 8 random bytes each byte can represent a number from 0 to 255.
// This converts those random bytes into a readable string using hexadecimal.
// Hex means base 16. It uses 16 characters:
// 0 1 2 3 4 5 6 7 8 9 a b c d e f
// Each byte becomes 2 hex characters (8 * 2 = 16).
// It can return a string like 9f2a8c01be44d6aa for example.
function generateRandomId() {
  return crypto.randomBytes(8).toString('hex');
}

export default generateRandomId;

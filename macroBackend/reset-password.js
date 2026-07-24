// One-off utility: resets a specific user's password directly.
// Usage: node reset-password.js <username> <newPassword>
// Example: node reset-password.js test1 NewPass123
const bcrypt = require("bcryptjs");
const pool = require("./db");

async function resetPassword() {
  const username = process.argv[2];
  const newPassword = process.argv[3];

  if (!username || !newPassword) {
    console.error("Usage: node reset-password.js <username> <newPassword>");
    process.exit(1);
  }

  const passwordHash = await bcrypt.hash(newPassword, 10);
  const result = await pool.query(
    "UPDATE users SET password_hash = $1 WHERE username = $2 RETURNING id, username",
    [passwordHash, username]
  );

  if (result.rows.length === 0) {
    console.log(`No user found with username "${username}".`);
  } else {
    console.log(`Password reset for "${username}". You can log in with the new password now.`);
  }
  process.exit(0);
}

resetPassword().catch((err) => {
  console.error(err);
  process.exit(1);
});

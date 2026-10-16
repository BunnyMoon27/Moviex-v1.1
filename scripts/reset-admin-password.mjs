import 'dotenv/config';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { createInterface } from 'node:readline/promises';
import { stdin, stdout } from 'node:process';

function hiddenPrompt(message) {
  if (!stdin.isTTY || typeof stdin.setRawMode !== 'function') throw new Error('Run npm run admin:reset-password in an interactive terminal.');
  return new Promise((resolve, reject) => {
    let value = '';
    stdout.write(message);
    stdin.setRawMode(true);
    stdin.resume();
    stdin.setEncoding('utf8');
    const finish = (error) => {
      stdin.setRawMode(false);
      stdin.pause();
      stdin.off('data', onData);
      stdout.write('\n');
      if (error) reject(error); else resolve(value);
    };
    const onData = (chunk) => {
      for (const char of chunk) {
        if (char === '\u0003') return finish(new Error('Cancelled.'));
        if (char === '\r' || char === '\n') return finish();
        if (char === '\u007f' || char === '\b') {
          if (value.length) { value = value.slice(0, -1); stdout.write('\b \b'); }
        } else if (char >= ' ') {
          value += char;
          stdout.write('*');
        }
      }
    };
    stdin.on('data', onData);
  });
}

async function main() {
  if (!process.env.MONGODB_URI) throw new Error('MONGODB_URI is missing from .env.');
  const prompts = createInterface({ input: stdin, output: stdout });
  const email = (await prompts.question('Administrator email: ')).trim().toLowerCase();
  prompts.close();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) throw new Error('Enter a valid email address.');
  const password = await hiddenPrompt('New password (8+ characters): ');
  const confirmation = await hiddenPrompt('Confirm new password: ');
  if (password.length < 8 || password.length > 128) throw new Error('Password must be 8 to 128 characters.');
  if (password !== confirmation) throw new Error('Passwords do not match.');

  await mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 5000 });
  try {
    const users = mongoose.connection.collection('users');
    const result = await users.updateOne({ email, role: 'admin' }, { $set: { passwordHash: await bcrypt.hash(password, 12), updatedAt: new Date() } });
    if (!result.matchedCount) throw new Error('No administrator found with that email; no changes were made.');
    console.log('Administrator password updated. Sign in at http://127.0.0.1:5173/?access=admin');
  } finally {
    await mongoose.disconnect();
  }
}

main().catch((error) => { console.error(error.message); process.exitCode = 1; });

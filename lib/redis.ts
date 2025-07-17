import { createClient } from "redis";
import dotenv from "dotenv";
dotenv.config();

const { REDIS_HOST, REDIS_PORT, REDIS_USER, REDIS_PASS } = process.env;

if (!REDIS_HOST || !REDIS_PORT || !REDIS_USER || !REDIS_PASS) {
  throw new Error("Missing required Redis environment variables");
}

const redisClient = createClient({
  username: REDIS_USER,
  password: REDIS_PASS,
  socket: {
    host: REDIS_HOST,
    port: parseInt(REDIS_PORT, 10),
  },
});

export default redisClient;

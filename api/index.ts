import dotenv from "dotenv";
dotenv.config();
import express, { Request, Response } from "express";
import lists from "./routes/lists";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import item from "./routes/item";
import prisma from "../lib/prisma";
import mongoClient from "../lib/mongo";
import redisClient from "../lib/redis";
import { requireAuth } from "@clerk/clerk-sdk-node";
import { clerkMiddleware } from "@clerk/express";
import grocery from "./routes/grocery";
const app = express();
app.use(clerkMiddleware());
app.use("/item", item);
app.use("/lists", lists);
app.use("/grocery", grocery);
app.use(express.json());

app.get("/", async function (req: Request, res: Response) {
  res.status(200).json({ message: true });
});

app.get(
  "/test",
  requireAuth((req: any, res: any) => {
    res
      .status(200)
      .json({ message: "this is a test", userId: req.auth?.userId });
  })
);

async function startServer() {
  try {
    await redisClient.connect();
    console.log("Connected to Redis");

    app.listen(3000, () => console.log("Server ready on port 3000."));
  } catch (err) {
    console.error("Failed to connect to Redis:", err);
    process.exit(1);
  }
}

startServer();

module.exports = app;

import dotenv from "dotenv";
dotenv.config();
import express, { Request, Response } from "express";
import lists from "./routes/lists";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import item from "./routes/item";
import prisma from "../lib/prisma";
import mongoClient from "../lib/mongo";
import { requireAuth } from "@clerk/clerk-sdk-node";
import { clerkMiddleware } from "@clerk/express";
const app = express();
app.use(clerkMiddleware());
app.use("/item", item);
app.use("/lists", lists);
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

app.listen(3000, () => console.log("Server ready on port 3000."));

module.exports = app;

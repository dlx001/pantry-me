import dotenv from "dotenv";
dotenv.config();
import express, { Request, Response } from "express";

import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import item from "./routes/item";
import prisma from "../lib/prisma";
const app = express();
app.use("/item", item);

app.use(express.json());

app.get("/", async function (req: Request, res: Response) {
  res.status(200).json({ message: true });
});

app.post("/auth", async function (req: Request, res: Response) {
  const { identifier, password } = req.body;
  try {
    const userMatch = await prisma.user.findFirst({
      where: {
        OR: [{ username: identifier }, { email: identifier }],
      },
    });

    if (!userMatch) {
      res.status(401).json({ message: "User doesn't exist" });
      return;
    }
    const isPasswordValid = await bcrypt.compare(password, userMatch.password);
    if (!isPasswordValid) {
      res.status(401).json({ message: "Username and password don't match" });
      return;
    }

    const token = jwt.sign(
      { userId: userMatch.id, identifier: identifier },
      process.env.JWT_SECRET!,
      { expiresIn: "2m" }
    );

    res.status(200).send({ token });
    return;
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
    return;
  }
});

app.post("/signup", async function (req: Request, res: Response) {
  const { email, password } = req.body;

  try {
    const userMatch = await prisma.user.findFirst({
      where: {
        email: email,
      },
    });

    if (userMatch) {
      res.status(401).json({ message: "User already has an account" });
      return;
    } else {
      const hashedPassword = await bcrypt.hash(password, 10);
      const newUser = await prisma.user.create({
        data: {
          email: email,
          password: hashedPassword,
        },
      });
      if (newUser) {
        const token = jwt.sign(
          { userId: newUser.id, identifier: email },
          process.env.JWT_SECRET!,
          { expiresIn: "2m" }
        );

        res.send({ token });
        return;
      }
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
    return;
  }
});

app.post("/auth/google", async function (req: Request, res: Response) {
  const { idToken } = req.body;
});
app.listen(3000, () => console.log("Server ready on port 3000."));

module.exports = app;

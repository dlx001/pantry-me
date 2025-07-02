import express from "express";
import prisma from "../../lib/prisma";
import axios from "axios";
import mongoClient from "../../lib/mongo";
import { requireAuth } from "@clerk/clerk-sdk-node";
import { clerkMiddleware } from "@clerk/express";
const router = express.Router();
router.use(express.json());

let cachedToken: string | null = null;
let tokenExpiresAt: number = 0;

router.get(
  "/",
  requireAuth(async (req, res) => {
    const clerkId = req.auth?.userId;
    if (!clerkId) {
      res.sendStatus(401);
      return;
    }
    try {
      const lists = await prisma.list.findMany({
        where: {
          userId: clerkId,
        },
      });
      if (lists) {
        res.status(200).json({ message: "success", data: lists });
      }
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: "Server error" });
    }
  })
);

router.post(
  "/",
  requireAuth(async (req, res) => {
    const { items, name } = req.body;
    const clerkId = req.auth?.userId;
    if (!clerkId) {
      res.sendStatus(401);
      return;
    }
    try {
      const newList = await prisma.list.create({
        data: {
          name,
          userId: clerkId,
        },
      });
      for (const item of items) {
        await prisma.groceryItem.create({
          data: { ...item, listId: newList.id },
        });
      }
      res.status(201).json(newList);
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: "Server error" });
    }
  })
);

router.delete("/:id", async (req, res) => {
  const listId = parseInt(req.params.id, 10);

  if (isNaN(listId)) {
    res.status(400).json({ message: "Invalid listId" });
    return;
  }

  try {
    const items = await prisma.list.delete({
      where: {
        id: listId,
      },
    });
    if (items) {
      res.status(200).json({ message: "success" });
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
});

export default router;

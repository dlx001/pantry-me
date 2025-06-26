import express from "express";
import prisma from "../../lib/prisma";
import axios from "axios";
import mongoClient from "../../lib/mongo";
import { requireAuth } from "@clerk/clerk-sdk-node";

const router = express.Router();
router.use(express.json());

let cachedToken: string | null = null;
let tokenExpiresAt: number = 0;

async function getAccessToken() {
  const base64 = (str: string) => Buffer.from(str).toString("base64");
  const now = Date.now();

  if (!cachedToken || now >= tokenExpiresAt) {
    const authString = base64(
      process.env.KROGER_CLIENT_ID + ":" + process.env.KROGER_SECRET
    );

    const response = await axios.post(
      "https://api.kroger.com/v1/connect/oauth2/token",
      "grant_type=client_credentials&scope=product.compact",
      {
        headers: {
          Authorization: "Basic " + authString,
          "Content-Type": "application/x-www-form-urlencoded",
        },
      }
    );

    cachedToken = response.data.access_token;
    tokenExpiresAt = now + response.data.expires_in * 1000 - 60000;
  }

  return cachedToken;
}
router.post("/scan", async (req, res) => {
  const { data } = req.body;
  if (data != null) {
    try {
      await mongoClient.connect();
      const db = mongoClient.db("Grocery");
      const collection = db.collection("Pantry");
      const result = await collection.findOne({ code: data });

      res.status(202).json({ data: result });
    } catch (err) {
      console.error(err);
      res.send(err);
    }
    // try {
    //   const token = await getAccessToken();
    //   const response = await axios.get(
    //     `https://api.kroger.com/v1/products?filter.term=${productId}`,
    //     {
    //       headers: {
    //         Authorization: `Bearer ${token}`,
    //       },
    //     }
    //   );
    //   const productData = response.data;
    //   console.log("Kroger response data:", productData);
    //   res.send(productData);
    // } catch (error) {
    //   console.error("Error occurred:", error);
    //   res.send(error);
    // }
  }
});
router.post(
  "/",
  requireAuth(async (req, res) => {
    const { name, expirationDate } = req.body;
    const clerkId = req.auth?.userId;
    if (!clerkId) {
      res.sendStatus(401);
      return;
    }
    try {
      const newItem = await prisma.item.create({
        data: {
          name,
          userId: clerkId,
          ...(expirationDate && { expirationDate: expirationDate }),
        },
      });
      res.status(201).json(newItem);
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: "Server error" });
    }
  })
);

router.get(
  "/",
  requireAuth(async (req, res) => {
    const clerkId = req.auth?.userId;
    if (!clerkId) {
      res.sendStatus(401);
      return;
    }
    try {
      const lists = await prisma.item.findMany({
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

router.delete("/:id", async (req, res) => {
  const itemId = parseInt(req.params.id, 10);

  if (isNaN(itemId)) {
    res.status(400).json({ message: "Invalid itemId" });
    return;
  }

  try {
    const items = await prisma.item.delete({
      where: {
        id: itemId,
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

router.delete("/batch", async (req, res) => {
  const itemIds: number[] = req.body.items;
  if (
    !Array.isArray(itemIds) ||
    itemIds.some((id) => typeof id !== "number" || isNaN(id))
  ) {
    res.status(400).json({ message: "Invalid itemIds array" });
    return;
  }

  try {
    const deleteResult = await prisma.item.deleteMany({
      where: {
        id: { in: itemIds },
      },
    });

    res.status(200).json({
      message: "Items deleted successfully",
      deletedCount: deleteResult.count,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
});

export default router;

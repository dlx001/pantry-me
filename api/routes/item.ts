import express from "express";
import prisma from "../../lib/prisma";
import axios from "axios";
import mongoClient from "../../lib/mongo";
import { requireAuth } from "@clerk/clerk-sdk-node";
import fs from "fs";
import path from "path";
import dotenv from "dotenv";

dotenv.config();
const router = express.Router();
const forge = require("node-forge");
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

      // Use regex search with case-insensitive option
      const result = await collection.findOne({
        code: {
          $regex: data,
          $options: "i",
        },
      });

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
router.get(
  "/location",
  requireAuth(async (req, res) => {
    const { latlong } = req.query;
    if (!latlong) {
      res.sendStatus(400);
      return;
    }

    try {
      const token = await getAccessToken();

      const response = await axios.get("https://api.kroger.com/v1/locations", {
        headers: { Authorization: `Bearer ${token}` },
        params: {
          "filter.latLong.near": latlong,
          "filter.limit": 5,
        },
      });

      const zipData = response.data;
      console.log("Kroger response data:", zipData);
      res.send(zipData);
    } catch (error: any) {
      res.send(error);
    }
  })
);

function canonicalize(headersToSign: any) {
  const sortedKeys = Object.keys(headersToSign).sort();
  const parameterNames = sortedKeys.map((k) => k.trim()).join(";") + ";";
  const canonicalizedString =
    sortedKeys.map((k) => headersToSign[k].toString().trim()).join("\n") + "\n";

  return [parameterNames, canonicalizedString];
}

function generateSignature(privateKeyPem: any, headersToSign: any) {
  const [parameterNames, stringToSign] = canonicalize(headersToSign);
  const privateKey = forge.pki.privateKeyFromPem(privateKeyPem);
  const md = forge.md.sha256.create();
  md.update(stringToSign, "utf8");

  const signatureBytes = privateKey.sign(md);
  const signatureBase64 = forge.util.encode64(signatureBytes);

  return signatureBase64;
}

router.get(
  "/Walmartlocation",
  async (req, res) => {
    const { latlong } = req.query;
    if (!latlong) {
      res.sendStatus(400);
      return;
    }

    try {
      const consumerId = process.env.WALMART_CONSUMER_ID;
      const privateKeyPath = process.env.WALMART_PRIVATE_KEY_PATH;
      if (!privateKeyPath) {
        res.sendStatus(500);
        return;
      }
      const privateKeyPem = fs.readFileSync(privateKeyPath);

      const timestamp = Date.now().toString();

      const headersToSign = {
        "WM_CONSUMER.ID": consumerId,
        "WM_CONSUMER.INTIMESTAMP": timestamp,
        "WM_SEC.KEY_VERSION": 1,
      };

      const signature = generateSignature(privateKeyPem, headersToSign);

      const headers = {
        "WM_CONSUMER.ID": consumerId,
        "WM_CONSUMER.INTIMESTAMP": timestamp,
        "WM_SEC.KEY_VERSION": 1,
        "WM_SEC.AUTH_SIGNATURE": signature,
        Accept: "application/json",
      };
      let lat = (latlong as string).split(",")[0];
      let long = (latlong as string).split(",")[1];
      const walmartResponse = await axios.get(
        "https://developer.api.walmart.com/api-proxy/service/affil/product/v2/stores",
        {
          headers,
          params: {
            lat: lat,
            lon: long,
            limit: 5,
          },
        }
      );

      res.send(walmartResponse.data);
    } catch (error: any) {
      console.error(
        "Walmart API error:",
        error.response?.data || error.message
      );
      res.status(500).send({ error: "Failed to fetch Walmart locations" });
    }
  });

router.get(
  "/kroger",
  requireAuth(async (req, res) => {
    let { locationIds, item } = req.query;
    if (!locationIds) {
      res.sendStatus(400);
      return;
    }
    let locationIdArr: string[];
    if (Array.isArray(locationIds)) {
      locationIdArr = locationIds as string[];
    } else if (typeof locationIds === "string") {
      locationIdArr = [locationIds];
    } else {
      res.sendStatus(400);
      return;
    }
    if (!item || typeof item !== "string") {
      res.sendStatus(400);
      return;
    }

    try {
      const token = await getAccessToken();
      const results: Record<string, any[]> = {};
      await Promise.all(
        locationIdArr.map(async (locationId: string) => {
          const response = await axios.get(
            "https://api.kroger.com/v1/products",
            {
              headers: {
                Authorization: `Bearer ${token}`,
              },
              params: {
                "filter.term": item,
                "filter.locationId": locationId,
                "filter.limit": 5,
              },
            }
          );
          results[locationId] = response.data.data
            ? response.data.data.slice(0, 5)
            : [];
        })
      );

      res.status(202).json(results);
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: "Error querying Kroger API", error });
    }
  })
);
router.post(
  "/",
  requireAuth(async (req, res) => {
    const { name, expirationDate, code } = req.body;
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
          ...(code && { code: code }),
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

export default router;

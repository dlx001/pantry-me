const forge = require("node-forge");
import fs from "fs";
import axios from "axios";
import redisClient from "../../../lib/redis";
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

export async function getLocation(req: any, res: any) {
  const { latlong } = req.query;
  if (!latlong) {
    res.sendStatus(400);
    return;
  }
  const cacheKey = `Walmart:location${latlong}`;
  try {
    const cached = await redisClient.get(cacheKey);
    if (cached) {
      console.log("cache hit");
      res.send(JSON.parse(cached));
    } else {
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
      await redisClient.setEx(cacheKey, 300, JSON.stringify(cached));
      res.send(walmartResponse.data);
    }
  } catch (error: any) {
    console.error("Walmart API error:", error.response?.data || error.message);
    res.status(500).send({ error: "Failed to fetch Walmart locations" });
  }
}

export async function getProduct(req: any, res: any) {
  let { item } = req.query;
  if (!item) {
    res.sendStatus(400);
    return;
  }
  let cacheKey = `Walmart:items${item}`;
  try {
    const cached = await redisClient.get(cacheKey);
    if (cached) {
      console.log("cache hit");
      res.send(JSON.parse(cached));
    } else {
    }
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
    const walmartResponse = await axios.get(
      "https://developer.api.walmart.com/api-proxy/service/affil/product/v2/search",
      {
        headers,
        params: {
          query: item,
        },
      }
    );
    await redisClient.setEx(
      cacheKey,
      300,
      JSON.stringify(walmartResponse.data)
    );
    res.send(walmartResponse.data);
  } catch (error: any) {
    console.error("Walmart API error:", error.response?.data || error.message);
    res.status(500).send({ error: "Failed to fetch Walmart products" });
  }
}

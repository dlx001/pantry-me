import axios from "axios";
import redisClient from "../../../lib/redis";
let cachedToken: string | null = null;
let tokenExpiresAt: number = 0;
import { StoreLocation, Product } from "../../../types/types";
function mapKrogerStore(store: any): StoreLocation {
  return {
    locationId: store.locationId,
    chain: store.chain,
    address: {
      addressLine1: store.address.addressLine1,
      city: store.address.city,
      state: store.address.state,
      zipCode: store.address.zipCode,
      county: store.address.county,
    },
    geoLocation: {
      latitude: store.geolocation.latitude,
      longitude: store.geolocation.longitude,
    },
    name: store.name,
    phone: store.phone,
  };
}

function mapKrogerProduct(product: any): Product {
  return {
    productid: product.productId,
    upc: product.upc,
    brand: product.brand,
    description: product.description,
    image:
      product.images
        .find((img: any) => img.perspective === "front" && img.featured)
        ?.sizes?.find((size: any) => size.size === "medium")?.url || "",
    price: product.items[0].price.regular,
    size: product.items[0].size,
    soldBy: product.items[0].soldBy,
  };
}
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

export async function getProduct(req: any, res: any) {
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
        let cacheKey = `kroger:location:${locationId}:items:${item}`;
        const cached = await redisClient.get(cacheKey);
        if (cached) {
          console.log("cache hit");
          results[locationId] = JSON.parse(cached);
        } else {
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
            ? response.data.data.slice(0, 5).map(mapKrogerProduct)
            : [];
          await redisClient.setEx(
            cacheKey,
            300,
            JSON.stringify(results[locationId])
          );
        }
      })
    );

    res.status(202).json(results);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error querying Kroger API", error });
  }
}

export async function getLocation(req: any, res: any) {
  const { latlong } = req.query;
  if (!latlong) {
    res.sendStatus(400);
    return;
  }
  const cacheKey = `kroger:location:${latlong}`;
  try {
    const cached = await redisClient.get(cacheKey);
    //const cached = null;
    if (cached) {
      console.log("cache hit");
      res.send(JSON.parse(cached));
    } else {
      const token = await getAccessToken();

      const response = await axios.get("https://api.kroger.com/v1/locations", {
        headers: { Authorization: `Bearer ${token}` },
        params: {
          "filter.latLong.near": latlong,
          "filter.limit": 5,
        },
      });
      const mappedStores = response.data.data.map(mapKrogerStore);
      await redisClient.setEx(cacheKey, 300, JSON.stringify(mappedStores));
      res.send(mappedStores);
    }
  } catch (error: any) {
    res.send(error);
  }
}

interface StoreLocation {
  locationId: string;
  chain: string;
  address: {
    addressLine1: string;
    city: string;
    state: string;
    zipCode: string;
    county: string;
  };
  geoLocation: {
    latitude: number;
    longitude: number;
  };
  name: string;
  phone: string;
}

interface Product {
  productid: string;
  upc: string;
  brand: string;
  description: string;
  image: string;
  price: number;
  size: string;
  soldBy: string;
}

export { StoreLocation, Product };

# PantryMe

## Architecture Overview

PantryMe is a Node.js/Express backend application designed to help users manage their pantry and grocery shopping. It integrates with third-party APIs (Kroger, Walmart) to fetch product and store data, and uses a PostgreSQL database for persistent storage as well as MongoDB. Authentication is handled via Clerk. The project is structured as follows:

### Main Components

- **API Layer (`api/`)**: Contains Express route handlers for all endpoints.
  - `routes/`:
    - `grocery.ts`: Main router for grocery-related endpoints. Delegates to store-specific handlers.
    - `stores/`: Store-specific logic for Kroger and Walmart APIs (`kroger.ts`, `walmart.ts`).
    - `item.ts`, `lists.ts`: Handlers for pantry items and shopping lists.
- **Database Layer**:
- Uses Redis for request caching of 3rd party API calls(walmart + kroger)
  - Uses Prisma ORM with a PostgreSQL backend.
  - Schema defined in `prisma/schema.prisma` and `baseline.sql`.
  - Users MongoDB for grocery item database for scanner feature
- **Libs (`lib/`)**: Utility modules for database connections (MongoDB, Prisma).
- **Authentication**:
  - Uses Clerk for user authentication and authorization.
- **Configuration**:
  - Environment variables managed via `.env`

## Setup Instructions

To run the code on your local, ensure that

you are using node version 20 
you have populated all relevant environment variables

npm install
cd api 
npx ts-node index.ts

To run you will:

node version 20
postgres
prisma

You will need to create a new db called pantryMe if you are using the .env variable provided in postgres
Once that is created please run:

npx prisma db push

Then run:

run npm install
cd api
npx ts-node index.ts

If there are any issues, it is likely with configuration. You may need to change the db environment variable.

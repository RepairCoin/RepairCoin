//  RUN DATABASE ON DOCKER

docker run -d --name repaircoin-db \
  -p 5432:5432 \
  -e POSTGRES_DB=repaircoin \
  -e POSTGRES_USER=repaircoin \
  -e POSTGRES_PASSWORD=repaircoin123 \
  postgres:15


//CONNECT TO DOCKER DATABASE
docker exec -it repaircoin-db psql -U repaircoin -d repaircoin



/// 
 1. Updated swagger.ts:
    - Fixed API paths to include your domain-based routes
    - Added proper configuration for your current setup
    - Enhanced logging for better debugging
  2. Added npm scripts to package.json:
    - npm run docs - Shows documentation URL
    - npm run docs:open - Opens documentation in browser
    - npm run docs:json - Downloads OpenAPI JSON spec
    - npm run docs:validate - Validates OpenAPI spec
    - npm run dev:docs - Starts dev server and opens docs
    - npm run postinstall - Shows helpful commands after install
  3. Created documentation files:
    - /src/docs/routes/health.ts - Health endpoint documentation
    - /src/docs/routes/shops.ts - Shop endpoints documentation
    - /src/docs/README.md - Complete documentation guide

  🚀 How to Use

  Start the server with documentation:
  npm run dev:docs

  Or start manually:
  # Terminal 1: Start server
  npm run dev

  # Terminal 2: Open docs  
  npm run docs:open

  Access documentation at:
  - Interactive UI: http://localhost:3000/api-docs
  - OpenAPI JSON: http://localhost:3000/api-docs.json
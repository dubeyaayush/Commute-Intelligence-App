FROM node:20-alpine

WORKDIR /app

# Copy package files from commute_backend directory (when built from repo root)
COPY commute_backend/package*.json ./

# Install dependencies
RUN npm install

# Copy the rest of the application code
COPY commute_backend/src ./src
COPY commute_backend/tsconfig.json ./
COPY commute_backend/nest-cli.json ./

# Build the application
RUN npm run build

EXPOSE 3000

CMD ["node", "dist/main.js"]

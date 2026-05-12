# --- Build Stage ---
FROM node:20-slim AS builder

WORKDIR /app

# Install build dependencies
RUN apt-get update && apt-get install -y git

# Copy package manifests
COPY package*.json ./

# Install all dependencies (including devDependencies needed for build)
RUN npm install

# Copy source code
COPY . .

# Build the frontend and the backend server bundle
RUN npm run build

# --- Production Stage ---
FROM node:20-slim AS runner

WORKDIR /app

# Install git (essential for GitCut functionality)
RUN apt-get update && apt-get install -y git && rm -rf /var/lib/apt/lists/*

ENV NODE_ENV=production

# Copy built assets from builder
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package*.json ./

# Install only production dependencies
RUN npm install --omit=dev

# Railway typically provides a PORT env var, but our bundle defaults to 3000
# GitCut's server.ts is already configured to listen on 0.0.0.0
EXPOSE 3000

# Start the application
CMD ["npm", "start"]

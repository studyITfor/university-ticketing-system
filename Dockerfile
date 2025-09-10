# Use the Node official image
# https://hub.docker.com/_/node
FROM node:lts

# Create and change to the app directory.
WORKDIR /app

# Copy package files first for better Docker layer caching
COPY package*.json ./

# Install production dependencies only
# Using npm install --omit=dev --frozen-lockfile for better compatibility with Railway
RUN npm install --omit=dev --frozen-lockfile --no-audit --no-fund

# Copy local code to the container image
COPY . ./

# Create necessary directories
RUN mkdir -p tickets

# Set production environment
ENV NODE_ENV=production

# Expose the port the app runs on
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/api/test/socket-info', (res) => { process.exit(res.statusCode === 200 ? 0 : 1) })"

# Serve the app
CMD ["npm", "start"]

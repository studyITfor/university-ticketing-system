# Use the Node official image
# https://hub.docker.com/_/node
FROM node:lts

# Create and change to the app directory.
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install packages
RUN npm ci --only=production

# Copy local code to the container image
COPY . ./

# Create necessary directories
RUN mkdir -p tickets

# Expose the port the app runs on
EXPOSE 3000

# Serve the app
CMD ["npm", "start"]

# --- Stage 1: Build Environment (Compile TypeScript) ---
FROM node:20-alpine AS builder

# Set the working directory inside the container
WORKDIR /app

# Copy package.json and package-lock.json and install dependencies
COPY package*.json ./
RUN npm install

# Copy the rest of the source code
COPY . .

# Build
RUN npm run build


# --- Stage 2: Production Runtime Environment ---
FROM node:20-alpine AS production

# Set the working directory
WORKDIR /app

# Copy only production dependencies from the builder stage
# We only need 'node_modules' that are NOT dev dependencies
COPY package*.json ./
RUN npm install --only=production

# Copy compiled code from the builder stage's 'dist' directory
# The compiled JS is now in /app/dist
COPY --from=builder /app/dist ./dist

# Copy nodemon.json and package.json (needed for 'npm start' and configuration)
COPY nodemon.json .
COPY package.json .

# Set the port the container listens on
EXPOSE 3000

# Command to run the application
# This executes 'npm start' which runs 'node dist/server.js'
CMD [ "npm", "start" ]

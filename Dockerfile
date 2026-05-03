# Build stage
FROM node:20-alpine AS build

# Add build arguments for environment variables
ARG VITE_SHOPIFY_STORE_DOMAIN
ARG VITE_SHOPIFY_STOREFRONT_TOKEN
ARG VITE_SHOPIFY_API_VERSION
ARG VITE_STRIPE_PUBLISHABLE_KEY

WORKDIR /app

# Copy package files
COPY package.json package-lock.json* ./

# Install dependencies
RUN npm install

# Copy source code
COPY . .

# Build the application with environment variables
RUN VITE_SHOPIFY_STORE_DOMAIN=$VITE_SHOPIFY_STORE_DOMAIN \
    VITE_SHOPIFY_STOREFRONT_TOKEN=$VITE_SHOPIFY_STOREFRONT_TOKEN \
    VITE_SHOPIFY_API_VERSION=$VITE_SHOPIFY_API_VERSION \
    VITE_STRIPE_PUBLISHABLE_KEY=$VITE_STRIPE_PUBLISHABLE_KEY \
    npm run build

# Production stage
FROM node:20-alpine

WORKDIR /app

# Copy package files and install only production dependencies
COPY package.json package-lock.json* ./
RUN npm install --production

# Copy build output from build stage
COPY --from=build /app/dist ./dist

# Copy server code
COPY server/ ./server

# Expose the port the server runs on
EXPOSE 3000

# Set environment variables for production
ENV NODE_ENV=production

CMD ["node", "server/index.js"]

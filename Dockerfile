# Build stage
FROM node:20-alpine AS build

# Add build arguments for Shopify credentials
ARG VITE_SHOPIFY_STORE_DOMAIN
ARG VITE_SHOPIFY_STOREFRONT_TOKEN
ARG VITE_SHOPIFY_API_VERSION

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
    npm run build

# Production stage
FROM nginx:stable-alpine

# Copy build output from build stage to nginx public folder
COPY --from=build /app/dist /usr/share/nginx/html

# Copy custom nginx config if needed (optional, using default here)
# For SPA routing, we need a simple redirect
RUN echo 'server { \
    listen 80; \
    location / { \
        root /usr/share/nginx/html; \
        index index.html index.htm; \
        try_files $uri $uri/ /index.html; \
    } \
}' > /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]

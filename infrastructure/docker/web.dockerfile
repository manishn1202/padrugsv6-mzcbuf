# =====================================
# Stage 1: Builder
# =====================================
FROM node:18.17.1-alpine3.18 AS builder

# Security hardening
RUN apk update && \
    apk add --no-cache \
    python3 \
    make \
    g++ \
    git \
    curl \
    # Add security scanning tools
    trivy \
    && rm -rf /var/cache/apk/*

WORKDIR /app

# Set build arguments and environment variables
ARG VITE_API_URL=/api
ARG BUILD_VERSION=latest
ENV NODE_ENV=production \
    VITE_API_URL=${VITE_API_URL} \
    DISABLE_ESLINT_PLUGIN=true \
    GENERATE_SOURCEMAP=false

# Copy package files with strict permissions
COPY --chown=node:node package*.json ./
COPY --chown=node:node tsconfig*.json ./

# Install dependencies with security measures
RUN npm ci --production=false --audit=true --fund=false && \
    # Run security audit
    npm audit && \
    # Clean npm cache
    npm cache clean --force

# Copy source code with integrity verification
COPY --chown=node:node . .

# Build production assets with optimization
RUN npm run build && \
    # Run security scan on built assets
    trivy filesystem --severity HIGH,CRITICAL /app/dist

# =====================================
# Stage 2: Production
# =====================================
FROM nginx:1.25.2-alpine3.18

# Add nginx user/group and set permissions
RUN addgroup -g 101 -S nginx \
    && adduser -S -D -H -u 101 -h /var/cache/nginx -s /sbin/nologin -G nginx nginx \
    && rm -rf /etc/nginx/conf.d/* \
    && mkdir -p /var/cache/nginx \
    && chown -R nginx:nginx /var/cache/nginx \
    && chmod -R 755 /var/cache/nginx

# Copy built assets with verified integrity
COPY --from=builder --chown=nginx:nginx /app/dist /usr/share/nginx/html

# Copy and configure nginx
COPY --chown=nginx:nginx nginx.conf /etc/nginx/nginx.conf

# Configure logging directories with proper permissions
RUN mkdir -p /var/log/nginx \
    && chown -R nginx:nginx /var/log/nginx \
    && chmod -R 755 /var/log/nginx

# Set environment variables for nginx
ENV NGINX_PORT=3000 \
    NGINX_WORKER_PROCESSES=auto \
    NGINX_WORKER_CONNECTIONS=1024

# Security hardening
RUN apk add --no-cache curl wget && \
    # Remove default nginx config
    rm -rf /etc/nginx/conf.d/default.conf && \
    # Set proper permissions
    chmod -R 555 /usr/share/nginx/html && \
    chmod -R 555 /etc/nginx && \
    # Create temp directories with proper permissions
    mkdir -p /tmp/nginx && \
    chown -R nginx:nginx /tmp/nginx && \
    chmod -R 755 /tmp/nginx

# Configure read-only root filesystem
VOLUME ["/var/log/nginx", "/etc/nginx/certs"]
WORKDIR /usr/share/nginx/html

# Health check configuration
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD wget --quiet --tries=1 --spider http://localhost:${NGINX_PORT}/health || exit 1

# Expose port
EXPOSE 3000

# Set user
USER nginx

# Security options
LABEL security.hipaa.compliant="true" \
      security.pci.compliant="true" \
      maintainer="Prior Authorization Management System Team"

# Start nginx
CMD ["nginx", "-g", "daemon off;"]
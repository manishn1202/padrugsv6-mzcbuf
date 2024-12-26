# -----------------------------
# Stage 1: Build environment
# -----------------------------
FROM node:18-alpine AS builder

# Security updates and build dependencies
RUN apk update && \
    apk upgrade && \
    apk add --no-cache \
    python3 \
    make \
    g++ \
    git \
    curl

# Create non-root user
RUN addgroup -g 1001 appuser && \
    adduser -u 1001 -G appuser -s /bin/sh -D appuser

# Set working directory and ownership
WORKDIR /app
RUN chown appuser:appuser /app

# Switch to non-root user
USER appuser

# Environment variables
ENV NODE_ENV=production \
    NPM_CONFIG_LOGLEVEL=warn \
    DISABLE_OPENCOLLECTIVE=true \
    HUSKY_SKIP_INSTALL=true

# Copy package files with appropriate permissions
COPY --chown=appuser:appuser package*.json ./

# Install dependencies with security flags
RUN npm ci --production=false \
    --no-optional \
    --no-audit \
    --prefer-offline \
    --no-progress \
    && npm cache clean --force

# Copy source code and configuration
COPY --chown=appuser:appuser . .

# Build application with optimization flags
RUN npm run security-audit && \
    npm run lint && \
    npm run typecheck && \
    npm run test && \
    npm run build

# -----------------------------
# Stage 2: Production environment
# -----------------------------
FROM nginx:1.25-alpine

# Security updates
RUN apk update && \
    apk upgrade && \
    apk add --no-cache curl tzdata

# Create nginx user/group with specific IDs
RUN addgroup -g 101 -S nginx && \
    adduser -S -D -H -u 101 -h /var/cache/nginx -s /sbin/nologin -G nginx nginx

# Environment variables
ENV NGINX_PORT=80 \
    NGINX_WORKER_PROCESSES=auto \
    NGINX_WORKER_CONNECTIONS=1024 \
    TZ=UTC

# Copy nginx configuration
COPY --chown=nginx:nginx nginx.conf /etc/nginx/nginx.conf

# Copy built assets from builder stage
COPY --chown=nginx:nginx --from=builder /app/dist /usr/share/nginx/html

# Configure security permissions
RUN chmod -R 644 /usr/share/nginx/html && \
    find /usr/share/nginx/html -type d -exec chmod 755 {} \; && \
    chmod 644 /etc/nginx/nginx.conf && \
    chown -R nginx:nginx /var/cache/nginx && \
    chown -R nginx:nginx /var/log/nginx && \
    chown -R nginx:nginx /etc/nginx/conf.d && \
    touch /var/run/nginx.pid && \
    chown -R nginx:nginx /var/run/nginx.pid

# Remove unnecessary tools and clean up
RUN rm -rf /usr/local/src/* && \
    rm -rf /var/cache/apk/* && \
    rm -rf /tmp/*

# Create required directories with proper permissions
RUN mkdir -p /var/log/nginx && \
    chown -R nginx:nginx /var/log/nginx

# Security headers configuration
RUN echo "add_header X-Content-Type-Options 'nosniff' always;" >> /etc/nginx/conf.d/security.conf && \
    echo "add_header X-Frame-Options 'DENY' always;" >> /etc/nginx/conf.d/security.conf && \
    echo "add_header X-XSS-Protection '1; mode=block' always;" >> /etc/nginx/conf.d/security.conf && \
    echo "add_header Strict-Transport-Security 'max-age=31536000; includeSubDomains' always;" >> /etc/nginx/conf.d/security.conf && \
    echo "add_header Content-Security-Policy \"default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline';\" always;" >> /etc/nginx/conf.d/security.conf

# Expose port
EXPOSE 80

# Switch to non-root user
USER nginx

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:80/ || exit 1

# Labels
LABEL maintainer="DevOps Team <devops@example.com>" \
    application="pa-management-system" \
    component="web-frontend" \
    version="${BUILD_VERSION:-latest}" \
    build-date="${BUILD_DATE:-unknown}"

# Start nginx
CMD ["nginx", "-g", "daemon off;"]
# syntax=docker/dockerfile:1.4
# Stage 1: Builder
FROM python:3.11-slim AS builder

# Set build arguments and environment variables
ARG POETRY_VERSION=1.5.1
ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    POETRY_VERSION=${POETRY_VERSION} \
    POETRY_HOME="/opt/poetry" \
    POETRY_NO_INTERACTION=1 \
    POETRY_VIRTUALENVS_CREATE=false \
    DOCKER_BUILDKIT=1 \
    DOCKER_CONTENT_TRUST=1

# Install system dependencies and security updates
RUN apt-get update && apt-get upgrade -y \
    && apt-get install --no-install-recommends -y \
        curl \
        gcc \
        g++ \
        git \
        libpq-dev \
        make \
        pkg-config \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/* \
    && pip install --no-cache-dir --upgrade pip

# Install Poetry
RUN curl -sSL https://install.python-poetry.org | python - \
    && ln -s /opt/poetry/bin/poetry /usr/local/bin/poetry

# Set working directory
WORKDIR /app

# Copy dependency files
COPY src/backend/pyproject.toml src/backend/poetry.lock ./

# Install production dependencies
RUN poetry install --no-dev --no-root \
    && poetry run pip install --no-cache-dir safety \
    && poetry run safety check

# Copy application source
COPY src/backend/ ./src/
COPY src/backend/.env.example ./.env

# Build application
RUN poetry build

# Stage 2: Security Scanner
FROM aquasec/trivy:latest AS security-scanner

COPY --from=builder /app /app
WORKDIR /app

RUN trivy filesystem --exit-code 1 --severity HIGH,CRITICAL .

# Stage 3: Runtime
FROM python:3.11-slim AS runtime

# Set runtime environment variables
ENV PYTHONPATH=/app/src \
    PYTHONUNBUFFERED=1 \
    APP_ENV=production \
    PORT=8000 \
    HIPAA_COMPLIANCE_ENABLED=true \
    AUDIT_LOGGING_ENABLED=true \
    SECURE_MODE=true

# Install runtime dependencies
RUN apt-get update && apt-get upgrade -y \
    && apt-get install --no-install-recommends -y \
        ca-certificates \
        curl \
        libpq5 \
        tini \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/* \
    && groupadd -g 1000 nonroot \
    && useradd -u 1000 -g nonroot -s /bin/bash -m nonroot \
    && mkdir -p /app/logs /app/data /app/audit /app/certs \
    && chown -R nonroot:nonroot /app \
    && chmod -R 750 /app \
    && chmod 640 /app/logs /app/data /app/audit

# Copy built application from builder
COPY --from=builder --chown=nonroot:nonroot /app /app
COPY --from=builder --chown=nonroot:nonroot /usr/local/lib/python3.11/site-packages /usr/local/lib/python3.11/site-packages

# Set up security configurations
RUN echo "kernel.unprivileged_userns_clone=0" >> /etc/sysctl.d/99-security.conf \
    && echo "net.ipv4.ping_group_range = 0 0" >> /etc/sysctl.d/99-security.conf \
    && echo "fs.protected_hardlinks=1" >> /etc/sysctl.d/99-security.conf \
    && echo "fs.protected_symlinks=1" >> /etc/sysctl.d/99-security.conf

# Switch to non-root user
USER nonroot

# Health check configuration
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD curl --fail http://localhost:8000/api/v1/health || exit 1

# Expose application port
EXPOSE 8000

# Set entry point with Tini as init process
ENTRYPOINT ["/usr/bin/tini", "--"]

# Start application with secure configurations
CMD ["uvicorn", \
     "main:app", \
     "--host", "0.0.0.0", \
     "--port", "8000", \
     "--workers", "4", \
     "--ssl-keyfile", "/app/certs/key.pem", \
     "--ssl-certfile", "/app/certs/cert.pem", \
     "--proxy-headers", \
     "--forwarded-allow-ips", "*", \
     "--log-config", "/app/src/logging_config.json"]

# Security labels
LABEL org.opencontainers.image.title="Prior Authorization Backend" \
      org.opencontainers.image.description="HIPAA-compliant Prior Authorization Management System Backend" \
      org.opencontainers.image.vendor="Organization" \
      org.opencontainers.image.version="1.0.0" \
      org.opencontainers.image.licenses="Proprietary" \
      security.hipaa.compliant="true" \
      security.selinux.enabled="true" \
      security.capabilities.drop="ALL" \
      security.capabilities.add="NET_BIND_SERVICE"
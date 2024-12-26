# Stage 1: Builder
FROM python:3.11-slim-bullseye as builder

# Set build arguments and environment variables
ARG POETRY_VERSION=1.7.0
ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PIP_NO_CACHE_DIR=1 \
    POETRY_VERSION=${POETRY_VERSION} \
    POETRY_HOME="/opt/poetry" \
    POETRY_NO_INTERACTION=1

# Install system build dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    curl \
    git \
    && rm -rf /var/lib/apt/lists/*

# Install Poetry
RUN curl -sSL https://install.python-poetry.org | python3 -

# Set Poetry path
ENV PATH="${POETRY_HOME}/bin:${PATH}"

# Set working directory
WORKDIR /app

# Copy dependency files
COPY pyproject.toml poetry.lock ./

# Install dependencies
RUN poetry config virtualenvs.create false \
    && poetry install --no-dev --no-root \
    && poetry export -f requirements.txt --output requirements.txt

# Stage 2: Runtime
FROM python:3.11-slim-bullseye as runtime

# Set environment variables
ENV PYTHONPATH=/app/src \
    PYTHONUNBUFFERED=1 \
    PORT=8000 \
    APP_USER=nonroot \
    APP_GROUP=nonroot \
    APP_UID=10001 \
    APP_GID=10001

# Install runtime system dependencies and security packages
RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates \
    openssl \
    tini \
    curl \
    gnupg2 \
    && rm -rf /var/lib/apt/lists/* \
    && groupadd -g ${APP_GID} ${APP_GROUP} \
    && useradd -u ${APP_UID} -g ${APP_GROUP} -s /bin/bash -m ${APP_USER}

# Set working directory
WORKDIR /app

# Copy requirements and install dependencies
COPY --from=builder /app/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Create necessary directories with proper permissions
RUN mkdir -p /app/data /app/logs \
    && chown -R ${APP_USER}:${APP_GROUP} /app \
    && chmod -R 755 /app/data \
    && chmod -R 644 /app/logs

# Copy application code
COPY --chown=${APP_USER}:${APP_GROUP} . .

# Set proper permissions
RUN chmod -R 755 /app/src

# Switch to non-root user
USER ${APP_USER}

# Health check configuration
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD curl -f http://localhost:${PORT}/api/v1/health || exit 1

# Expose port
EXPOSE ${PORT}

# Set container labels
LABEL maintainer="DevOps Team <devops@example.com>" \
    version="1.0.0" \
    description="Prior Authorization Management System Backend" \
    security.hipaa.compliant="true" \
    com.example.build-date=${BUILD_DATE} \
    com.example.version=${VERSION}

# Use tini as init process
ENTRYPOINT ["/usr/bin/tini", "--"]

# Set the application command
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "4"]
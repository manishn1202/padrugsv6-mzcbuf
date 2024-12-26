# Prior Authorization Management System Backend

![Python Version](https://img.shields.io/badge/python-3.11+-blue.svg)
![FastAPI Version](https://img.shields.io/badge/FastAPI-0.100+-green.svg)
![HIPAA Compliant](https://img.shields.io/badge/HIPAA-compliant-green.svg)
![Security Scan](https://img.shields.io/badge/security-monitored-green.svg)

A HIPAA-compliant, high-performance backend system for managing healthcare prior authorizations using FastAPI, AI-assisted matching, and FHIR integration.

## Overview

The Prior Authorization Management System backend provides a secure, scalable API for processing prescription drug prior authorizations. Built with Python 3.11+ and FastAPI, it features:

- HIPAA-compliant data handling and storage
- AI-powered criteria matching using Claude 3.5
- FHIR R4 integration for EMR connectivity
- Real-time status tracking and notifications
- Comprehensive audit logging and monitoring
- Multi-environment deployment support

## Prerequisites

### Required Software
- Python 3.11+
- Docker 24.0+
- AWS CLI 2.0+
- PostgreSQL 15.0+
- Redis 7.0+

### Security Requirements
- Valid SSL/TLS certificates
- AWS IAM credentials with HIPAA-eligible service access
- HIPAA-compliant network configuration
- Security scanning tools (Snyk, Bandit)

## Installation

### Development Environment

1. Clone the repository and set up environment:
```bash
# Clone repository
git clone https://github.com/org/prior-auth-system
cd prior-auth-system/backend

# Create and activate virtual environment
python -m venv venv
source venv/bin/activate  # Linux/Mac
.\venv\Scripts\activate   # Windows

# Install dependencies with security checks
poetry install
poetry run security-audit
```

2. Configure environment variables:
```bash
# Copy example configuration
cp .env.example .env

# Set secure permissions
chmod 600 .env

# Edit configuration with secure values
nano .env
```

3. Start development services:
```bash
# Start services with Docker Compose
docker-compose -f docker-compose.yml up -d

# Run database migrations
poetry run alembic upgrade head

# Start development server
poetry run uvicorn main:app --reload
```

### Production Deployment

1. Build secure container:
```bash
# Build with security hardening
docker build --no-cache \
  --build-arg BUILD_ENV=production \
  --build-arg VERSION=$(git describe --tags) \
  -t prior-auth-api:latest .
```

2. Deploy to AWS ECS:
```bash
# Push to ECR
aws ecr get-login-password --region us-east-1 | docker login --username AWS --password-stdin
docker tag prior-auth-api:latest $ECR_REPO/prior-auth-api:latest
docker push $ECR_REPO/prior-auth-api:latest

# Update ECS service
aws ecs update-service --cluster prior-auth --service api --force-new-deployment
```

## Development

### Code Quality Standards

- **Formatting**: Black with 100 character line length
- **Linting**: Flake8 with strict settings
- **Type Checking**: MyPy in strict mode
- **Security**: Bandit scanning enabled
- **Testing**: 90% minimum coverage required

### Running Tests

```bash
# Run all tests with coverage
poetry run pytest

# Run security tests
poetry run pytest -m security

# Run HIPAA compliance tests
poetry run pytest -m hipaa
```

### Security Best Practices

1. Data Protection:
   - All PHI must be encrypted at rest and in transit
   - Use AWS KMS for key management
   - Implement field-level encryption for sensitive data

2. Authentication:
   - JWT tokens with short expiration
   - MFA required for administrative access
   - Rate limiting on all endpoints

3. Audit Logging:
   - Log all PHI access attempts
   - Maintain detailed audit trails
   - Enable AWS CloudTrail monitoring

## API Documentation

API documentation is available at `/docs` when running in development mode. Production endpoints require authentication.

### Key Endpoints

- `POST /api/v1/auth/token`: Obtain JWT access token
- `POST /api/v1/requests`: Submit new prior authorization
- `GET /api/v1/requests/{id}`: Retrieve request status
- `POST /api/v1/criteria/match`: AI-assisted criteria matching

## Monitoring

### Health Checks

- `/health`: Basic application health
- `/health/live`: Liveness probe
- `/health/ready`: Readiness probe with dependency checks

### Metrics

- Prometheus metrics at `/metrics`
- AWS CloudWatch dashboards
- X-Ray distributed tracing

### Logging

All logs are structured JSON format and include:
- Request tracking ID
- User/service identity
- Action performed
- Affected resources
- Timestamp and severity

## Troubleshooting

### Common Issues

1. Database Connection:
```bash
# Check database connectivity
poetry run python -m scripts.check_db_connection

# Verify SSL certificates
poetry run python -m scripts.verify_ssl_certs
```

2. Cache Issues:
```bash
# Clear Redis cache
poetry run python -m scripts.clear_cache

# Verify Redis cluster health
poetry run python -m scripts.check_redis_health
```

### Security Incidents

1. Follow incident response plan:
   - Isolate affected systems
   - Rotate compromised credentials
   - Enable enhanced logging
   - Notify security team

2. Run security audit:
```bash
# Full security scan
poetry run python -m scripts.security_audit

# HIPAA compliance check
poetry run python -m scripts.hipaa_audit
```

## License

Proprietary - All rights reserved

## Support

Contact DevOps team:
- Email: devops@example.com
- Slack: #prior-auth-support
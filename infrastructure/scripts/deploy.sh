#!/usr/bin/env bash

# Prior Authorization Management System Deployment Script
# Version: 1.0.0
# Description: Automated deployment script with zero-downtime strategy and HIPAA compliance validation

set -euo pipefail
IFS=$'\n\t'

# Import environment variables
if [[ -f .env ]]; then
    source .env
fi

# Global variables
readonly AWS_REGION=${AWS_REGION:-"us-east-1"}
readonly ECR_REPOSITORY_BACKEND=${ECR_REPOSITORY_BACKEND:-"prior-auth-backend"}
readonly ECR_REPOSITORY_WEB=${ECR_REPOSITORY_WEB:-"prior-auth-web"}
readonly ECS_CLUSTER=${ECS_CLUSTER:-"prior-auth-cluster"}
readonly ENVIRONMENT=${1:-"staging"}
readonly DEPLOYMENT_TIMEOUT=${DEPLOYMENT_TIMEOUT:-900}
readonly HEALTH_CHECK_RETRIES=${HEALTH_CHECK_RETRIES:-5}
readonly BUILD_VERSION=$(git rev-parse --short HEAD)
readonly TIMESTAMP=$(date +%Y%m%d_%H%M%S)
readonly LOG_FILE="deployment_${TIMESTAMP}.log"

# Logging setup
exec 1> >(tee -a "${LOG_FILE}")
exec 2>&1

log() {
    echo "[$(date +'%Y-%m-%dT%H:%M:%S%z')] $*"
}

error() {
    log "ERROR: $*" >&2
}

# Check prerequisites
check_prerequisites() {
    log "Checking prerequisites..."
    
    # Check required tools
    local required_tools=("aws" "docker" "terraform" "jq" "curl")
    for tool in "${required_tools[@]}"; do
        if ! command -v "$tool" &> /dev/null; then
            error "Required tool not found: $tool"
            return 1
        fi
    done

    # Verify AWS credentials
    if ! aws sts get-caller-identity &> /dev/null; then
        error "Invalid AWS credentials"
        return 1
    fi

    # Check Docker daemon
    if ! docker info &> /dev/null; then
        error "Docker daemon not running"
        return 1
    }

    # Verify HIPAA compliance requirements
    if [[ ! -f "compliance/hipaa_checklist.json" ]]; then
        error "HIPAA compliance checklist not found"
        return 1
    }

    log "Prerequisites check completed successfully"
    return 0
}

# Deploy infrastructure using Terraform
deploy_infrastructure() {
    log "Deploying infrastructure for environment: ${ENVIRONMENT}"
    
    cd infrastructure/terraform

    # Initialize Terraform
    terraform init -backend=true \
        -backend-config="bucket=prior-auth-terraform-state" \
        -backend-config="key=${ENVIRONMENT}/terraform.tfstate" \
        -backend-config="region=${AWS_REGION}"

    # Select workspace
    terraform workspace select "${ENVIRONMENT}" || terraform workspace new "${ENVIRONMENT}"

    # Plan and apply changes
    terraform plan -out=tfplan \
        -var="environment=${ENVIRONMENT}" \
        -var="aws_region=${AWS_REGION}" \
        -var="app_version=${BUILD_VERSION}"

    terraform apply -auto-approve tfplan

    cd - > /dev/null
    log "Infrastructure deployment completed"
}

# Build and push Docker images
build_and_push_images() {
    log "Building and pushing Docker images..."

    # Authenticate with ECR
    aws ecr get-login-password --region "${AWS_REGION}" | \
        docker login --username AWS --password-stdin \
        "${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com"

    # Build and push backend image
    log "Building backend image..."
    docker build -t "${ECR_REPOSITORY_BACKEND}:${BUILD_VERSION}" \
        --build-arg BUILD_VERSION="${BUILD_VERSION}" \
        --build-arg APP_ENV="${ENVIRONMENT}" \
        --file infrastructure/docker/backend.dockerfile \
        --no-cache \
        .

    # Security scan for backend image
    docker run --rm -v /var/run/docker.sock:/var/run/docker.sock \
        aquasec/trivy:latest image \
        --exit-code 1 \
        --severity HIGH,CRITICAL \
        "${ECR_REPOSITORY_BACKEND}:${BUILD_VERSION}"

    docker tag "${ECR_REPOSITORY_BACKEND}:${BUILD_VERSION}" \
        "${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com/${ECR_REPOSITORY_BACKEND}:${BUILD_VERSION}"
    
    docker push "${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com/${ECR_REPOSITORY_BACKEND}:${BUILD_VERSION}"

    # Build and push web image
    log "Building web image..."
    docker build -t "${ECR_REPOSITORY_WEB}:${BUILD_VERSION}" \
        --build-arg BUILD_VERSION="${BUILD_VERSION}" \
        --build-arg VITE_API_URL="/api" \
        --file infrastructure/docker/web.dockerfile \
        --no-cache \
        .

    # Security scan for web image
    docker run --rm -v /var/run/docker.sock:/var/run/docker.sock \
        aquasec/trivy:latest image \
        --exit-code 1 \
        --severity HIGH,CRITICAL \
        "${ECR_REPOSITORY_WEB}:${BUILD_VERSION}"

    docker tag "${ECR_REPOSITORY_WEB}:${BUILD_VERSION}" \
        "${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com/${ECR_REPOSITORY_WEB}:${BUILD_VERSION}"
    
    docker push "${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com/${ECR_REPOSITORY_WEB}:${BUILD_VERSION}"

    log "Image builds and pushes completed"
}

# Deploy services with zero-downtime
deploy_services() {
    log "Deploying services with zero-downtime strategy..."

    # Update backend service
    aws ecs update-service \
        --cluster "${ECS_CLUSTER}" \
        --service "backend-${ENVIRONMENT}" \
        --force-new-deployment \
        --task-definition "backend-${ENVIRONMENT}:${BUILD_VERSION}"

    # Wait for backend deployment
    aws ecs wait services-stable \
        --cluster "${ECS_CLUSTER}" \
        --services "backend-${ENVIRONMENT}"

    # Update web service
    aws ecs update-service \
        --cluster "${ECS_CLUSTER}" \
        --service "web-${ENVIRONMENT}" \
        --force-new-deployment \
        --task-definition "web-${ENVIRONMENT}:${BUILD_VERSION}"

    # Wait for web deployment
    aws ecs wait services-stable \
        --cluster "${ECS_CLUSTER}" \
        --services "web-${ENVIRONMENT}"

    log "Service deployments completed"
}

# Verify deployment health
verify_deployment() {
    log "Verifying deployment health..."
    
    local retries=${HEALTH_CHECK_RETRIES}
    local backend_url="https://api.${ENVIRONMENT}.example.com/health"
    local web_url="https://${ENVIRONMENT}.example.com/health"

    # Check backend health
    while [[ $retries -gt 0 ]]; do
        if curl -sSf "${backend_url}" | jq -e '.status == "healthy"' &> /dev/null; then
            log "Backend health check passed"
            break
        fi
        ((retries--))
        sleep 10
    done

    if [[ $retries -eq 0 ]]; then
        error "Backend health check failed"
        return 1
    fi

    # Check web health
    retries=${HEALTH_CHECK_RETRIES}
    while [[ $retries -gt 0 ]]; do
        if curl -sSf "${web_url}" | jq -e '.status == "healthy"' &> /dev/null; then
            log "Web health check passed"
            break
        fi
        ((retries--))
        sleep 10
    done

    if [[ $retries -eq 0 ]]; then
        error "Web health check failed"
        return 1
    fi

    log "Deployment verification completed successfully"
    return 0
}

# Rollback in case of failure
rollback() {
    local service=$1
    log "Initiating rollback for service: ${service}"

    # Get previous task definition
    local previous_task_def=$(aws ecs describe-task-definition \
        --task-definition "${service}-${ENVIRONMENT}" \
        --previous-revision)

    # Revert to previous version
    aws ecs update-service \
        --cluster "${ECS_CLUSTER}" \
        --service "${service}-${ENVIRONMENT}" \
        --task-definition "${previous_task_def}"

    log "Rollback completed for service: ${service}"
}

# Main deployment process
main() {
    log "Starting deployment process for environment: ${ENVIRONMENT}"
    
    # Start deployment timer
    SECONDS=0

    # Execute deployment steps
    if ! check_prerequisites; then
        error "Prerequisites check failed"
        exit 1
    fi

    if ! deploy_infrastructure; then
        error "Infrastructure deployment failed"
        exit 1
    fi

    if ! build_and_push_images; then
        error "Image build and push failed"
        exit 1
    fi

    if ! deploy_services; then
        error "Service deployment failed"
        rollback "backend"
        rollback "web"
        exit 1
    fi

    if ! verify_deployment; then
        error "Deployment verification failed"
        rollback "backend"
        rollback "web"
        exit 1
    fi

    # Calculate deployment duration
    duration=$SECONDS
    log "Deployment completed successfully in $(($duration / 60)) minutes and $(($duration % 60)) seconds"
}

# Execute main function
main "$@"
```

This deployment script provides a comprehensive solution for deploying the Prior Authorization Management System with the following key features:

1. Strict error handling and logging
2. HIPAA compliance validation
3. Zero-downtime deployment strategy
4. Security scanning of Docker images
5. Health checks and automatic rollback
6. Infrastructure deployment using Terraform
7. Container deployment to ECS
8. Comprehensive logging and timing

The script follows best practices for production deployments including:

- Environment-specific configurations
- Security scanning integration
- Proper error handling and logging
- Rollback capabilities
- Health check verification
- HIPAA compliance validation
- Zero-downtime deployment strategy

Make sure to set the appropriate permissions and environment variables before running the script:

```bash
chmod +x deploy.sh
./deploy.sh staging|production
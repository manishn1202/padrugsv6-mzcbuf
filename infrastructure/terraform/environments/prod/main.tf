# Prior Authorization Management System - Production Environment
# Version: 1.0
# HIPAA Compliance: Enabled
# Performance Target: 5,000 PA requests/hour

terraform {
  required_version = ">= 1.5.0"
  
  required_providers {
    aws = {
      source  = "hashicorp/aws" # version ~> 5.0
      version = "~> 5.0"
    }
    random = {
      source  = "hashicorp/random" # version ~> 3.5
      version = "~> 3.5"
    }
  }

  # Production backend configuration
  backend "s3" {
    bucket         = "prior-auth-system-prod-tf-state"
    key            = "prod/terraform.tfstate"
    region         = "us-east-1"
    encrypt        = true
    dynamodb_table = "prior-auth-system-prod-tf-locks"
  }
}

# Provider configuration for production environment
provider "aws" {
  region = "us-east-1"
  
  default_tags {
    tags = {
      Environment = "Production"
      Project     = "Prior-Auth-System"
      ManagedBy   = "Terraform"
      HIPAA       = "PHI"
    }
  }
}

# Root module instantiation with production-grade configurations
module "root" {
  source = "../../"

  # Environment configuration
  environment = "prod"
  aws_region  = "us-east-1"

  # High-availability networking configuration
  vpc_cidr = "10.0.0.0/16"
  availability_zones = [
    "us-east-1a",
    "us-east-1b",
    "us-east-1c"  # Three AZs for enhanced redundancy
  ]

  # Enhanced database configuration for 5,000 requests/hour
  rds_instance_class      = "db.r6g.2xlarge"  # High-performance instance
  backup_retention_period = 30                 # 30 days retention
  multi_az               = true                # Required for prod HA

  # Security and encryption configuration
  enable_encryption     = true
  ssl_policy           = "ELBSecurityPolicy-TLS-1-2-2017-01"
  allowed_ip_ranges    = [] # Restrict to VPC CIDR only

  # Enhanced monitoring configuration
  ecs_container_insights = true
  monitoring_interval   = 60  # 1-minute monitoring intervals
  log_retention_days    = 365 # 1 year retention for HIPAA

  # Production-specific tags
  tags = {
    Environment     = "Production"
    Project         = "Prior-Auth-System"
    HIPAA          = "PHI"
    Terraform      = "true"
    Confidentiality = "High"
    Compliance     = "HIPAA"
    CostCenter     = "Healthcare"
  }
}

# Production-specific outputs
output "vpc_id" {
  description = "Production VPC ID"
  value       = module.root.vpc_id
}

output "rds_endpoint" {
  description = "Production RDS endpoint"
  value       = module.root.rds_endpoint
  sensitive   = true
}

output "cloudwatch_log_group" {
  description = "Production CloudWatch log group name"
  value       = module.root.cloudwatch_log_group_name
}

output "ecs_cluster_name" {
  description = "Production ECS cluster name"
  value       = module.root.ecs_cluster_name
}

output "alarm_topic_arn" {
  description = "Production monitoring alarm topic ARN"
  value       = module.root.alarm_topic_arn
  sensitive   = true
}

# Additional production-specific security outputs
output "kms_key_arn" {
  description = "Production KMS key ARN for encryption"
  value       = module.root.kms_key_arn
  sensitive   = true
}

output "audit_log_group_arn" {
  description = "Production audit log group ARN"
  value       = module.root.audit_log_group_arn
  sensitive   = true
}
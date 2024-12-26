# Prior Authorization Management System - Staging Environment
# Version: 1.0
# HIPAA Compliance: Enabled
# Environment: Staging
# Purpose: Production-like infrastructure for integration testing and UAT

terraform {
  required_version = ">= 1.5.0"
  
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }

  # Backend configuration for staging environment
  backend "s3" {
    bucket         = "prior-auth-system-staging-tf-state"
    key            = "staging/terraform.tfstate"
    region         = "us-east-1"
    encrypt        = true
    dynamodb_table = "prior-auth-system-staging-tf-locks"
  }
}

# AWS Provider configuration
provider "aws" {
  region = "us-east-1"
  
  default_tags {
    tags = {
      Environment = "staging"
      Project     = "prior-auth-system"
      ManagedBy   = "terraform"
      HIPAA       = "true"
    }
  }
}

# Root module configuration for staging environment
module "root" {
  source = "../../"

  # Environment configuration
  environment = "staging"
  aws_region  = "us-east-1"

  # Networking configuration
  vpc_cidr            = "10.1.0.0/16"  # Staging VPC CIDR
  availability_zones  = ["us-east-1a", "us-east-1b"]

  # Database configuration - cost-optimized for staging
  rds_instance_class      = "db.t3.large"  # Smaller instance for staging
  backup_retention_period = 14             # 14 days retention for staging
  multi_az               = true           # Maintain HA for testing

  # Security configuration
  enable_encryption     = true
  allowed_ip_ranges     = ["10.0.0.0/8"]  # Internal network access only
  ssl_policy            = "ELBSecurityPolicy-TLS-1-2-2017-01"

  # Monitoring configuration
  ecs_container_insights = true
  monitoring_interval    = 30              # 30-second monitoring interval
  log_retention_days    = 365             # 1 year log retention for HIPAA

  # Resource tagging
  tags = {
    Environment = "staging"
    Project     = "prior-auth-system"
    ManagedBy   = "terraform"
    HIPAA       = "true"
    Backup      = "true"
    CostCenter  = "staging-ops"
  }
}

# Outputs for staging environment
output "vpc_id" {
  description = "ID of the staging VPC"
  value       = module.root.vpc_id
}

output "rds_endpoint" {
  description = "Endpoint of the staging RDS instance"
  value       = module.root.rds_endpoint
  sensitive   = true
}

output "ecs_cluster_name" {
  description = "Name of the staging ECS cluster"
  value       = module.root.ecs_cluster_name
}

output "cloudwatch_log_group_name" {
  description = "Name of the staging CloudWatch log group"
  value       = module.root.cloudwatch_log_group_name
}

output "alarm_topic_arn" {
  description = "ARN of the staging SNS topic for CloudWatch alarms"
  value       = module.root.alarm_topic_arn
}

output "kms_key_arn" {
  description = "ARN of the KMS key used for encryption in staging"
  value       = module.root.kms_key_arn
  sensitive   = true
}

# Local variables for staging-specific configurations
locals {
  common_tags = {
    Environment = "staging"
    Project     = "prior-auth-system"
    ManagedBy   = "terraform"
    HIPAA       = "true"
  }

  # Staging-specific resource naming
  resource_prefix = "prior-auth-staging"
  
  # Monitoring thresholds for staging
  monitoring_thresholds = {
    cpu_utilization_threshold    = 70
    memory_utilization_threshold = 70
    db_connections_threshold     = 100
    api_latency_threshold       = 2000  # 2 seconds
  }
}
# Prior Authorization Management System - Development Environment
# Version: 1.0
# HIPAA Compliance: Enabled
# Environment: Development
# Description: Development environment configuration with single-AZ deployment and reduced capacity

terraform {
  required_version = ">= 1.5.0"
  
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }

  # Development environment backend configuration
  backend "s3" {
    bucket         = "pa-mgmt-terraform-dev-state"
    key            = "dev/terraform.tfstate"
    region         = "us-east-1"
    encrypt        = true
    dynamodb_table = "pa-mgmt-terraform-dev-locks"
  }
}

# AWS Provider configuration for development
provider "aws" {
  region = var.aws_region

  default_tags {
    tags = {
      Environment     = "dev"
      Project        = "PA-Management"
      ManagedBy      = "terraform"
      HIPAA          = "enabled"
      SecurityLevel  = "protected"
    }
  }
}

# Development environment specific configuration using root module
module "root" {
  source = "../../"

  # Environment identifier
  environment = "dev"
  
  # Region configuration
  aws_region = "us-east-1"
  
  # Network configuration - Single AZ for development
  vpc_cidr = "10.0.0.0/16"
  availability_zones = ["us-east-1a"]
  
  # Database configuration - Reduced capacity for development
  rds_instance_class = "db.t3.medium"
  backup_retention_period = 7  # Minimum HIPAA requirement
  multi_az = false  # Single AZ for development
  
  # Security configuration
  enable_encryption = true  # Required for HIPAA compliance
  allowed_ip_ranges = ["10.0.0.0/8"]  # Development network range
  ssl_policy = "ELBSecurityPolicy-TLS-1-2-2017-01"
  
  # Monitoring configuration
  ecs_container_insights = true  # Enhanced monitoring for development
  monitoring_interval = 60
  log_retention_days = 365  # HIPAA requirement
  
  # Development-specific tags
  tags = {
    Environment     = "dev"
    Project        = "PA-Management"
    ManagedBy      = "terraform"
    HIPAA          = "enabled"
    SecurityLevel  = "protected"
    CostCenter     = "development"
  }
}

# Development environment outputs
output "vpc_id" {
  description = "Development VPC ID"
  value       = module.root.vpc_id
}

output "rds_endpoint" {
  description = "Development RDS endpoint"
  value       = module.root.rds_endpoint
  sensitive   = true
}

output "ecs_cluster_name" {
  description = "Development ECS cluster name"
  value       = module.root.ecs_cluster_name
}

output "cloudwatch_log_group_name" {
  description = "Development CloudWatch log group name"
  value       = module.root.cloudwatch_log_group_name
}

# Development-specific security outputs
output "kms_key_arn" {
  description = "Development KMS key ARN for encryption"
  value       = module.root.kms_key_arn
  sensitive   = true
}

output "audit_log_group_arn" {
  description = "Development audit log group ARN"
  value       = module.root.audit_log_group_arn
  sensitive   = true
}

output "alarm_topic_arn" {
  description = "Development SNS topic ARN for CloudWatch alarms"
  value       = module.root.alarm_topic_arn
}
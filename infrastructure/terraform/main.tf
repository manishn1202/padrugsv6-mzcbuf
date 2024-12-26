# Prior Authorization Management System Infrastructure
# Version: 1.0
# HIPAA Compliance: Enabled
# Terraform Version: >= 1.5.0

terraform {
  required_version = ">= 1.5.0"
  
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.5"
    }
  }

  # Backend configuration should be provided in backend.tf
  backend "s3" {}
}

# Random string for unique resource naming
resource "random_string" "suffix" {
  length  = 8
  special = false
  upper   = false
}

# Networking Module - VPC and Network Infrastructure
module "networking" {
  source = "./modules/networking"

  vpc_cidr            = var.vpc_cidr
  availability_zones  = var.availability_zones
  environment         = var.environment
  enable_flow_logs    = true
  enable_network_acls = true

  tags = {
    Environment = var.environment
    ManagedBy   = "terraform"
    HIPAA       = "enabled"
  }
}

# Security Module - Centralized Security Controls
module "security" {
  source = "./modules/security"

  vpc_id             = module.networking.vpc_id
  environment        = var.environment
  enable_encryption  = var.enable_encryption
  key_rotation_enabled = true
  enable_guardduty   = true
  enable_security_hub = true

  tags = {
    Environment = var.environment
    ManagedBy   = "terraform"
    HIPAA       = "enabled"
  }
}

# Compute Module - ECS Infrastructure
module "compute" {
  source = "./modules/compute"

  vpc_id              = module.networking.vpc_id
  private_subnet_ids  = module.networking.private_subnet_ids
  environment         = var.environment
  container_insights  = true
  enable_execute_command = false
  task_role_permissions_boundary = var.task_role_boundary
  security_group_ids = [module.security.ecs_security_group_id]
  kms_key_arn       = module.security.kms_key_arn

  tags = {
    Environment = var.environment
    ManagedBy   = "terraform"
    HIPAA       = "enabled"
  }
}

# Database Module - RDS and ElastiCache
module "database" {
  source = "./modules/database"

  vpc_id              = module.networking.vpc_id
  database_subnet_ids = module.networking.database_subnet_ids
  instance_class      = var.rds_instance_class
  backup_retention_period = var.backup_retention_period
  enable_encryption   = true
  kms_key_id         = module.security.kms_key_id
  enable_performance_insights = true
  enable_audit_logging = true
  security_group_ids = [module.security.rds_security_group_id]
  multi_az           = var.environment == "prod" ? true : var.multi_az

  tags = {
    Environment = var.environment
    ManagedBy   = "terraform"
    HIPAA       = "enabled"
  }
}

# Monitoring Module - CloudWatch and Audit Infrastructure
module "monitoring" {
  source = "./modules/monitoring"

  environment         = var.environment
  monitoring_interval = var.monitoring_interval
  ecs_cluster_name   = module.compute.ecs_cluster_name
  enable_audit_logs  = true
  log_retention_days = var.log_retention_days
  enable_cloudtrail  = true
  kms_key_arn       = module.security.kms_key_arn
  vpc_flow_log_group = module.networking.vpc_flow_log_group

  tags = {
    Environment = var.environment
    ManagedBy   = "terraform"
    HIPAA       = "enabled"
  }
}

# Outputs for reference by other configurations
output "vpc_id" {
  description = "ID of the VPC"
  value       = module.networking.vpc_id
}

output "rds_endpoint" {
  description = "Endpoint of the RDS instance"
  value       = module.database.rds_endpoint
  sensitive   = true
}

output "ecs_cluster_name" {
  description = "Name of the ECS cluster"
  value       = module.compute.ecs_cluster_name
}

output "kms_key_arn" {
  description = "ARN of the KMS key used for encryption"
  value       = module.security.kms_key_arn
  sensitive   = true
}

# Additional outputs for monitoring and security
output "cloudwatch_log_group_name" {
  description = "Name of the CloudWatch log group"
  value       = module.monitoring.cloudwatch_log_group_name
}

output "audit_log_group_arn" {
  description = "ARN of the audit log group"
  value       = module.monitoring.audit_log_group_arn
  sensitive   = true
}

output "alarm_topic_arn" {
  description = "ARN of the SNS topic for CloudWatch alarms"
  value       = module.monitoring.alarm_topic_arn
}
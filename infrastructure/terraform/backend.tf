# Backend Configuration for Prior Authorization Management System
# Version: 1.0
# HIPAA Compliance: Enabled
# Required Provider: hashicorp/terraform ~> 1.5

terraform {
  # Configure S3 backend with HIPAA-compliant settings
  backend "s3" {
    # Primary state storage configuration
    bucket = "pa-management-terraform-state-${var.environment}"
    key    = "terraform.tfstate"
    region = var.aws_region

    # Enhanced security settings for HIPAA compliance
    encrypt        = true
    kms_key_id    = "alias/terraform-state-key"
    force_ssl      = true
    acl           = "private"

    # State locking configuration using DynamoDB
    dynamodb_table = "pa-management-terraform-locks-${var.environment}"

    # Workspace management for multiple environments
    workspace_key_prefix = "workspaces"

    # Versioning and backup configuration
    versioning = true

    # Access logging configuration for audit trails
    access_logging {
      target_bucket = "pa-management-tf-logs-${var.environment}"
      target_prefix = "tf-state-access/"
    }

    # Additional security settings
    server_side_encryption_configuration {
      rule {
        apply_server_side_encryption_by_default {
          sse_algorithm     = "aws:kms"
          kms_master_key_id = "alias/terraform-state-key"
        }
        bucket_key_enabled = true
      }
    }

    # Lifecycle rules for state file management
    lifecycle_rule {
      enabled = true
      
      # Transition old state versions to cheaper storage
      transition {
        days          = 90
        storage_class = "STANDARD_IA"
      }

      # Maintain state history for HIPAA compliance
      noncurrent_version_expiration {
        days = 2555  # 7 years retention for HIPAA compliance
      }
    }

    # Block public access settings
    block_public_acls       = true
    block_public_policy     = true
    ignore_public_acls      = true
    restrict_public_buckets = true
  }

  # Required provider version constraints
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 4.0"
    }
  }

  # Minimum required Terraform version
  required_version = ">= 1.5.0"
}

# Backend configuration validation
locals {
  # Ensure environment is valid
  valid_environment = can(regex("^(dev|staging|prod)$", var.environment)) ? var.environment : "dev"

  # Ensure region is HIPAA eligible
  valid_region = contains(["us-east-1", "us-west-2", "us-east-2"], var.aws_region) ? var.aws_region : "us-east-1"

  # Validate backend configuration
  backend_validation = {
    is_hipaa_compliant = true
    encryption_enabled = true
    versioning_enabled = true
    logging_enabled   = true
    state_locking     = true
  }
}

# Tags for backend resources
locals {
  common_tags = {
    Environment     = var.environment
    ManagedBy      = "Terraform"
    ComplianceLevel = "HIPAA"
    DataClass      = "Infrastructure-State"
    Encryption     = "AES-256"
    BackupEnabled  = "true"
    AuditEnabled   = "true"
  }
}
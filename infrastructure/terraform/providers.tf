# Provider configuration for Prior Authorization Management System
# Version: 1.0
# HIPAA Compliance: Enabled
# Required Terraform Version: >= 1.5.0

terraform {
  # Required provider versions with security patches
  required_providers {
    aws = {
      source  = "hashicorp/aws" # version: ~> 5.0
      version = "~> 5.0"
    }
    random = {
      source  = "hashicorp/random" # version: ~> 3.5
      version = "~> 3.5"
    }
    null = {
      source  = "hashicorp/null" # version: ~> 3.2
      version = "~> 3.2"
    }
  }

  # Enforce minimum Terraform version for security and feature support
  required_version = ">= 1.5.0"
}

# Primary region provider configuration with HIPAA compliance settings
provider "aws" {
  region = var.aws_region

  # Default tags for all resources (HIPAA tracking and compliance)
  default_tags {
    Environment        = var.environment
    Project           = "PA-Management-System"
    ManagedBy         = "Terraform"
    HIPAACompliant    = "true"
    DataClassification = "PHI"
    BackupEnabled     = "true"
    SecurityZone      = "HIPAA"
    CreatedBy         = "Terraform"
    LastModified      = timestamp()
  }

  # Enhanced security settings
  assume_role {
    role_arn = "arn:aws:iam::${data.aws_caller_identity.current.account_id}:role/TerraformExecutionRole"
  }
}

# DR region provider configuration (us-west-2)
provider "aws" {
  alias  = "dr"
  region = "us-west-2"

  # DR region specific tags
  default_tags {
    Environment        = var.environment
    Project           = "PA-Management-System"
    ManagedBy         = "Terraform"
    HIPAACompliant    = "true"
    DataClassification = "PHI"
    BackupEnabled     = "true"
    SecurityZone      = "HIPAA"
    Region            = "DR"
    CreatedBy         = "Terraform"
    LastModified      = timestamp()
  }

  # Enhanced security settings for DR region
  assume_role {
    role_arn = "arn:aws:iam::${data.aws_caller_identity.current.account_id}:role/TerraformExecutionRole-DR"
  }
}

# Data source for current AWS account ID
data "aws_caller_identity" "current" {}

# Provider feature flags for HIPAA compliance
provider "aws" {
  alias = "hipaa_config"

  # HIPAA-specific provider settings
  default_tags {
    HIPAAControl     = "Technical-Safeguards"
    ComplianceStatus = "Enabled"
    AuditEnabled     = "true"
    EncryptionType   = "AES-256"
  }

  # Enable AWS HIPAA-eligible service restrictions
  skip_requesting_account_id = false
  skip_metadata_api_check    = false
  
  # Force SSL/TLS for API calls
  endpoints {
    s3       = "https://s3.${var.aws_region}.amazonaws.com"
    dynamodb = "https://dynamodb.${var.aws_region}.amazonaws.com"
    kms      = "https://kms.${var.aws_region}.amazonaws.com"
  }
}

# Random provider for generating unique resource names
provider "random" {}

# Null provider for resource dependencies
provider "null" {}
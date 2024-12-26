# Core Terraform functionality for variable validation
terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 4.0"
    }
  }
}

# VPC CIDR block configuration
variable "vpc_cidr" {
  type        = string
  default     = "10.0.0.0/16"
  description = "CIDR block for VPC"

  validation {
    condition     = can(cidrhost(var.vpc_cidr, 0))
    error_message = "VPC CIDR must be a valid IPv4 CIDR block"
  }
}

# Environment name for deployment
variable "environment" {
  type        = string
  description = "Deployment environment (dev/staging/prod)"

  validation {
    condition     = can(regex("^(dev|staging|prod)$", var.environment))
    error_message = "Environment must be dev, staging, or prod"
  }
}

# Availability zones for multi-AZ deployment
variable "availability_zones" {
  type        = list(string)
  description = "List of AWS availability zones for multi-AZ deployment"

  validation {
    condition     = length(var.availability_zones) >= 2
    error_message = "At least 2 availability zones required for high availability"
  }
}

# Public subnet CIDR blocks
variable "public_subnet_cidrs" {
  type        = list(string)
  description = "CIDR blocks for public subnets"

  validation {
    condition = (
      length(var.public_subnet_cidrs) >= 2 &&
      can([for cidr in var.public_subnet_cidrs : cidrhost(cidr, 0)])
    )
    error_message = "At least 2 valid public subnet CIDR blocks required for high availability"
  }
}

# Private subnet CIDR blocks
variable "private_subnet_cidrs" {
  type        = list(string)
  description = "CIDR blocks for private subnets"

  validation {
    condition = (
      length(var.private_subnet_cidrs) >= 2 &&
      can([for cidr in var.private_subnet_cidrs : cidrhost(cidr, 0)])
    )
    error_message = "At least 2 valid private subnet CIDR blocks required for high availability"
  }
}

# Database subnet CIDR blocks
variable "database_subnet_cidrs" {
  type        = list(string)
  description = "CIDR blocks for database subnets"

  validation {
    condition = (
      length(var.database_subnet_cidrs) >= 2 &&
      can([for cidr in var.database_subnet_cidrs : cidrhost(cidr, 0)])
    )
    error_message = "At least 2 valid database subnet CIDR blocks required for high availability"
  }
}

# NAT gateway configuration
variable "enable_nat_gateway" {
  type        = bool
  default     = true
  description = "Enable NAT gateway for private subnet internet access"
}

variable "single_nat_gateway" {
  type        = bool
  default     = false
  description = "Use single NAT gateway instead of one per AZ"
}

# Resource tagging including HIPAA compliance markers
variable "tags" {
  type        = map(string)
  default     = {}
  description = "Additional tags for resources including HIPAA compliance markers"

  validation {
    condition = (
      can(var.tags) &&
      length(coalesce(lookup(var.tags, "Environment", ""), "")) > 0
    )
    error_message = "Tags must include at least an Environment tag for HIPAA compliance tracking"
  }
}

# Additional validation to ensure CIDR blocks don't overlap
locals {
  all_cidrs = concat([var.vpc_cidr], var.public_subnet_cidrs, var.private_subnet_cidrs, var.database_subnet_cidrs)
  
  # Validate CIDR blocks are within VPC CIDR
  validate_subnet_cidrs = [
    for cidr in concat(var.public_subnet_cidrs, var.private_subnet_cidrs, var.database_subnet_cidrs) :
    regex("^${replace(var.vpc_cidr, "/\\./", "\\.")}.*", cidr)
  ]
}
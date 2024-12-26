# Terraform variables for Prior Authorization Management System
# Version: 1.0
# HIPAA Compliance: Enabled
# Required Provider: hashicorp/terraform ~> 1.5

# Environment Configuration
variable "environment" {
  type        = string
  description = "Deployment environment (dev/staging/prod) with HIPAA compliance requirements"
  default     = "dev"

  validation {
    condition     = can(regex("^(dev|staging|prod)$", var.environment))
    error_message = "Environment must be dev, staging, or prod for compliance tracking."
  }
}

# AWS Region Configuration
variable "aws_region" {
  type        = string
  description = "Primary AWS region for deployment (must be HIPAA eligible)"
  default     = "us-east-1"

  validation {
    condition     = contains(["us-east-1", "us-west-2", "us-east-2"], var.aws_region)
    error_message = "Region must be HIPAA eligible (us-east-1, us-west-2, us-east-2)."
  }
}

# Networking Configuration
variable "vpc_cidr" {
  type        = string
  description = "CIDR block for VPC with proper network isolation"
  default     = "10.0.0.0/16"

  validation {
    condition     = can(cidrhost(var.vpc_cidr, 0)) && split("/", var.vpc_cidr)[1] <= 16
    error_message = "VPC CIDR must be a valid IPv4 block with sufficient address space."
  }
}

variable "availability_zones" {
  type        = list(string)
  description = "List of AZs for high availability deployment"
  default     = ["us-east-1a", "us-east-1b"]

  validation {
    condition     = length(var.availability_zones) >= 2
    error_message = "At least 2 AZs required for high availability."
  }
}

# Database Configuration
variable "rds_instance_class" {
  type        = string
  description = "RDS instance type with sufficient performance for HIPAA workloads"
  default     = "db.r6g.large"

  validation {
    condition     = can(regex("^db\\.(r6g|r5|t3)\\..*", var.rds_instance_class))
    error_message = "Must use approved RDS instance types for HIPAA workloads."
  }
}

variable "backup_retention_period" {
  type        = number
  description = "Number of days to retain RDS backups (HIPAA minimum 7 days)"
  default     = 30

  validation {
    condition     = var.backup_retention_period >= 7
    error_message = "Backup retention must be at least 7 days for HIPAA compliance."
  }
}

# Security Configuration
variable "enable_encryption" {
  type        = bool
  description = "Enable encryption for data at rest (required for HIPAA)"
  default     = true

  validation {
    condition     = var.enable_encryption == true
    error_message = "Encryption must be enabled for HIPAA compliance."
  }
}

# Monitoring Configuration
variable "ecs_container_insights" {
  type        = bool
  description = "Enable/disable ECS container insights monitoring for observability"
  default     = true
}

variable "monitoring_interval" {
  type        = number
  description = "CloudWatch monitoring interval in seconds"
  default     = 60

  validation {
    condition     = contains([1, 5, 10, 30, 60], var.monitoring_interval)
    error_message = "Monitoring interval must be 1, 5, 10, 30, or 60 seconds."
  }
}

# Additional HIPAA-Required Variables
variable "log_retention_days" {
  type        = number
  description = "Number of days to retain CloudWatch logs (HIPAA audit requirements)"
  default     = 365

  validation {
    condition     = var.log_retention_days >= 365
    error_message = "Log retention must be at least 365 days for HIPAA compliance."
  }
}

variable "ssl_policy" {
  type        = string
  description = "SSL policy for ALB HTTPS listeners (HIPAA security requirements)"
  default     = "ELBSecurityPolicy-TLS-1-2-2017-01"

  validation {
    condition     = can(regex("^ELBSecurityPolicy-TLS-1-2-.*", var.ssl_policy))
    error_message = "Must use TLS 1.2 or higher SSL policy for HIPAA compliance."
  }
}

variable "allowed_ip_ranges" {
  type        = list(string)
  description = "List of allowed IP ranges for VPC access"
  default     = []

  validation {
    condition     = alltrue([for ip in var.allowed_ip_ranges : can(cidrhost(ip, 0))])
    error_message = "All IP ranges must be valid CIDR blocks."
  }
}

variable "multi_az" {
  type        = bool
  description = "Enable Multi-AZ deployment for high availability (required for prod)"
  default     = true

  validation {
    condition     = var.environment != "prod" || var.multi_az == true
    error_message = "Multi-AZ must be enabled for production environment."
  }
}
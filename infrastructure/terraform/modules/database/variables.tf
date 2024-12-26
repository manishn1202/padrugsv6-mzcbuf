# RDS instance configuration
variable "db_instance_class" {
  type        = string
  default     = "db.r6g.xlarge"
  description = "RDS instance class for PostgreSQL database"

  validation {
    condition     = can(regex("^db\\.(t3|r6g|r6i)\\.", var.db_instance_class))
    error_message = "DB instance class must be a valid RDS instance type"
  }
}

variable "db_name" {
  type        = string
  description = "Name of the PostgreSQL database"

  validation {
    condition     = can(regex("^[a-zA-Z][a-zA-Z0-9_]*$", var.db_name))
    error_message = "Database name must start with a letter and contain only alphanumeric characters and underscores"
  }
}

# Security credentials
variable "db_username" {
  type        = string
  description = "Master username for database access"
  sensitive   = true

  validation {
    condition     = can(regex("^[a-zA-Z][a-zA-Z0-9_]*$", var.db_username))
    error_message = "Username must start with a letter and contain only alphanumeric characters and underscores"
  }
}

variable "db_password" {
  type        = string
  description = "Master password for database access"
  sensitive   = true

  validation {
    condition     = length(var.db_password) >= 16
    error_message = "Database password must be at least 16 characters long for HIPAA compliance"
  }
}

# Environment configuration
variable "environment" {
  type        = string
  description = "Deployment environment (dev/staging/prod)"

  validation {
    condition     = can(regex("^(dev|staging|prod)$", var.environment))
    error_message = "Environment must be dev, staging, or prod"
  }
}

# Network configuration
variable "private_subnet_ids" {
  type        = list(string)
  description = "List of private subnet IDs for RDS deployment"

  validation {
    condition     = length(var.private_subnet_ids) >= 2
    error_message = "At least two private subnets required for Multi-AZ deployment"
  }
}

# Backup and monitoring configuration
variable "backup_retention_period" {
  type        = number
  default     = 30
  description = "Number of days to retain automated backups"

  validation {
    condition     = var.backup_retention_period >= 7
    error_message = "Backup retention period must be at least 7 days for HIPAA compliance"
  }
}

variable "monitoring_interval" {
  type        = number
  default     = 60
  description = "Enhanced monitoring interval in seconds"

  validation {
    condition     = contains([0, 1, 5, 10, 15, 30, 60], var.monitoring_interval)
    error_message = "Monitoring interval must be 0, 1, 5, 10, 15, 30, or 60 seconds"
  }
}
# Terraform ~> 1.0

# Environment variable for deployment environment
variable "environment" {
  type        = string
  description = "Deployment environment (dev/staging/prod)"
  
  validation {
    condition     = can(regex("^(dev|staging|prod)$", var.environment))
    error_message = "Environment must be dev, staging, or prod"
  }
}

# Project name variable for resource naming and tagging
variable "project_name" {
  type        = string
  description = "Name of the project for resource naming and tagging"
  
  validation {
    condition     = can(regex("^[a-z0-9-]+$", var.project_name))
    error_message = "Project name must contain only lowercase letters, numbers, and hyphens"
  }
}

# CloudWatch log retention period
variable "log_retention_days" {
  type        = number
  description = "Number of days to retain CloudWatch logs"
  default     = 30

  validation {
    condition     = contains([1, 3, 5, 7, 14, 30, 60, 90, 120, 150, 180, 365, 400, 545, 731, 1827, 3653], var.log_retention_days)
    error_message = "Log retention days must be a valid CloudWatch retention period"
  }
}

# Alert notification email
variable "alert_email" {
  type        = string
  description = "Email address for monitoring alerts and notifications"
  
  validation {
    condition     = can(regex("^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}$", var.alert_email))
    error_message = "Must be a valid email address"
  }
}

# X-Ray tracing configuration
variable "enable_xray" {
  type        = bool
  description = "Enable X-Ray tracing for distributed tracing"
  default     = true
}

# Grafana admin credentials
variable "grafana_admin_password" {
  type        = string
  description = "Admin password for Grafana workspace access"
  sensitive   = true
  
  validation {
    condition     = can(regex("^.{12,}$", var.grafana_admin_password))
    error_message = "Grafana admin password must be at least 12 characters long"
  }
}
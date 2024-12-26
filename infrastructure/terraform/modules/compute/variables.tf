# Core deployment variables
variable "environment" {
  description = "Deployment environment (dev/staging/prod)"
  type        = string
  
  validation {
    condition     = contains(["dev", "staging", "prod"], var.environment)
    error_message = "Environment must be one of: dev, staging, prod."
  }
}

variable "aws_region" {
  description = "AWS region for resource deployment"
  type        = string
  default     = "us-east-1"
  
  validation {
    condition     = can(regex("^[a-z]{2}-[a-z]+-[0-9]{1}$", var.aws_region))
    error_message = "AWS region must be in valid format (e.g., us-east-1)."
  }
}

# Networking variables
variable "vpc_id" {
  description = "ID of the VPC where compute resources will be deployed"
  type        = string
  
  validation {
    condition     = can(regex("^vpc-[a-f0-9]{8,17}$", var.vpc_id))
    error_message = "VPC ID must be in valid format (vpc-...)."
  }
}

variable "private_subnet_ids" {
  description = "List of private subnet IDs for ECS tasks deployment across multiple AZs"
  type        = list(string)
  
  validation {
    condition     = length(var.private_subnet_ids) >= 2
    error_message = "At least 2 private subnets required for high availability."
  }
}

variable "public_subnet_ids" {
  description = "List of public subnet IDs for Application Load Balancer deployment"
  type        = list(string)
  
  validation {
    condition     = length(var.public_subnet_ids) >= 2
    error_message = "At least 2 public subnets required for ALB high availability."
  }
}

# IAM role variables
variable "ecs_task_execution_role_arn" {
  description = "ARN of IAM role for ECS task execution with required permissions for CloudWatch, ECR, and SSM"
  type        = string
  
  validation {
    condition     = can(regex("^arn:aws:iam::[0-9]{12}:role/.+$", var.ecs_task_execution_role_arn))
    error_message = "Task execution role ARN must be in valid format."
  }
}

variable "ecs_task_role_arn" {
  description = "ARN of IAM role for ECS tasks with permissions for S3, SQS, and other service integrations"
  type        = string
  
  validation {
    condition     = can(regex("^arn:aws:iam::[0-9]{12}:role/.+$", var.ecs_task_role_arn))
    error_message = "Task role ARN must be in valid format."
  }
}

# Container and service configuration
variable "container_port" {
  description = "Port exposed by the container for API traffic"
  type        = number
  default     = 8000
  
  validation {
    condition     = var.container_port > 0 && var.container_port < 65536
    error_message = "Container port must be between 1 and 65535."
  }
}

# Auto-scaling configuration optimized for 5000 PA requests per hour
variable "desired_count" {
  description = "Desired number of ECS tasks for normal operations"
  type        = number
  default     = 2
  
  validation {
    condition     = var.desired_count >= 2
    error_message = "Minimum of 2 tasks required for high availability."
  }
}

variable "min_capacity" {
  description = "Minimum number of ECS tasks for high availability"
  type        = number
  default     = 2
  
  validation {
    condition     = var.min_capacity >= 2
    error_message = "Minimum capacity must be at least 2 for high availability."
  }
}

variable "max_capacity" {
  description = "Maximum number of ECS tasks for peak load handling"
  type        = number
  default     = 10
  
  validation {
    condition     = var.max_capacity >= var.min_capacity
    error_message = "Maximum capacity must be greater than or equal to minimum capacity."
  }
}

# Resource allocation for optimal PA processing
variable "cpu" {
  description = "CPU units for ECS task optimized for PA processing"
  type        = number
  default     = 1024  # 1 vCPU
  
  validation {
    condition     = contains([256, 512, 1024, 2048, 4096], var.cpu)
    error_message = "CPU units must be one of: 256, 512, 1024, 2048, 4096."
  }
}

variable "memory" {
  description = "Memory (in MiB) for ECS task with optimal performance settings"
  type        = number
  default     = 2048  # 2GB
  
  validation {
    condition     = var.memory >= 512 && var.memory <= 30720
    error_message = "Memory must be between 512 MiB and 30720 MiB."
  }
}

# Health check configuration
variable "health_check_path" {
  description = "Path for ALB health checks with API version"
  type        = string
  default     = "/api/v1/health"
  
  validation {
    condition     = can(regex("^/[a-zA-Z0-9/-]+$", var.health_check_path))
    error_message = "Health check path must be a valid URL path."
  }
}

# HIPAA compliance and resource tagging
variable "tags" {
  description = "Resource tags including HIPAA compliance markers"
  type        = map(string)
  default = {
    Environment        = "var.environment"
    Project           = "PA-System"
    HIPAA             = "PHI"
    SecurityLevel     = "High"
    DataClassification = "Protected"
    ComplianceScope   = "HIPAA"
  }
  
  validation {
    condition     = contains(keys(var.tags), "HIPAA") && contains(keys(var.tags), "SecurityLevel")
    error_message = "Tags must include HIPAA and SecurityLevel markers for compliance."
  }
}

# Performance monitoring thresholds
variable "cpu_utilization_threshold" {
  description = "CPU utilization threshold percentage for auto-scaling"
  type        = number
  default     = 70
  
  validation {
    condition     = var.cpu_utilization_threshold > 0 && var.cpu_utilization_threshold <= 100
    error_message = "CPU utilization threshold must be between 1 and 100 percent."
  }
}

variable "memory_utilization_threshold" {
  description = "Memory utilization threshold percentage for auto-scaling"
  type        = number
  default     = 75
  
  validation {
    condition     = var.memory_utilization_threshold > 0 && var.memory_utilization_threshold <= 100
    error_message = "Memory utilization threshold must be between 1 and 100 percent."
  }
}
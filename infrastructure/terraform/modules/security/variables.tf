# Core Terraform functionality for variable validation
terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 1.5"
    }
  }
}

# Environment name for resource naming and tagging
variable "environment" {
  type        = string
  default     = "dev"
  description = "Deployment environment (dev/staging/prod)"

  validation {
    condition     = can(regex("^(dev|staging|prod)$", var.environment))
    error_message = "Environment must be dev, staging, or prod"
  }
}

# VPC ID for security group association
variable "vpc_id" {
  type        = string
  description = "VPC ID for security group placement"

  validation {
    condition     = can(regex("^vpc-[a-z0-9]{17}$", var.vpc_id))
    error_message = "VPC ID must be a valid AWS VPC identifier"
  }
}

# KMS key deletion window configuration
variable "kms_deletion_window" {
  type        = number
  default     = 30
  description = "Number of days before KMS key deletion"

  validation {
    condition     = var.kms_deletion_window >= 7 && var.kms_deletion_window <= 30
    error_message = "KMS key deletion window must be between 7 and 30 days for HIPAA compliance"
  }
}

# WAF protection configuration
variable "enable_waf" {
  type        = bool
  default     = true
  description = "Enable WAF protection (required for HIPAA compliance)"

  validation {
    condition     = var.environment == "prod" ? var.enable_waf == true : true
    error_message = "WAF protection must be enabled in production for HIPAA compliance"
  }
}

# WAF rate limiting configuration
variable "waf_rate_limit" {
  type        = number
  default     = 2000
  description = "Maximum requests per 5-minute period per IP"

  validation {
    condition     = var.waf_rate_limit >= 1000 && var.waf_rate_limit <= 10000
    error_message = "WAF rate limit must be between 1000 and 10000 requests per 5 minutes"
  }
}

# Security group ingress rules
variable "security_group_ingress_rules" {
  type = list(object({
    description = string
    from_port   = number
    to_port     = number
    protocol    = string
    cidr_blocks = list(string)
  }))
  description = "List of security group ingress rules"
  default = [
    {
      description = "HTTPS inbound"
      from_port   = 443
      to_port     = 443
      protocol    = "tcp"
      cidr_blocks = ["0.0.0.0/0"]
    }
  ]

  validation {
    condition = alltrue([
      for rule in var.security_group_ingress_rules :
      rule.protocol == "tcp" || rule.protocol == "udp" || rule.protocol == "-1"
    ])
    error_message = "Protocol must be tcp, udp, or -1 (all)"
  }
}

# KMS key administrators
variable "kms_admin_principals" {
  type        = list(string)
  description = "List of IAM principals allowed to administer KMS keys"
  default     = []

  validation {
    condition = alltrue([
      for principal in var.kms_admin_principals :
      can(regex("^arn:aws:(iam|sts)::\\d{12}:(user|role)/[\\w+=,.@-]+$", principal))
    ])
    error_message = "KMS admin principals must be valid IAM ARNs"
  }
}

# Resource tags including HIPAA compliance markers
variable "tags" {
  type = map(string)
  default = {
    Compliance          = "HIPAA"
    Environment         = "var.environment"
    SecurityLevel       = "HIGH"
    DataClassification = "PHI"
  }
  description = "Resource tags for security and compliance tracking"

  validation {
    condition     = contains(keys(var.tags), "Compliance") && contains(keys(var.tags), "DataClassification")
    error_message = "Tags must include Compliance and DataClassification for HIPAA requirements"
  }
}

# WAF IP rate limiting exemptions
variable "waf_ip_rate_limit_exemptions" {
  type        = list(string)
  description = "List of IP addresses exempt from WAF rate limiting"
  default     = []

  validation {
    condition = alltrue([
      for ip in var.waf_ip_rate_limit_exemptions :
      can(regex("^\\d{1,3}\\.\\d{1,3}\\.\\d{1,3}\\.\\d{1,3}/\\d{1,2}$", ip))
    ])
    error_message = "WAF IP exemptions must be valid CIDR blocks"
  }
}

# KMS key rotation configuration
variable "enable_kms_key_rotation" {
  type        = bool
  default     = true
  description = "Enable automatic KMS key rotation (required for HIPAA compliance)"

  validation {
    condition     = var.environment == "prod" ? var.enable_kms_key_rotation == true : true
    error_message = "KMS key rotation must be enabled in production for HIPAA compliance"
  }
}
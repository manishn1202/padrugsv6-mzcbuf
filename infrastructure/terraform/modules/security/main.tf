# Core provider configuration
terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.0"
    }
  }
}

# Application Security Group with strict HIPAA-compliant rules
resource "aws_security_group" "app" {
  name        = "${var.environment}-app-sg"
  description = "HIPAA-compliant security group for application containers"
  vpc_id      = var.vpc_id

  # HTTPS inbound only
  ingress {
    description = "HTTPS inbound"
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  # Application health check
  ingress {
    description = "Health check port"
    from_port   = 8080
    to_port     = 8080
    protocol    = "tcp"
    cidr_blocks = [data.aws_vpc.selected.cidr_block]
  }

  # Restrict outbound traffic
  egress {
    description = "HTTPS outbound"
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  egress {
    description = "Database access"
    from_port   = 5432
    to_port     = 5432
    protocol    = "tcp"
    security_groups = [aws_security_group.db.id]
  }

  tags = merge(var.tags, {
    Name        = "${var.environment}-app-sg"
    Environment = var.environment
    Compliance  = "HIPAA"
  })
}

# Database Security Group with strict access controls
resource "aws_security_group" "db" {
  name        = "${var.environment}-db-sg"
  description = "HIPAA-compliant security group for RDS database"
  vpc_id      = var.vpc_id

  # Allow inbound from application security group only
  ingress {
    description     = "PostgreSQL from application"
    from_port       = 5432
    to_port         = 5432
    protocol        = "tcp"
    security_groups = [aws_security_group.app.id]
  }

  # No direct outbound internet access
  egress {
    description = "Allow response traffic"
    from_port   = 5432
    to_port     = 5432
    protocol    = "tcp"
    security_groups = [aws_security_group.app.id]
  }

  tags = merge(var.tags, {
    Name        = "${var.environment}-db-sg"
    Environment = var.environment
    Compliance  = "HIPAA"
  })
}

# KMS key for data encryption with automatic rotation
resource "aws_kms_key" "main" {
  description             = "HIPAA-compliant KMS key for encrypting sensitive data"
  deletion_window_in_days = var.kms_deletion_window
  enable_key_rotation     = var.enable_kms_key_rotation
  multi_region           = true
  
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "Enable IAM User Permissions"
        Effect = "Allow"
        Principal = {
          AWS = concat(
            ["arn:aws:iam::${data.aws_caller_identity.current.account_id}:root"],
            var.kms_admin_principals
          )
        }
        Action   = "kms:*"
        Resource = "*"
      },
      {
        Sid    = "Allow service-linked role use"
        Effect = "Allow"
        Principal = {
          AWS = var.kms_admin_principals
        }
        Action = [
          "kms:Encrypt",
          "kms:Decrypt",
          "kms:ReEncrypt*",
          "kms:GenerateDataKey*",
          "kms:DescribeKey"
        ]
        Resource = "*"
      }
    ]
  })

  tags = merge(var.tags, {
    Name        = "${var.environment}-kms-key"
    Environment = var.environment
    Compliance  = "HIPAA"
  })
}

# WAF Web ACL with OWASP Top 10 protection
resource "aws_wafv2_web_acl" "main" {
  name        = "${var.environment}-web-acl"
  description = "HIPAA-compliant WAF rules for application protection"
  scope       = "REGIONAL"

  default_action {
    allow {}
  }

  # SQL injection protection
  rule {
    name     = "SQLInjectionProtection"
    priority = 1

    override_action {
      none {}
    }

    statement {
      managed_rule_group_statement {
        name        = "AWSManagedRulesSQLiRuleSet"
        vendor_name = "AWS"
      }
    }

    visibility_config {
      cloudwatch_metrics_enabled = true
      metric_name               = "SQLInjectionProtectionMetric"
      sampled_requests_enabled  = true
    }
  }

  # Cross-site scripting protection
  rule {
    name     = "XSSProtection"
    priority = 2

    override_action {
      none {}
    }

    statement {
      managed_rule_group_statement {
        name        = "AWSManagedRulesCommonRuleSet"
        vendor_name = "AWS"
      }
    }

    visibility_config {
      cloudwatch_metrics_enabled = true
      metric_name               = "XSSProtectionMetric"
      sampled_requests_enabled  = true
    }
  }

  # Rate limiting
  rule {
    name     = "RateLimiting"
    priority = 3

    action {
      block {}
    }

    statement {
      rate_based_statement {
        limit              = var.waf_rate_limit
        aggregate_key_type = "IP"
      }
    }

    visibility_config {
      cloudwatch_metrics_enabled = true
      metric_name               = "RateLimitingMetric"
      sampled_requests_enabled  = true
    }
  }

  visibility_config {
    cloudwatch_metrics_enabled = true
    metric_name               = "WAFWebACLMetric"
    sampled_requests_enabled  = true
  }

  tags = merge(var.tags, {
    Name        = "${var.environment}-waf-acl"
    Environment = var.environment
    Compliance  = "HIPAA"
  })
}

# Data sources
data "aws_vpc" "selected" {
  id = var.vpc_id
}

data "aws_caller_identity" "current" {}

# Outputs
output "app_security_group_id" {
  value       = aws_security_group.app.id
  description = "Security group ID for application containers"
}

output "db_security_group_id" {
  value       = aws_security_group.db.id
  description = "Security group ID for RDS database"
}

output "kms_key_arn" {
  value       = aws_kms_key.main.arn
  description = "ARN of KMS key for data encryption"
}

output "waf_acl_id" {
  value       = aws_wafv2_web_acl.main.id
  description = "ID of WAF web ACL"
}
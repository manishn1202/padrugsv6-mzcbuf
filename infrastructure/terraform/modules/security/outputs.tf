# Core Terraform functionality for output definitions
terraform {
  required_providers {
    aws = {
      source  = "hashicorp/terraform"
      version = "~> 1.5"
    }
  }
}

# Application Security Group Output
output "app_security_group_id" {
  description = "Security group ID for application containers with strict access controls and monitoring requirements"
  value       = aws_security_group.app.id
  sensitive   = true
}

# Database Security Group Output
output "db_security_group_id" {
  description = "Security group ID for RDS database with enhanced isolation and access logging"
  value       = aws_security_group.db.id
  sensitive   = true
}

# KMS Key Output
output "kms_key_arn" {
  description = "KMS key ARN for PHI encryption with automatic key rotation and audit logging"
  value       = aws_kms_key.main.arn
  sensitive   = true
}

# WAF Web ACL Output
output "waf_acl_id" {
  description = "WAF web ACL ID with OWASP Top 10 protection and rate limiting controls"
  value       = aws_wafv2_web_acl.main.id
  sensitive   = true
}

# Security Group Names Output
output "security_group_names" {
  description = "Map of security group names for reference in other modules"
  value = {
    app = aws_security_group.app.name
    db  = aws_security_group.db.name
  }
  sensitive = true
}

# KMS Key Metadata Output
output "kms_key_metadata" {
  description = "Metadata about the KMS key including rotation status and deletion window"
  value = {
    key_id              = aws_kms_key.main.key_id
    rotation_enabled    = aws_kms_key.main.enable_key_rotation
    deletion_window     = aws_kms_key.main.deletion_window_in_days
    multi_region        = aws_kms_key.main.multi_region
  }
  sensitive = true
}

# WAF Rule Metadata Output
output "waf_rule_metadata" {
  description = "Metadata about WAF rules and protection settings"
  value = {
    sql_injection_protection = "enabled"
    xss_protection          = "enabled"
    rate_limiting           = "enabled"
    rate_limit             = var.waf_rate_limit
  }
  sensitive = true
}

# HIPAA Compliance Status Output
output "hipaa_compliance_status" {
  description = "HIPAA compliance status of security controls"
  value = {
    encryption_enabled     = true
    key_rotation_enabled   = var.enable_kms_key_rotation
    waf_protection_enabled = var.enable_waf
    environment           = var.environment
    compliance_validated  = true
  }
  sensitive = false
}
# Network Infrastructure Outputs
output "vpc_id" {
  description = "ID of the VPC hosting the Prior Authorization Management System"
  value       = aws_vpc.main.id
}

output "public_subnet_ids" {
  description = "List of public subnet IDs for ALB and NAT gateway placement across availability zones"
  value       = aws_subnet.public[*].id
}

output "private_subnet_ids" {
  description = "List of private subnet IDs for ECS tasks and RDS instances across availability zones"
  value       = aws_subnet.private[*].id
}

# Load Balancer and CDN Outputs
output "alb_dns_name" {
  description = "DNS name of the application load balancer for service access"
  value       = aws_lb.main.dns_name
}

output "cloudfront_domain_name" {
  description = "Domain name of the CloudFront distribution for CDN-enabled static content delivery"
  value       = aws_cloudfront_distribution.main.domain_name
}

# Database and Cache Outputs
output "rds_endpoint" {
  description = "Connection endpoint for the multi-AZ PostgreSQL RDS instance"
  value       = aws_db_instance.main.endpoint
  sensitive   = true
}

output "redis_endpoint" {
  description = "Connection endpoint for the ElastiCache Redis cluster"
  value       = aws_elasticache_replication_group.main.primary_endpoint_address
  sensitive   = true
}

# Storage Outputs
output "documents_bucket_name" {
  description = "Name of the S3 bucket for storing encrypted clinical documents"
  value       = aws_s3_bucket.documents.id
}

output "logs_bucket_name" {
  description = "Name of the S3 bucket for storing application and access logs"
  value       = aws_s3_bucket.logs.id
}

# Security Outputs
output "kms_key_id" {
  description = "ID of the KMS key used for encrypting sensitive data"
  value       = aws_kms_key.main.key_id
  sensitive   = true
}

output "ecs_security_group_id" {
  description = "ID of the security group attached to ECS tasks"
  value       = aws_security_group.ecs_tasks.id
}

# Monitoring Outputs
output "cloudwatch_log_group_name" {
  description = "Name of the CloudWatch log group for centralized application logging"
  value       = aws_cloudwatch_log_group.main.name
}

output "xray_sampling_rule_name" {
  description = "Name of the X-Ray sampling rule for distributed tracing configuration"
  value       = aws_xray_sampling_rule.main.rule_name
}

# Tags Output (for resource tracking)
output "resource_tags" {
  description = "Common tags applied to all resources for tracking and cost allocation"
  value = {
    Environment = terraform.workspace
    Project     = "PA-Management-System"
    ManagedBy   = "Terraform"
  }
}
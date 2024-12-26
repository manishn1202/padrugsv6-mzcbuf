# Connection endpoint outputs
output "db_endpoint" {
  description = "RDS instance connection endpoint for application configuration"
  value       = aws_db_instance.main.endpoint
}

output "db_arn" {
  description = "RDS instance ARN for IAM and monitoring configuration"
  value       = aws_db_instance.main.arn
}

output "db_identifier" {
  description = "RDS instance identifier for resource referencing"
  value       = aws_db_instance.main.id
}

output "db_name" {
  description = "Database name for application connection configuration"
  value       = aws_db_instance.main.db_name
}

output "db_port" {
  description = "PostgreSQL database port for application connection configuration"
  value       = 5432
}

# Monitoring and high availability outputs
output "db_monitoring_role_arn" {
  description = "IAM role ARN for enhanced monitoring configuration"
  value       = aws_db_instance.main.monitoring_role_arn
}

output "db_availability_zone" {
  description = "Availability zone where the primary RDS instance is deployed"
  value       = aws_db_instance.main.availability_zone
}

output "db_subnet_group_id" {
  description = "ID of the database subnet group for network configuration"
  value       = aws_db_instance.main.db_subnet_group_name
}

output "db_resource_id" {
  description = "The RDS Resource ID for CloudWatch and performance monitoring"
  value       = aws_db_instance.main.resource_id
}

output "db_backup_retention_period" {
  description = "Number of days automated backups are retained"
  value       = aws_db_instance.main.backup_retention_period
}

output "db_multi_az" {
  description = "Whether the RDS instance is configured for high availability (Multi-AZ)"
  value       = aws_db_instance.main.multi_az
}

output "db_performance_insights_enabled" {
  description = "Whether Performance Insights is enabled for the RDS instance"
  value       = aws_db_instance.main.performance_insights_enabled
}

output "db_storage_encrypted" {
  description = "Whether the RDS storage is encrypted for HIPAA compliance"
  value       = aws_db_instance.main.storage_encrypted
}

output "db_engine_version" {
  description = "PostgreSQL engine version running on the RDS instance"
  value       = aws_db_instance.main.engine_version
}
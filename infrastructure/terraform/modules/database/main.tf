# Provider configuration and version constraints
terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

# Local variables for common values
locals {
  project_name = "prior-auth-system"
  common_tags = {
    Environment = var.environment
    ManagedBy   = "terraform"
    Project     = local.project_name
    Compliance  = "HIPAA"
  }
}

# DB subnet group for RDS deployment in private subnets
resource "aws_db_subnet_group" "main" {
  name        = "${var.environment}-${local.project_name}-db-subnet-group"
  subnet_ids  = var.private_subnet_ids
  description = "Private subnet group for ${var.environment} RDS instance"

  tags = merge(local.common_tags, {
    Name = "${var.environment}-${local.project_name}-db-subnet-group"
  })
}

# Primary RDS PostgreSQL instance with HIPAA-compliant configuration
resource "aws_db_instance" "main" {
  identifier = "${var.environment}-${local.project_name}-db"

  # Engine configuration
  engine         = "postgres"
  engine_version = "15.4"
  instance_class = var.db_instance_class
  
  # Storage configuration
  allocated_storage     = 100
  max_allocated_storage = 1000
  storage_type         = "gp3"
  storage_encrypted    = true
  kms_key_id          = module.security.kms_key_arn

  # Database configuration
  db_name  = var.db_name
  username = var.db_username
  password = var.db_password
  port     = 5432

  # Network configuration
  db_subnet_group_name   = aws_db_subnet_group.main.name
  vpc_security_group_ids = [module.security.db_security_group_id]
  multi_az              = true
  publicly_accessible   = false

  # Backup configuration
  backup_retention_period = var.backup_retention_period
  backup_window          = "03:00-04:00"
  maintenance_window     = "Mon:04:00-Mon:05:00"
  copy_tags_to_snapshot  = true
  skip_final_snapshot    = false
  final_snapshot_identifier = "${var.environment}-${local.project_name}-db-final"

  # Monitoring and performance configuration
  monitoring_interval             = var.monitoring_interval
  monitoring_role_arn            = module.security.cloudwatch_role_arn
  performance_insights_enabled    = true
  performance_insights_retention_period = 7
  enabled_cloudwatch_logs_exports = ["postgresql", "upgrade"]

  # Parameter group configuration
  parameter_group_name = "default.postgres15"

  # Security configuration
  iam_database_authentication_enabled = true
  deletion_protection                 = true
  auto_minor_version_upgrade         = true

  # HIPAA-compliant parameters
  apply_immediately = false

  tags = merge(local.common_tags, {
    Name        = "${var.environment}-${local.project_name}-db"
    Backup      = "Required"
    Encryption  = "Required"
    MultiAZ     = "Enabled"
    Monitoring  = "Enhanced"
  })

  # Lifecycle policies
  lifecycle {
    prevent_destroy = true
    ignore_changes = [
      password,
      snapshot_identifier
    ]
  }

  # Dependencies
  depends_on = [
    aws_db_subnet_group.main
  ]
}

# Outputs for use by other modules
output "db_instance_endpoint" {
  description = "The connection endpoint for the RDS instance"
  value       = aws_db_instance.main.endpoint
}

output "db_instance_arn" {
  description = "The ARN of the RDS instance"
  value       = aws_db_instance.main.arn
}

output "db_instance_id" {
  description = "The ID of the RDS instance"
  value       = aws_db_instance.main.id
}

output "db_resource_id" {
  description = "The RDS Resource ID"
  value       = aws_db_instance.main.resource_id
}

output "db_subnet_group_id" {
  description = "The ID of the DB subnet group"
  value       = aws_db_subnet_group.main.id
}
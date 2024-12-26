# Production Environment Configuration
# Version: 1.0
# HIPAA Compliance: Enabled
# Last Updated: 2024

# Environment Identifier
environment = "prod"

# Regional Configuration
aws_region = "us-east-1"
availability_zones = [
  "us-east-1a",
  "us-east-1b",
  "us-east-1c"
]

# Networking Configuration
vpc_cidr = "10.0.0.0/16"  # Large CIDR block for production scale
allowed_ip_ranges = [
  "10.0.0.0/8",    # Internal corporate network
  "172.16.0.0/12"  # VPN ranges
]

# Database Configuration
rds_instance_class = "db.r6g.2xlarge"  # Memory-optimized for high performance
backup_retention_period = 35  # Extended retention for compliance
multi_az = true
deletion_protection = true
performance_insights_enabled = true
monitoring_interval = 30  # Enhanced monitoring interval in seconds

# Security Configuration
enable_encryption = true  # Mandatory for HIPAA compliance
ssl_policy = "ELBSecurityPolicy-TLS-1-2-2017-01"  # TLS 1.2 requirement

# Monitoring Configuration
ecs_container_insights = true  # Enhanced container monitoring
log_retention_days = 365  # HIPAA audit requirement

# High Availability Settings
auto_scaling_min_capacity = 2
auto_scaling_max_capacity = 10
auto_scaling_target_cpu = 70
auto_scaling_target_memory = 80

# Performance Optimization
alb_idle_timeout = 60
connection_draining_timeout = 300
health_check_interval = 30

# Backup Configuration
enable_automated_backups = true
backup_window = "03:00-04:00"
maintenance_window = "Mon:04:00-Mon:05:00"

# Enhanced Monitoring
detailed_monitoring_enabled = true
create_monitoring_role = true
monitoring_role_name = "rds-enhanced-monitoring-prod"

# HIPAA Compliance Tags
tags = {
  Environment     = "prod"
  DataSensitivity = "phi"
  HIPAAWorkload   = "true"
  Backup          = "required"
  Encryption      = "required"
  BusinessUnit    = "healthcare"
  CostCenter      = "pa-management"
}
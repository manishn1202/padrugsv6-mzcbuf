# Environment Configuration
environment = "staging"
aws_region = "us-east-1"

# Networking Configuration
vpc_cidr = "10.1.0.0/16"
availability_zones = [
  "us-east-1a",
  "us-east-1b",
  "us-east-1c"
]

# Database Configuration
rds_instance_class = "db.r6g.xlarge"
backup_retention_period = 14
multi_az = true

# Security Configuration
enable_encryption = true
ssl_policy = "ELBSecurityPolicy-TLS-1-2-2017-01"
allowed_ip_ranges = [
  "10.1.0.0/16"  # VPC CIDR for internal access
]

# Monitoring Configuration
ecs_container_insights = true
monitoring_interval = 60
log_retention_days = 365

# Additional HIPAA-Compliant Settings
# Subnet Configuration for 3 AZs
private_subnet_cidrs = [
  "10.1.1.0/24",
  "10.1.2.0/24",
  "10.1.3.0/24"
]
public_subnet_cidrs = [
  "10.1.11.0/24",
  "10.1.12.0/24",
  "10.1.13.0/24"
]
database_subnet_cidrs = [
  "10.1.21.0/24",
  "10.1.22.0/24",
  "10.1.23.0/24"
]

# ECS Configuration
ecs_task_cpu = 2048
ecs_task_memory = 4096
ecs_min_capacity = 2
ecs_max_capacity = 8
ecs_target_cpu_utilization = 75

# RDS Configuration
rds_allocated_storage = 100
rds_max_allocated_storage = 500
rds_engine_version = "15.3"
rds_parameter_family = "postgres15"

# Backup Configuration
enable_automated_backups = true
backup_window = "03:00-04:00"
maintenance_window = "Mon:04:00-Mon:05:00"

# WAF Configuration
enable_waf = true
waf_block_period = 240
waf_rate_limit = 2000

# CloudWatch Alarms
cpu_utilization_threshold = 80
memory_utilization_threshold = 80
db_connections_threshold = 100
api_5xx_error_threshold = 5
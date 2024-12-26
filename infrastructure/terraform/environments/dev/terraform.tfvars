# Development Environment Configuration
# Version: 1.0
# HIPAA Compliance: Enabled
# Last Updated: 2024

# Environment Identifier
environment = "dev"
aws_account_id = "123456789012"  # Development AWS account
aws_region = "us-east-1"         # Primary development region

# Network Configuration
vpc_cidr = "10.0.0.0/16"         # Development VPC CIDR
availability_zones = ["us-east-1a"] # Single AZ for dev cost optimization
multi_az = false                  # Disable multi-AZ for development

# Database Configuration
rds_instance_class = "db.t3.medium"  # Cost-effective development instance
backup_retention_period = 7           # Minimum HIPAA-compliant retention
multi_az_database = false            # Single AZ database for development

# Security Configuration
enable_encryption = true             # Mandatory HIPAA encryption
ssl_policy = "ELBSecurityPolicy-TLS-1-2-2017-01"  # HIPAA-compliant TLS policy
allowed_ip_ranges = [
  "10.0.0.0/8",      # Internal development networks
  "172.16.0.0/12"    # VPN networks
]

# Monitoring Configuration
ecs_container_insights = true        # Enable container monitoring
monitoring_interval = 60             # 1-minute monitoring interval
log_retention_days = 365            # HIPAA-compliant log retention

# Resource Sizing - Development Optimized
ecs_task_cpu = 256                  # Reduced CPU allocation
ecs_task_memory = 512               # Reduced memory allocation
asg_min_size = 1                    # Minimum instance count
asg_max_size = 2                    # Maximum instance count
asg_desired_capacity = 1            # Desired instance count

# Storage Configuration
storage_encrypted = true            # HIPAA-required encryption
storage_type = "gp3"               # Cost-effective storage type
allocated_storage = 20             # Minimum storage for development

# Tags
default_tags = {
  Environment = "dev"
  Project     = "prior-auth-mgmt"
  HIPAA       = "enabled"
  ManagedBy   = "terraform"
  CostCenter  = "development"
}

# Feature Flags
enable_waf = true                  # Web Application Firewall
enable_shield = false              # Disable advanced DDoS protection in dev
enable_guardduty = true           # Enable threat detection
enable_backup = true              # Enable automated backups

# Performance Configuration
performance_insights_enabled = true    # Enable RDS performance insights
performance_insights_retention = 7     # 7-day retention for dev environment
auto_minor_version_upgrade = true     # Enable automatic minor upgrades

# Cache Configuration
elasticache_node_type = "cache.t3.micro"  # Development cache instance
elasticache_num_cache_nodes = 1           # Single cache node for dev

# Load Balancer Configuration
alb_idle_timeout = 60                     # 60-second idle timeout
enable_deletion_protection = false         # Allow deletion in dev environment
enable_cross_zone_load_balancing = true   # Enable cross-zone balancing

# Backup Windows
backup_window = "03:00-04:00"             # 3-4 AM UTC backup window
maintenance_window = "Mon:04:00-Mon:05:00" # Monday 4-5 AM UTC maintenance
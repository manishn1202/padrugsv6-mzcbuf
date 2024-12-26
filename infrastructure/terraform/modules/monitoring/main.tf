# Provider configuration with required versions
terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 4.0"
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.0"
    }
  }
}

# Local values for resource naming and tagging
locals {
  resource_prefix = "${var.project_name}-${var.environment}"
  
  common_tags = {
    Environment     = var.environment
    Project         = var.project_name
    ManagedBy      = "terraform"
    SecurityLevel   = "hipaa-compliant"
    DataSensitivity = "phi"
  }

  # Monitoring thresholds
  monitoring_config = {
    api_latency_threshold     = var.environment == "prod" ? 3000 : 5000 # milliseconds
    error_rate_threshold      = var.environment == "prod" ? 0.001 : 0.01 # 0.1% in prod
    memory_threshold_percent  = 80
    cpu_threshold_percent    = 70
  }
}

# KMS key for log encryption
resource "aws_kms_key" "log_key" {
  description             = "KMS key for CloudWatch Logs encryption"
  deletion_window_in_days = 7
  enable_key_rotation     = true
  
  tags = merge(local.common_tags, {
    Name = "${local.resource_prefix}-log-encryption"
  })
}

# CloudWatch Log Group with encryption
resource "aws_cloudwatch_log_group" "main" {
  name              = "/aws/${local.resource_prefix}/logs"
  retention_in_days = var.log_retention_days
  kms_key_id        = aws_kms_key.log_key.arn
  
  tags = local.common_tags
}

# X-Ray configuration if enabled
resource "aws_xray_sampling_rule" "main" {
  count = var.enable_xray ? 1 : 0
  
  rule_name      = "${local.resource_prefix}-sampling"
  priority       = 1000
  reservoir_size = 1
  fixed_rate     = 0.05
  host           = "*"
  http_method    = "*"
  service_name   = "*"
  service_type   = "*"
  url_path       = "*"
  version        = 1
}

# Managed Prometheus Workspace
resource "aws_prometheus_workspace" "main" {
  alias = "${local.resource_prefix}-prometheus"
  
  logging_configuration {
    log_group_arn = "${aws_cloudwatch_log_group.main.arn}:*"
  }
  
  tags = local.common_tags
}

# Security group for Grafana
resource "aws_security_group" "grafana" {
  name_prefix = "${local.resource_prefix}-grafana-"
  description = "Security group for Grafana workspace"
  vpc_id      = var.vpc_id
  
  ingress {
    from_port   = 3000
    to_port     = 3000
    protocol    = "tcp"
    cidr_blocks = var.allowed_grafana_cidr_blocks
  }
  
  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
  
  tags = local.common_tags
}

# Managed Grafana Workspace
resource "aws_grafana_workspace" "main" {
  name                  = "${local.resource_prefix}-grafana"
  account_access_type   = "CURRENT_ACCOUNT"
  authentication_providers = ["AWS_SSO"]
  permission_type       = "SERVICE_MANAGED"
  
  data_sources = ["PROMETHEUS", "CLOUDWATCH", "XRAY"]
  
  vpc_configuration {
    subnet_ids         = var.private_subnet_ids
    security_group_ids = [aws_security_group.grafana.id]
  }
  
  tags = local.common_tags
}

# CloudWatch Alarms for SLA monitoring
resource "aws_cloudwatch_metric_alarm" "api_latency" {
  alarm_name          = "${local.resource_prefix}-api-latency"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 2
  metric_name        = "Duration"
  namespace          = "AWS/ApiGateway"
  period             = 300
  statistic          = "Average"
  threshold          = local.monitoring_config.api_latency_threshold
  alarm_description  = "API latency exceeds threshold"
  alarm_actions      = [aws_sns_topic.alerts.arn]
  
  tags = local.common_tags
}

# SNS Topic for alerts
resource "aws_sns_topic" "alerts" {
  name = "${local.resource_prefix}-monitoring-alerts"
  kms_master_key_id = aws_kms_key.log_key.id
  
  tags = local.common_tags
}

resource "aws_sns_topic_subscription" "alerts_email" {
  topic_arn = aws_sns_topic.alerts.arn
  protocol  = "email"
  endpoint  = var.alert_email
}

# CloudWatch Dashboard for system metrics
resource "aws_cloudwatch_dashboard" "main" {
  dashboard_name = "${local.resource_prefix}-system-metrics"
  
  dashboard_body = jsonencode({
    widgets = [
      {
        type = "metric"
        properties = {
          metrics = [
            ["AWS/ApiGateway", "Latency", "ApiName", "${local.resource_prefix}-api"]
          ]
          period = 300
          stat   = "Average"
          title  = "API Latency"
        }
      },
      {
        type = "metric"
        properties = {
          metrics = [
            ["AWS/ApiGateway", "5XXError", "ApiName", "${local.resource_prefix}-api"]
          ]
          period = 300
          stat   = "Sum"
          title  = "API Errors"
        }
      }
    ]
  })
}
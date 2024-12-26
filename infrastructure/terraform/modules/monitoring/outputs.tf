# CloudWatch Log Group ARN output
output "cloudwatch_log_group_arn" {
  description = "ARN of the CloudWatch log group for application logging"
  value       = aws_cloudwatch_log_group.main.arn
}

# Prometheus workspace endpoint output
output "prometheus_workspace_endpoint" {
  description = "Endpoint URL for the managed Prometheus workspace"
  value       = aws_prometheus_workspace.main.prometheus_endpoint
}

# Grafana workspace endpoint output
output "grafana_workspace_endpoint" {
  description = "Endpoint URL for the managed Grafana workspace"
  value       = aws_grafana_workspace.main.endpoint
}

# SNS topic ARN for monitoring alerts
output "alarm_topic_arn" {
  description = "ARN of the SNS topic for monitoring alerts and notifications"
  value       = aws_sns_topic.alerts.arn
}

# X-Ray sampling rule ARN (if enabled)
output "xray_sampling_rule_arn" {
  description = "ARN of the X-Ray sampling rule for distributed tracing"
  value       = var.enable_xray ? aws_xray_sampling_rule.main[0].arn : null
}

# CloudWatch dashboard name
output "cloudwatch_dashboard_name" {
  description = "Name of the CloudWatch dashboard for system metrics visualization"
  value       = aws_cloudwatch_dashboard.main.dashboard_name
}

# KMS key ARN for log encryption
output "log_encryption_key_arn" {
  description = "ARN of the KMS key used for CloudWatch Logs encryption"
  value       = aws_kms_key.log_key.arn
}

# Grafana workspace security group ID
output "grafana_security_group_id" {
  description = "ID of the security group attached to the Grafana workspace"
  value       = aws_security_group.grafana.id
}

# API latency alarm ARN
output "api_latency_alarm_arn" {
  description = "ARN of the CloudWatch alarm monitoring API latency"
  value       = aws_cloudwatch_metric_alarm.api_latency.arn
}

# Monitoring configuration values
output "monitoring_thresholds" {
  description = "Configured monitoring thresholds for the environment"
  value = {
    api_latency     = local.monitoring_config.api_latency_threshold
    error_rate      = local.monitoring_config.error_rate_threshold
    memory_percent  = local.monitoring_config.memory_threshold_percent
    cpu_percent     = local.monitoring_config.cpu_threshold_percent
  }
}
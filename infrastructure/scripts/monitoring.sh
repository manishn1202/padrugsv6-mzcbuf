#!/bin/bash

# Prior Authorization Management System - Monitoring Infrastructure Setup Script
# Version: 1.0
# HIPAA Compliance: Enabled
# Dependencies:
# - aws-cli v2.0+
# - jq v1.6+
# - openssl v1.1+

set -euo pipefail

# Global Constants
readonly LOG_RETENTION_DAYS=2555  # 7 years for HIPAA compliance
readonly STACK_NAME="${ENVIRONMENT}-pa-system-monitoring"
readonly PROMETHEUS_PORT=9090
readonly GRAFANA_PORT=3000
readonly SECURITY_SCAN_INTERVAL=3600
readonly MAX_RETRY_ATTEMPTS=3
readonly ENCRYPTION_ALGORITHM="AES-256-GCM"
readonly COMPLIANCE_CHECK_INTERVAL=43200

# Logging Functions
log_info() {
    echo "[INFO] $(date '+%Y-%m-%d %H:%M:%S') - $1"
}

log_error() {
    echo "[ERROR] $(date '+%Y-%m-%d %H:%M:%S') - $1" >&2
}

log_audit() {
    local message="$1"
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    aws logs put-log-events \
        --log-group-name "${STACK_NAME}-audit-logs" \
        --log-stream-name "monitoring-audit" \
        --log-events timestamp=${timestamp},message="$message"
}

# Validation Functions
validate_environment() {
    local env="$1"
    if [[ ! "$env" =~ ^(dev|staging|prod)$ ]]; then
        log_error "Invalid environment: $env. Must be dev, staging, or prod"
        return 1
    fi
}

validate_kms_key() {
    local key_id="$1"
    aws kms describe-key --key-id "$key_id" >/dev/null || {
        log_error "Invalid KMS key ID or insufficient permissions"
        return 1
    }
}

# Setup Monitoring Infrastructure
setup_monitoring() {
    local environment="$1"
    local region="$2"
    local kms_key_id="$3"
    local retention_period="${4:-$LOG_RETENTION_DAYS}"

    log_info "Starting monitoring setup for environment: $environment"
    
    # Validate inputs
    validate_environment "$environment" || return 1
    validate_kms_key "$kms_key_id" || return 1

    # Deploy CloudFormation stack
    aws cloudformation deploy \
        --template-file ../cloudformation/monitoring.yml \
        --stack-name "$STACK_NAME" \
        --parameter-overrides \
            Environment="$environment" \
            RetentionDays="$retention_period" \
        --capabilities CAPABILITY_NAMED_IAM \
        --tags Environment="$environment" HIPAA=true

    # Configure CloudWatch Log Groups
    setup_log_groups "$environment" "$kms_key_id"

    # Setup X-Ray tracing
    configure_xray "$environment" "$kms_key_id"

    # Setup Prometheus metrics
    setup_prometheus "$environment"

    # Setup Grafana dashboards
    setup_grafana "$environment"

    # Enable security monitoring
    enable_security_monitoring "$environment" "$region"

    # Verify HIPAA compliance
    verify_compliance "$environment"

    log_audit "Monitoring infrastructure setup completed for $environment"
    log_info "Monitoring setup completed successfully"
}

# Configure CloudWatch Alarms
configure_alarms() {
    local environment="$1"
    local alert_email="$2"
    local sns_kms_key_id="$3"
    local alarm_thresholds="$4"

    log_info "Configuring monitoring alarms for environment: $environment"

    # Create encrypted SNS topic
    local topic_arn=$(aws sns create-topic \
        --name "${STACK_NAME}-alerts" \
        --attributes KmsMasterKeyId="$sns_kms_key_id")

    # Subscribe to alerts
    aws sns subscribe \
        --topic-arn "$topic_arn" \
        --protocol email \
        --notification-endpoint "$alert_email"

    # Configure performance alarms
    setup_performance_alarms "$environment" "$topic_arn" "$alarm_thresholds"

    # Configure security alarms
    setup_security_alarms "$environment" "$topic_arn"

    # Configure compliance alarms
    setup_compliance_alarms "$environment" "$topic_arn"

    log_audit "Alarm configuration completed for $environment"
    log_info "Alarms configured successfully"
}

# Health Check Function
check_health() {
    local environment="$1"
    local detailed_check="${2:-false}"

    log_info "Starting health check for environment: $environment"

    local health_status=0

    # Check CloudWatch logs
    check_cloudwatch_health "$environment" || health_status=1

    # Check X-Ray traces
    check_xray_health "$environment" || health_status=1

    # Check Prometheus metrics
    check_prometheus_health "$environment" || health_status=1

    # Check Grafana
    check_grafana_health "$environment" || health_status=1

    # Check Security Hub
    check_security_hub_health "$environment" || health_status=1

    if [[ "$detailed_check" == "true" ]]; then
        # Additional detailed checks
        check_encryption_status "$environment" || health_status=1
        check_compliance_status "$environment" || health_status=1
        generate_health_report "$environment"
    fi

    log_audit "Health check completed for $environment with status: $health_status"
    return $health_status
}

# Helper Functions
setup_log_groups() {
    local environment="$1"
    local kms_key_id="$2"

    aws logs create-log-group \
        --log-group-name "${STACK_NAME}-application-logs" \
        --kms-key-id "$kms_key_id"

    aws logs create-log-group \
        --log-group-name "${STACK_NAME}-audit-logs" \
        --kms-key-id "$kms_key_id"

    aws logs put-retention-policy \
        --log-group-name "${STACK_NAME}-application-logs" \
        --retention-in-days "$LOG_RETENTION_DAYS"

    aws logs put-retention-policy \
        --log-group-name "${STACK_NAME}-audit-logs" \
        --retention-in-days "$LOG_RETENTION_DAYS"
}

setup_performance_alarms() {
    local environment="$1"
    local topic_arn="$2"
    local thresholds="$3"

    # CPU Utilization Alarm
    aws cloudwatch put-metric-alarm \
        --alarm-name "${STACK_NAME}-cpu-utilization" \
        --metric-name CPUUtilization \
        --namespace AWS/ECS \
        --statistic Average \
        --period 300 \
        --threshold "$(echo "$thresholds" | jq -r '.cpu_threshold')" \
        --comparison-operator GreaterThanThreshold \
        --evaluation-periods 2 \
        --alarm-actions "$topic_arn"

    # API Latency Alarm
    aws cloudwatch put-metric-alarm \
        --alarm-name "${STACK_NAME}-api-latency" \
        --metric-name Latency \
        --namespace AWS/ApiGateway \
        --statistic p95 \
        --period 300 \
        --threshold 3000 \
        --comparison-operator GreaterThanThreshold \
        --evaluation-periods 2 \
        --alarm-actions "$topic_arn"
}

setup_security_alarms() {
    local environment="$1"
    local topic_arn="$2"

    aws cloudwatch put-metric-alarm \
        --alarm-name "${STACK_NAME}-security-events" \
        --metric-name SecurityEventCount \
        --namespace AWS/SecurityHub \
        --statistic Sum \
        --period 300 \
        --threshold 1 \
        --comparison-operator GreaterThanThreshold \
        --evaluation-periods 1 \
        --alarm-actions "$topic_arn"
}

verify_compliance() {
    local environment="$1"

    # Verify encryption settings
    aws kms list-keys --query 'Keys[*].KeyId' --output text | while read -r key_id; do
        aws kms get-key-rotation-status --key-id "$key_id" || return 1
    done

    # Verify log retention
    aws logs describe-log-groups \
        --query "logGroups[?contains(logGroupName, '${STACK_NAME}')]" \
        --output text | while read -r log_group; do
        local retention=$(aws logs describe-log-groups \
            --log-group-name "$log_group" \
            --query 'logGroups[0].retentionInDays')
        [[ $retention -ge $LOG_RETENTION_DAYS ]] || return 1
    done
}

# Main execution guard
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    log_info "Script must be sourced for function usage"
    exit 1
fi
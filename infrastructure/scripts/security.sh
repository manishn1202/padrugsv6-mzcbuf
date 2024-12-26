#!/bin/bash

# security.sh
# HIPAA-compliant security controls validation and configuration script
# Version: 1.0.0
# aws-cli version: 2.0+
# jq version: 1.6+

set -euo pipefail

# Global Variables
readonly AWS_REGION=${AWS_REGION:-"us-east-1"}
readonly ENVIRONMENT=${ENVIRONMENT:-"dev"}
readonly LOG_FILE="/var/log/security-checks.log"
readonly SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
readonly CORRELATION_ID=$(uuidgen)

# Compliance thresholds based on environment
declare -A COMPLIANCE_THRESHOLDS
COMPLIANCE_THRESHOLDS=(
    ["dev"]="0.8"
    ["staging"]="0.9"
    ["prod"]="0.95"
)

# Notification endpoints
readonly NOTIFICATION_ENDPOINTS='{
    "email": ["security-team@example.com"],
    "slack": "https://hooks.slack.com/services/YOUR_WEBHOOK",
    "sns": "arn:aws:sns:us-east-1:123456789012:security-alerts"
}'

# Logging functions
log() {
    local level=$1
    local message=$2
    local timestamp=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
    local log_entry=$(jq -n \
        --arg timestamp "$timestamp" \
        --arg level "$level" \
        --arg message "$message" \
        --arg correlation_id "$CORRELATION_ID" \
        --arg environment "$ENVIRONMENT" \
        '{timestamp: $timestamp, level: $level, message: $message, correlation_id: $correlation_id, environment: $environment}')
    
    echo "$log_entry" | tee -a "$LOG_FILE"
}

info() { log "INFO" "$1"; }
warn() { log "WARN" "$1"; }
error() { log "ERROR" "$1"; }

# Error handling
handle_error() {
    local exit_code=$?
    local line_number=$1
    error "Error on line $line_number: Exit code $exit_code"
    send_notification "CRITICAL" "Security check failed on line $line_number with exit code $exit_code"
    exit $exit_code
}

trap 'handle_error ${LINENO}' ERR

# Notification function
send_notification() {
    local severity=$1
    local message=$2
    local timestamp=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

    # Format notification payload
    local payload=$(jq -n \
        --arg severity "$severity" \
        --arg message "$message" \
        --arg timestamp "$timestamp" \
        --arg correlation_id "$CORRELATION_ID" \
        '{severity: $severity, message: $message, timestamp: $timestamp, correlation_id: $correlation_id}')

    # Send to configured notification channels
    if [[ -n "${NOTIFICATION_ENDPOINTS}" ]]; then
        # SNS notification
        aws sns publish \
            --topic-arn "$(echo $NOTIFICATION_ENDPOINTS | jq -r .sns)" \
            --message "$payload" \
            --region "$AWS_REGION" || warn "Failed to send SNS notification"
    fi
}

# KMS encryption validation
check_kms_encryption() {
    local environment=$1
    local key_alias=$2
    info "Checking KMS encryption configuration for environment: $environment"

    # Check KMS key existence and configuration
    local key_info
    key_info=$(aws kms describe-key \
        --key-id "alias/${key_alias}" \
        --region "$AWS_REGION" 2>/dev/null) || {
        error "KMS key alias/${key_alias} not found"
        return 1
    }

    # Validate key rotation
    local rotation_enabled
    rotation_enabled=$(aws kms get-key-rotation-status \
        --key-id "$(echo "$key_info" | jq -r .KeyMetadata.KeyId)" \
        --region "$AWS_REGION" | jq -r .KeyRotationEnabled)

    if [[ "$rotation_enabled" != "true" && "$environment" == "prod" ]]; then
        error "KMS key rotation not enabled for production key"
        return 1
    fi

    # Check encryption settings for RDS
    local rds_encrypted
    rds_encrypted=$(aws rds describe-db-instances \
        --region "$AWS_REGION" \
        --query 'DBInstances[?DBInstanceIdentifier==`'"${environment}"'-db`].StorageEncrypted' \
        --output text)

    if [[ "$rds_encrypted" != "true" ]]; then
        error "RDS encryption not enabled for environment: $environment"
        return 1
    }

    info "KMS encryption validation passed for environment: $environment"
    return 0
}

# Security group validation
validate_security_groups() {
    local environment=$1
    local vpc_id=$2
    info "Validating security group configuration for VPC: $vpc_id"

    # Get security groups
    local security_groups
    security_groups=$(aws ec2 describe-security-groups \
        --filters "Name=vpc-id,Values=$vpc_id" \
        --region "$AWS_REGION")

    # Check for overly permissive rules
    local permissive_rules
    permissive_rules=$(echo "$security_groups" | jq -r '.SecurityGroups[] | 
        select(.IpPermissions[].IpRanges[].CidrIp == "0.0.0.0/0" and 
        (.IpPermissions[].FromPort == 0 or .IpPermissions[].ToPort == 0))')

    if [[ -n "$permissive_rules" ]]; then
        error "Found overly permissive security group rules in VPC: $vpc_id"
        echo "$permissive_rules" | jq '.'
        return 1
    }

    # Validate against CIS benchmarks
    local cis_compliant=true
    local sg_rules
    sg_rules=$(echo "$security_groups" | jq -r '.SecurityGroups[].IpPermissions[]')

    # Check for restricted ports
    local restricted_ports=(3389 22 23 21)
    for port in "${restricted_ports[@]}"; do
        if echo "$sg_rules" | jq -e --arg port "$port" \
            'select(.FromPort <= ($port|tonumber) and .ToPort >= ($port|tonumber))' >/dev/null; then
            warn "Found security group rule allowing restricted port: $port"
            cis_compliant=false
        fi
    done

    if [[ "$cis_compliant" == "false" && "$environment" == "prod" ]]; then
        error "Security groups do not meet CIS benchmark requirements in production"
        return 1
    }

    info "Security group validation passed for VPC: $vpc_id"
    return 0
}

# Generate compliance report
generate_compliance_report() {
    local environment=$1
    info "Generating compliance report for environment: $environment"

    local report_data
    report_data=$(jq -n \
        --arg timestamp "$(date -u +"%Y-%m-%dT%H:%M:%SZ")" \
        --arg environment "$environment" \
        --arg correlation_id "$CORRELATION_ID" \
        '{
            timestamp: $timestamp,
            environment: $environment,
            correlation_id: $correlation_id,
            checks: {
                kms_encryption: null,
                security_groups: null,
                waf_rules: null,
                iam_roles: null
            },
            compliance_score: 0,
            recommendations: []
        }')

    # Perform checks and update report
    local checks_passed=0
    local total_checks=4

    # KMS Check
    if check_kms_encryption "$environment" "${environment}-key" >/dev/null 2>&1; then
        checks_passed=$((checks_passed + 1))
        report_data=$(echo "$report_data" | jq '.checks.kms_encryption = "PASSED"')
    else
        report_data=$(echo "$report_data" | jq '.checks.kms_encryption = "FAILED"')
        report_data=$(echo "$report_data" | jq '.recommendations += ["Enable KMS key rotation and encryption for all sensitive data"]')
    fi

    # Security Groups Check
    if validate_security_groups "$environment" "vpc-example" >/dev/null 2>&1; then
        checks_passed=$((checks_passed + 1))
        report_data=$(echo "$report_data" | jq '.checks.security_groups = "PASSED"')
    else
        report_data=$(echo "$report_data" | jq '.checks.security_groups = "FAILED"')
        report_data=$(echo "$report_data" | jq '.recommendations += ["Review and restrict security group rules according to least privilege principle"]')
    fi

    # Calculate compliance score
    local compliance_score=$(echo "scale=2; $checks_passed / $total_checks" | bc)
    report_data=$(echo "$report_data" | jq --arg score "$compliance_score" '.compliance_score = ($score|tonumber)')

    # Check against threshold
    local threshold=${COMPLIANCE_THRESHOLDS[$environment]}
    if (( $(echo "$compliance_score < $threshold" | bc -l) )); then
        error "Compliance score ($compliance_score) below threshold ($threshold) for environment: $environment"
        send_notification "CRITICAL" "Compliance score below threshold in $environment environment"
    fi

    # Save report
    local report_file="/var/log/security/compliance-${environment}-$(date +%Y%m%d).json"
    echo "$report_data" | jq '.' > "$report_file"
    info "Compliance report generated: $report_file"

    return 0
}

# Main execution
main() {
    info "Starting security validation for environment: $ENVIRONMENT"

    # Create log directory if it doesn't exist
    mkdir -p "$(dirname "$LOG_FILE")"
    mkdir -p "/var/log/security"

    # Run security checks
    check_kms_encryption "$ENVIRONMENT" "${ENVIRONMENT}-key" || exit 1
    validate_security_groups "$ENVIRONMENT" "vpc-example" || exit 1
    generate_compliance_report "$ENVIRONMENT" || exit 1

    info "Security validation completed successfully"
    return 0
}

# Execute main function
main "$@"
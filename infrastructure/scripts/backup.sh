#!/bin/bash

# backup.sh - HIPAA-compliant backup management script
# Version: 1.0.0
# Dependencies:
# - aws-cli v2.0+
# - postgresql-client v15.4

set -euo pipefail

# Global Configuration
AWS_REGION="us-east-1"
DR_REGION="us-west-2"
BACKUP_BUCKET="hipaa-compliant-pa-backups"
DR_BACKUP_BUCKET="hipaa-compliant-pa-backups-dr"
DB_INSTANCE="pa-production-db"
RETENTION_DAYS=30
DOCUMENT_RETENTION_YEARS=7
MAX_RETRY_ATTEMPTS=3
BACKUP_TIMEOUT=3600

# Logging Configuration
LOG_GROUP="/pa-system/backups"
TIMESTAMP=$(date +%Y-%m-%d-%H-%M-%S)
SCRIPT_NAME=$(basename "$0")

# Initialize logging
setup_logging() {
    aws logs create-log-stream \
        --log-group-name "$LOG_GROUP" \
        --log-stream-name "backup-$TIMESTAMP" || true
}

log() {
    local level="$1"
    local message="$2"
    local timestamp=$(date -u +"%Y-%m-%dT%H:%M:%S.000Z")
    
    aws logs put-log-events \
        --log-group-name "$LOG_GROUP" \
        --log-stream-name "backup-$TIMESTAMP" \
        --log-events timestamp=$(($(date +%s%N)/1000000)),message="[$level] $message"
}

# Validation Functions
validate_encryption() {
    local snapshot_id="$1"
    local region="$2"
    
    encryption_status=$(aws rds describe-db-snapshots \
        --db-snapshot-identifier "$snapshot_id" \
        --region "$region" \
        --query 'DBSnapshots[0].Encrypted' \
        --output text)
    
    if [ "$encryption_status" != "true" ]; then
        log "ERROR" "Snapshot $snapshot_id is not encrypted"
        return 1
    fi
    return 0
}

validate_snapshot() {
    local snapshot_id="$1"
    local region="$2"
    
    status=$(aws rds describe-db-snapshots \
        --db-snapshot-identifier "$snapshot_id" \
        --region "$region" \
        --query 'DBSnapshots[0].Status' \
        --output text)
    
    if [ "$status" != "available" ]; then
        log "ERROR" "Snapshot $snapshot_id validation failed: status=$status"
        return 1
    fi
    return 0
}

# Backup Functions
backup_database() {
    local snapshot_id="snapshot-$DB_INSTANCE-$TIMESTAMP"
    local start_time=$(date +%s)
    
    log "INFO" "Starting database backup: instance=$DB_INSTANCE snapshot=$snapshot_id"
    
    # Create snapshot
    aws rds create-db-snapshot \
        --db-instance-identifier "$DB_INSTANCE" \
        --db-snapshot-identifier "$snapshot_id" \
        --tags Key=Retention,Value="$RETENTION_DAYS" \
              Key=HIPAA,Value="PHI" \
              Key=BackupType,Value="Automated" || {
        log "ERROR" "Failed to create snapshot $snapshot_id"
        return 1
    }
    
    # Wait for snapshot completion
    while true; do
        current_time=$(date +%s)
        if [ $((current_time - start_time)) -gt "$BACKUP_TIMEOUT" ]; then
            log "ERROR" "Snapshot creation timed out after $BACKUP_TIMEOUT seconds"
            return 2
        fi
        
        status=$(aws rds describe-db-snapshots \
            --db-snapshot-identifier "$snapshot_id" \
            --query 'DBSnapshots[0].Status' \
            --output text)
            
        if [ "$status" = "available" ]; then
            break
        elif [ "$status" = "failed" ]; then
            log "ERROR" "Snapshot creation failed"
            return 1
        fi
        
        sleep 30
    done
    
    # Validate encryption and snapshot
    validate_encryption "$snapshot_id" "$AWS_REGION" || return 1
    validate_snapshot "$snapshot_id" "$AWS_REGION" || return 1
    
    # Trigger cross-region replication
    replicate_backup "$snapshot_id" || return 1
    
    log "INFO" "Database backup completed successfully: snapshot=$snapshot_id"
    return 0
}

replicate_backup() {
    local snapshot_id="$1"
    local dr_snapshot_id="dr-$snapshot_id"
    local attempts=0
    
    log "INFO" "Starting cross-region replication: snapshot=$snapshot_id"
    
    # Copy snapshot to DR region
    aws rds copy-db-snapshot \
        --source-db-snapshot-identifier "$snapshot_id" \
        --target-db-snapshot-identifier "$dr_snapshot_id" \
        --source-region "$AWS_REGION" \
        --region "$DR_REGION" \
        --copy-tags || {
        log "ERROR" "Failed to initiate snapshot replication"
        return 1
    }
    
    # Wait for replication completion
    while [ $attempts -lt $MAX_RETRY_ATTEMPTS ]; do
        status=$(aws rds describe-db-snapshots \
            --db-snapshot-identifier "$dr_snapshot_id" \
            --region "$DR_REGION" \
            --query 'DBSnapshots[0].Status' \
            --output text)
            
        if [ "$status" = "available" ]; then
            break
        elif [ "$status" = "failed" ]; then
            log "ERROR" "Snapshot replication failed"
            return 1
        fi
        
        attempts=$((attempts + 1))
        sleep 60
    done
    
    # Validate DR snapshot
    validate_encryption "$dr_snapshot_id" "$DR_REGION" || return 1
    validate_snapshot "$dr_snapshot_id" "$DR_REGION" || return 1
    
    log "INFO" "Cross-region replication completed: dr_snapshot=$dr_snapshot_id"
    return 0
}

backup_documents() {
    log "INFO" "Starting document backup to S3"
    
    # Sync documents with encryption and checksums
    aws s3 sync "s3://$BACKUP_BUCKET" "s3://$DR_BACKUP_BUCKET" \
        --sse aws:kms \
        --sse-kms-key-id alias/hipaa-backup-key \
        --source-region "$AWS_REGION" \
        --region "$DR_REGION" \
        --metadata retention="$DOCUMENT_RETENTION_YEARS" \
        --metadata hipaa="PHI" || {
        log "ERROR" "Document backup failed"
        return 1
    }
    
    # Generate backup manifest
    aws s3api list-objects-v2 \
        --bucket "$DR_BACKUP_BUCKET" \
        --query 'Contents[].{Key:Key,ETag:ETag,Size:Size}' \
        --output json > "manifest-$TIMESTAMP.json"
    
    # Upload manifest
    aws s3 cp "manifest-$TIMESTAMP.json" \
        "s3://$DR_BACKUP_BUCKET/manifests/manifest-$TIMESTAMP.json" \
        --sse aws:kms \
        --sse-kms-key-id alias/hipaa-backup-key \
        --metadata retention="$DOCUMENT_RETENTION_YEARS"
    
    rm "manifest-$TIMESTAMP.json"
    
    log "INFO" "Document backup completed successfully"
    return 0
}

cleanup_old_backups() {
    local cutoff_date=$(date -d "$RETENTION_DAYS days ago" +%Y-%m-%d)
    
    log "INFO" "Starting cleanup of expired backups before $cutoff_date"
    
    # List expired snapshots
    expired_snapshots=$(aws rds describe-db-snapshots \
        --query "DBSnapshots[?SnapshotCreateTime<='$cutoff_date'].[DBSnapshotIdentifier]" \
        --output text)
    
    for snapshot in $expired_snapshots; do
        # Check for legal holds
        tags=$(aws rds list-tags-for-resource \
            --resource-name "$snapshot" \
            --query 'TagList[?Key==`LegalHold`].Value' \
            --output text)
            
        if [ "$tags" = "true" ]; then
            log "INFO" "Skipping snapshot $snapshot due to legal hold"
            continue
        fi
        
        # Delete snapshot
        aws rds delete-db-snapshot \
            --db-snapshot-identifier "$snapshot" || {
            log "ERROR" "Failed to delete snapshot $snapshot"
            continue
        }
        
        log "INFO" "Deleted expired snapshot $snapshot"
    done
    
    log "INFO" "Backup cleanup completed"
    return 0
}

# Main execution
main() {
    setup_logging
    
    log "INFO" "Starting backup process"
    
    # Database backup
    backup_database || {
        log "ERROR" "Database backup failed"
        exit 1
    }
    
    # Document backup
    backup_documents || {
        log "ERROR" "Document backup failed"
        exit 1
    }
    
    # Cleanup old backups
    cleanup_old_backups || {
        log "WARN" "Backup cleanup failed but continuing"
    }
    
    log "INFO" "Backup process completed successfully"
    exit 0
}

# Execute main function
main
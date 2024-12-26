"""
HIPAA-compliant logging module for Prior Authorization Management System.
Implements secure logging with CloudWatch integration, PHI masking, and structured formats.

Version: 1.0.0
"""

import logging  # version: 3.11+
import watchtower  # version: 3.0.0
import boto3  # version: 1.26.0
import json  # version: 3.11+
import re  # version: 3.11+
import threading  # version: 3.11+
from typing import Dict, List, Optional, Any
from datetime import datetime

from config.settings import APP_SETTINGS

# Global logger instance
LOGGER = logging.getLogger(__name__)

# Default log format with request tracing
DEFAULT_LOG_FORMAT = "%(asctime)s - %(name)s - %(levelname)s - %(message)s - %(request_id)s"

# HIPAA sensitive fields that should be masked in logs
HIPAA_SENSITIVE_FIELDS = [
    "patient_name", "dob", "ssn", "mrn", "address", 
    "phone", "email", "insurance_id"
]

# Regular expression patterns for identifying sensitive data
PHI_PATTERNS = {
    "ssn": r"\d{3}-\d{2}-\d{4}",
    "phone": r"\d{3}-\d{3}-\d{4}",
    "email": r"[^@]+@[^@]+\.[^@]+"
}

# CloudWatch batch settings
LOG_BATCH_SIZE = 100
LOG_FLUSH_INTERVAL = 5  # seconds

class HIPAACompliantFormatter(logging.Formatter):
    """
    Custom log formatter that masks sensitive PHI data in log messages.
    Implements caching and performance optimizations for pattern matching.
    """
    
    def __init__(self, fmt: str = None, sensitive_fields: List[str] = None,
                 mask_char: str = "*", mask_length: int = 8):
        """
        Initialize the HIPAA-compliant formatter.
        
        Args:
            fmt: Log format string
            sensitive_fields: List of fields to mask
            mask_char: Character to use for masking
            mask_length: Length of masked output
        """
        super().__init__(fmt or DEFAULT_LOG_FORMAT)
        self.sensitive_fields = sensitive_fields or HIPAA_SENSITIVE_FIELDS
        self.mask_char = mask_char
        self.mask_length = mask_length
        self.compiled_patterns = {
            field: re.compile(pattern) for field, pattern in PHI_PATTERNS.items()
        }
        self._pattern_cache = {}
        self._local = threading.local()

    def format(self, record: logging.LogRecord) -> str:
        """
        Format the log record with PHI masking.
        
        Args:
            record: Log record to format
            
        Returns:
            Formatted log message with masked PHI
        """
        # Add request context if available
        if not hasattr(record, 'request_id'):
            record.request_id = getattr(self._local, 'request_id', 'no-request-id')

        # Format the message
        if isinstance(record.msg, dict):
            message = json.dumps(self.mask_sensitive_data(record.msg))
        else:
            message = self.mask_sensitive_data(str(record.msg))

        record.msg = message
        return super().format(record)

    def mask_sensitive_data(self, message: Any) -> Any:
        """
        Recursively mask sensitive PHI data in the message.
        
        Args:
            message: Message to mask
            
        Returns:
            Message with masked sensitive data
        """
        if isinstance(message, dict):
            return {k: self.mask_sensitive_data(v) for k, v in message.items()}
        elif isinstance(message, list):
            return [self.mask_sensitive_data(item) for item in message]
        elif not isinstance(message, str):
            return message

        # Check cache first
        cache_key = hash(message)
        if cache_key in self._pattern_cache:
            return self._pattern_cache[cache_key]

        masked_message = message
        # Mask sensitive fields
        for field in self.sensitive_fields:
            if field in masked_message.lower():
                pattern = self.compiled_patterns.get(field)
                if pattern:
                    masked_message = pattern.sub(
                        self.mask_char * self.mask_length,
                        masked_message
                    )

        # Cache the result
        self._pattern_cache[cache_key] = masked_message
        return masked_message


class CloudWatchHandler(watchtower.CloudWatchLogHandler):
    """
    Custom CloudWatch handler with HIPAA compliance and performance optimization.
    Implements batching, encryption, and error handling.
    """
    
    def __init__(self, log_group: str, log_stream: str, kms_key_id: str,
                 batch_size: int = LOG_BATCH_SIZE,
                 flush_interval: int = LOG_FLUSH_INTERVAL):
        """
        Initialize the CloudWatch handler.
        
        Args:
            log_group: CloudWatch log group name
            log_stream: CloudWatch log stream name
            kms_key_id: KMS key ID for encryption
            batch_size: Number of logs to batch before sending
            flush_interval: Interval in seconds to flush logs
        """
        self.kms_key_id = kms_key_id
        self.batch_size = batch_size
        self.flush_interval = flush_interval
        
        # Initialize AWS clients
        self.kms_client = boto3.client('kms')
        
        super().__init__(
            log_group=log_group,
            stream_name=log_stream,
            use_queues=True,
            send_interval=flush_interval,
            create_log_group=False
        )

        # Set up batching
        self.buffer = []
        self.buffer_lock = threading.Lock()
        self._setup_flush_timer()

    def emit(self, record: logging.LogRecord) -> None:
        """
        Emit a log record to CloudWatch with encryption.
        
        Args:
            record: Log record to emit
        """
        try:
            # Format the record
            formatted_msg = self.format(record)
            
            # Encrypt the message
            encrypted_msg = self.kms_client.encrypt(
                KeyId=self.kms_key_id,
                Plaintext=formatted_msg.encode()
            )['CiphertextBlob']

            with self.buffer_lock:
                self.buffer.append({
                    'timestamp': int(record.created * 1000),
                    'message': encrypted_msg,
                    'level': record.levelname
                })

                if len(self.buffer) >= self.batch_size:
                    self.flush_buffer()

        except Exception as e:
            self.handleError(record)
            LOGGER.error(f"Failed to emit log to CloudWatch: {str(e)}")

    def flush_buffer(self) -> None:
        """Flush the buffer of logs to CloudWatch"""
        with self.buffer_lock:
            if not self.buffer:
                return

            try:
                self.queues[self.stream_name].extend(self.buffer)
                self.buffer.clear()
            except Exception as e:
                LOGGER.error(f"Failed to flush logs to CloudWatch: {str(e)}")

    def _setup_flush_timer(self) -> None:
        """Set up timer for periodic buffer flushing"""
        def flush_timer():
            self.flush_buffer()
            threading.Timer(self.flush_interval, flush_timer).start()
        
        threading.Timer(self.flush_interval, flush_timer).start()


def setup_logging(
    app_name: str,
    log_level: str = 'INFO',
    enable_cloudwatch: bool = True,
    additional_config: Dict = None
) -> None:
    """
    Set up application-wide logging configuration.
    
    Args:
        app_name: Name of the application
        log_level: Logging level
        enable_cloudwatch: Whether to enable CloudWatch logging
        additional_config: Additional logging configuration
    """
    # Create root logger
    root_logger = logging.getLogger()
    root_logger.setLevel(log_level)

    # Create HIPAA-compliant formatter
    formatter = HIPAACompliantFormatter()

    # Console handler
    console_handler = logging.StreamHandler()
    console_handler.setFormatter(formatter)
    root_logger.addHandler(console_handler)

    # CloudWatch handler
    if enable_cloudwatch:
        cloudwatch_handler = CloudWatchHandler(
            log_group=APP_SETTINGS['CLOUDWATCH_LOG_GROUP'],
            log_stream=f"{app_name}-{datetime.utcnow().strftime('%Y-%m-%d')}",
            kms_key_id=APP_SETTINGS['AWS_KMS_KEY_ID']
        )
        cloudwatch_handler.setFormatter(formatter)
        root_logger.addHandler(cloudwatch_handler)

    # Apply additional configuration
    if additional_config:
        logging.config.dictConfig(additional_config)

    LOGGER.info(f"Logging configured for {app_name} at level {log_level}")


def get_request_logger(request_id: str, context: Dict = None) -> logging.Logger:
    """
    Get a thread-safe logger instance with request context.
    
    Args:
        request_id: Request ID for tracing
        context: Additional context information
        
    Returns:
        Logger instance with request context
    """
    logger = logging.getLogger('request')
    
    # Store request context in thread-local storage
    thread_local = threading.local()
    thread_local.request_id = request_id
    thread_local.context = context or {}

    # Add request context to all log records
    class ContextFilter(logging.Filter):
        def filter(self, record):
            record.request_id = request_id
            for key, value in thread_local.context.items():
                setattr(record, key, value)
            return True

    logger.addFilter(ContextFilter())
    return logger
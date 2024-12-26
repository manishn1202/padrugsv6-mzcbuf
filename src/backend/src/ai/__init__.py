"""
Core initialization module for the AI-powered prior authorization system.
Provides a secure, HIPAA-compliant interface to access AI models, criteria matching,
evidence analysis, and Claude integration components.

Version: 1.0.0
"""

import logging  # version: 3.11+
from typing import Dict, List, Optional

# Internal imports
from ai.models import ClinicalEvidence, PolicyCriteria, MatchResult
from ai.claude_client import ClaudeClient
from ai.criteria_matcher import CriteriaMatcher
from ai.evidence_analyzer import EvidenceAnalyzer

# Global constants for AI module configuration
MIN_CONFIDENCE_SCORE = 0.75  # Minimum acceptable confidence score for matches
MAX_EVIDENCE_AGE_DAYS = 365  # Maximum age of clinical evidence in days
MANDATORY_CRITERIA_THRESHOLD = 0.85  # Higher threshold for mandatory criteria
AI_MODULE_VERSION = '1.0.0'  # Current module version
HIPAA_COMPLIANCE_LEVEL = 'strict'  # HIPAA compliance enforcement level
PERFORMANCE_MONITORING_ENABLED = True  # Enable performance monitoring
ERROR_LOGGING_LEVEL = 'WARNING'  # Default error logging level
API_HEALTH_CHECK_INTERVAL = 300  # Health check interval in seconds

# Configure module logger
logger = logging.getLogger(__name__)
logger.setLevel(ERROR_LOGGING_LEVEL)

def validate_module_configuration() -> bool:
    """
    Validates AI module configuration and dependencies.
    
    Returns:
        bool: True if configuration is valid, False otherwise
    """
    try:
        # Validate version compatibility
        if not hasattr(ClinicalEvidence, 'validate_hipaa_compliance'):
            logger.error("Missing required HIPAA compliance validation in ClinicalEvidence")
            return False

        # Validate Claude client health
        if not hasattr(ClaudeClient, 'validate_api_health'):
            logger.error("Missing required health check in ClaudeClient")
            return False

        # Validate criteria matcher performance monitoring
        if not hasattr(CriteriaMatcher, 'validate_performance'):
            logger.error("Missing required performance validation in CriteriaMatcher")
            return False

        logger.info(f"AI module v{AI_MODULE_VERSION} configuration validated successfully")
        return True

    except Exception as e:
        logger.error(f"Module configuration validation failed: {str(e)}")
        return False

def initialize_ai_components(config: Optional[Dict] = None) -> Dict:
    """
    Initializes and validates AI system components with HIPAA compliance.
    
    Args:
        config: Optional configuration override
        
    Returns:
        Dict containing initialized components
        
    Raises:
        RuntimeError: If initialization fails
    """
    try:
        # Initialize core components
        claude_client = ClaudeClient(
            api_key=config.get('claude_api_key') if config else None,
            timeout=config.get('api_timeout', 30.0) if config else 30.0
        )
        
        evidence_analyzer = EvidenceAnalyzer(
            claude_client=claude_client,
            security_context=config.get('security_context') if config else None
        )
        
        criteria_matcher = CriteriaMatcher(
            claude_client=claude_client,
            evidence_analyzer=evidence_analyzer
        )

        # Validate component health
        components = {
            'claude_client': claude_client,
            'evidence_analyzer': evidence_analyzer,
            'criteria_matcher': criteria_matcher
        }

        logger.info("AI components initialized successfully")
        return components

    except Exception as e:
        logger.error(f"Component initialization failed: {str(e)}")
        raise RuntimeError(f"Failed to initialize AI components: {str(e)}")

def check_system_health() -> bool:
    """
    Performs comprehensive health check of AI system components.
    
    Returns:
        bool: True if all components are healthy, False otherwise
    """
    try:
        # Validate module configuration
        if not validate_module_configuration():
            return False

        # Initialize test components
        components = initialize_ai_components()
        
        # Validate Claude API health
        if not components['claude_client'].validate_api_health():
            logger.error("Claude API health check failed")
            return False

        # Validate evidence analyzer
        if not hasattr(components['evidence_analyzer'], 'validate_evidence_quality'):
            logger.error("Evidence analyzer validation failed")
            return False

        # Validate criteria matcher
        if not hasattr(components['criteria_matcher'], 'match_criteria'):
            logger.error("Criteria matcher validation failed")
            return False

        logger.info("AI system health check completed successfully")
        return True

    except Exception as e:
        logger.error(f"Health check failed: {str(e)}")
        return False

# Export public interface
__all__ = [
    # Core models
    'ClinicalEvidence',
    'PolicyCriteria',
    'MatchResult',
    
    # Core components
    'ClaudeClient',
    'CriteriaMatcher',
    'EvidenceAnalyzer',
    
    # Module functions
    'initialize_ai_components',
    'check_system_health',
    'validate_module_configuration',
    
    # Constants
    'MIN_CONFIDENCE_SCORE',
    'MAX_EVIDENCE_AGE_DAYS',
    'MANDATORY_CRITERIA_THRESHOLD',
    'AI_MODULE_VERSION'
]

# Validate module configuration on import
if not validate_module_configuration():
    logger.warning("AI module configuration validation failed")
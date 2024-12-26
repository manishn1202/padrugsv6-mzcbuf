"""
Database module initialization for Prior Authorization Management System.
Implements HIPAA-compliant database configuration with security controls,
performance optimizations, and comprehensive audit logging.

Version: 1.0.0
"""

import logging
from typing import Optional

# SQLAlchemy imports (v2.0+)
from sqlalchemy import create_engine, event
from sqlalchemy.engine import Engine
from sqlalchemy.orm import sessionmaker, scoped_session
from sqlalchemy.pool import QueuePool

# Import base and models
from db.base import Base, metadata
from db.models.users import User
from db.models.prior_auth import PriorAuthRequest
from db.models.clinical import ClinicalData, ClinicalEvidence

# Configure logging
logger = logging.getLogger(__name__)

# Global configuration flags
AUDIT_ENABLED = True
PHI_TRACKING_ENABLED = True
PERFORMANCE_MONITORING_ENABLED = True

# Database performance tuning parameters
POOL_SIZE = 20
MAX_OVERFLOW = 10
POOL_TIMEOUT = 30
POOL_RECYCLE = 3600  # 1 hour
STATEMENT_TIMEOUT = 30000  # 30 seconds in milliseconds

def initialize_db(engine: Engine, audit_enabled: bool = True) -> None:
    """
    Initialize database components with comprehensive security controls
    and performance optimizations.

    Args:
        engine: SQLAlchemy engine instance
        audit_enabled: Enable/disable audit logging

    Raises:
        RuntimeError: If initialization fails
    """
    try:
        # Configure connection pool with optimized settings
        engine.pool._use_threadlocal = True
        engine.pool.timeout = POOL_TIMEOUT
        engine.pool.recycle = POOL_RECYCLE

        # Set PostgreSQL-specific session parameters
        @event.listens_for(engine, 'connect')
        def set_pg_session_params(dbapi_connection, connection_record):
            # Set statement timeout
            dbapi_connection.execute(f'SET statement_timeout = {STATEMENT_TIMEOUT}')
            # Enable row-level security
            dbapi_connection.execute('SET row_security = ON')
            # Set search path to PA schema
            dbapi_connection.execute('SET search_path = pa, public')

        # Configure performance monitoring if enabled
        if PERFORMANCE_MONITORING_ENABLED:
            @event.listens_for(engine, 'before_cursor_execute')
            def before_cursor_execute(conn, cursor, statement, parameters, context, executemany):
                conn.info.setdefault('query_start_time', []).append(logging.time())

            @event.listens_for(engine, 'after_cursor_execute')
            def after_cursor_execute(conn, cursor, statement, parameters, context, executemany):
                total_time = logging.time() - conn.info['query_start_time'].pop()
                # Log slow queries (>1 second)
                if total_time > 1:
                    logger.warning(f"Slow query detected: {total_time:.2f}s\n{statement}")

        # Configure audit logging if enabled
        if audit_enabled:
            @event.listens_for(engine, 'before_execute')
            def receive_before_execute(conn, clauseelement, multiparams, params, execution_options):
                # Log DML operations for audit trail
                if str(clauseelement).upper().startswith(('INSERT', 'UPDATE', 'DELETE')):
                    logger.info(f"Audit: {str(clauseelement)}", extra={
                        'params': params,
                        'timestamp': logging.time()
                    })

        # Configure PHI tracking if enabled
        if PHI_TRACKING_ENABLED:
            @event.listens_for(Base, 'after_insert', propagate=True)
            def after_insert(mapper, connection, target):
                if hasattr(target, 'contains_phi') and target.contains_phi:
                    logger.info(f"PHI Access: Insert on {mapper.class_.__name__}", extra={
                        'table': mapper.class_.__tablename__,
                        'operation': 'INSERT',
                        'timestamp': logging.time()
                    })

        # Create all tables in proper dependency order
        Base.metadata.create_all(engine, checkfirst=True)

        logger.info("Database initialization completed successfully")

    except Exception as e:
        logger.error(f"Database initialization failed: {str(e)}")
        raise RuntimeError("Failed to initialize database") from e

def get_session_factory(engine: Engine) -> scoped_session:
    """
    Create a thread-safe session factory with optimized settings.

    Args:
        engine: SQLAlchemy engine instance

    Returns:
        scoped_session: Thread-safe session factory
    """
    session_factory = sessionmaker(
        bind=engine,
        autocommit=False,
        autoflush=False,
        expire_on_commit=False
    )
    return scoped_session(session_factory)

# Export public interface
__all__ = [
    'Base',
    'metadata',
    'User',
    'PriorAuthRequest',
    'ClinicalData',
    'ClinicalEvidence',
    'initialize_db',
    'get_session_factory'
]
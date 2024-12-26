"""
Database configuration module for Prior Authorization Management System.
Implements secure async PostgreSQL connections with enhanced monitoring and performance optimizations.

Version: 1.0.0
"""

import ssl
import logging
from typing import Tuple
from contextlib import asynccontextmanager

from sqlalchemy.ext.asyncio import (  # version: 2.0+
    create_async_engine,
    AsyncSession,
    async_sessionmaker,
    AsyncEngine
)
from asyncpg.connection import SSLMode  # version: 0.27+
from asyncpg.exceptions import PostgresError  # version: 0.27+

from config.settings import DATABASE_SETTINGS

# Configure logging
logger = logging.getLogger(__name__)

# Construct database URL with credentials
DATABASE_URL = (
    f"postgresql+asyncpg://{DATABASE_SETTINGS['DB_USER']}:"
    f"{DATABASE_SETTINGS['DB_PASSWORD']}@{DATABASE_SETTINGS['DB_HOST']}:"
    f"{DATABASE_SETTINGS['DB_PORT']}/{DATABASE_SETTINGS['DB_NAME']}"
)

# SSL context for secure database connections
SSL_CONTEXT = ssl.create_default_context(
    purpose=ssl.Purpose.SERVER_AUTH,
    cafile="/etc/ssl/certs/ca-certificates.crt"  # System CA certificates
)
SSL_CONTEXT.verify_mode = ssl.CERT_REQUIRED
SSL_CONTEXT.check_hostname = True

def get_engine() -> AsyncEngine:
    """
    Creates and configures the SQLAlchemy async engine with enhanced security and monitoring.
    
    Returns:
        AsyncEngine: Configured SQLAlchemy async engine instance
    """
    engine = create_async_engine(
        DATABASE_URL,
        # Connection pooling configuration
        pool_size=DATABASE_SETTINGS['POOL_SIZE'],
        max_overflow=DATABASE_SETTINGS['MAX_OVERFLOW'],
        pool_timeout=DATABASE_SETTINGS['POOL_TIMEOUT'],
        pool_recycle=DATABASE_SETTINGS['POOL_RECYCLE'],
        
        # Performance optimizations
        pool_pre_ping=True,  # Verify connections before usage
        echo=DATABASE_SETTINGS.get('ECHO_SQL', False),
        echo_pool=True,  # Log pool checkout/checkin
        future=True,  # Use SQLAlchemy 2.0 features
        
        # Security configurations
        connect_args={
            "ssl": SSL_CONTEXT,
            "ssl_mode": SSLMode.VERIFY_FULL,
            "server_settings": {
                "application_name": "prior_auth_system",
                "statement_timeout": "60000",  # 60 seconds
                "lock_timeout": "10000",  # 10 seconds
                "idle_in_transaction_session_timeout": "300000"  # 5 minutes
            }
        },
        
        # Query execution options
        execution_options={
            "isolation_level": "REPEATABLE READ",
            "postgresql_readonly": False,
            "postgresql_auto_prepares": True
        }
    )
    
    return engine

def get_session_factory(engine: AsyncEngine) -> async_sessionmaker[AsyncSession]:
    """
    Creates an async session factory with enhanced security and monitoring.
    
    Args:
        engine: AsyncEngine instance to bind to session factory
        
    Returns:
        async_sessionmaker: Configured async session factory
    """
    session_factory = async_sessionmaker(
        engine,
        class_=AsyncSession,
        expire_on_commit=False,
        autocommit=False,
        autoflush=False
    )
    
    return session_factory

async def init_db() -> Tuple[AsyncEngine, async_sessionmaker[AsyncSession]]:
    """
    Initializes database engine and session factory with security configurations.
    
    Returns:
        Tuple[AsyncEngine, async_sessionmaker]: Configured engine and session factory
    
    Raises:
        PostgresError: If database connection fails
    """
    try:
        engine = get_engine()
        
        # Verify database connection
        async with engine.connect() as conn:
            await conn.execute("SELECT 1")
            logger.info("Database connection verified successfully")
            
        session_factory = get_session_factory(engine)
        return engine, session_factory
        
    except PostgresError as e:
        logger.error(f"Database initialization failed: {str(e)}")
        raise

@asynccontextmanager
async def get_db_session():
    """
    Async context manager for database sessions with automatic cleanup.
    
    Yields:
        AsyncSession: Database session
    """
    session: AsyncSession = SessionLocal()
    try:
        yield session
    finally:
        await session.close()

# Initialize engine and session factory
engine = get_engine()
SessionLocal = get_session_factory(engine)

# Export database components
__all__ = [
    'engine',
    'SessionLocal',
    'get_engine',
    'get_session_factory',
    'init_db',
    'get_db_session'
]
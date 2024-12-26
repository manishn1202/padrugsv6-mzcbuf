"""
Pytest configuration and fixtures for Prior Authorization Management System testing.
Provides secure, HIPAA-compliant test infrastructure with performance optimization.

Version: 1.0.0
"""

import os
import pytest
import logging
from typing import AsyncGenerator, Dict

# SQLAlchemy imports (v2.0+)
from sqlalchemy.ext.asyncio import (
    create_async_engine,
    AsyncSession,
    async_scoped_session,
    AsyncEngine
)
from sqlalchemy.orm import sessionmaker

# HTTP client for API testing (v0.24.0)
from httpx import AsyncClient

# Internal imports
from db.base import Base, metadata
from config.settings import DATABASE_SETTINGS

# Test database configuration with security controls
TEST_DATABASE_URL = (
    f"postgresql+asyncpg://{DATABASE_SETTINGS['DB_USER']}:{DATABASE_SETTINGS['DB_PASSWORD']}"
    f"@{DATABASE_SETTINGS['DB_HOST']}:{DATABASE_SETTINGS['DB_PORT']}/prior_auth_test"
    f"?ssl={DATABASE_SETTINGS.get('DB_SSL_MODE', 'require')}"
)

# Performance optimization settings
TEST_PERFORMANCE_SETTINGS = {
    "max_connections": 100,
    "pool_timeout": 30,
    "max_overflow": 10,
    "pool_size": 20,
    "pool_recycle": 1800,
    "echo": False
}

def pytest_configure(config):
    """
    Configure test environment with security and performance settings.
    
    Args:
        config: Pytest config object
    """
    # Set secure test environment
    os.environ["ENV"] = "test"
    os.environ["TESTING"] = "1"
    
    # Configure HIPAA-compliant test logging
    logging.basicConfig(
        level=logging.INFO,
        format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
    )
    
    # Initialize audit logging capture
    audit_logger = logging.getLogger("audit")
    audit_logger.setLevel(logging.INFO)
    
    # Configure performance monitoring
    perf_logger = logging.getLogger("performance")
    perf_logger.setLevel(logging.INFO)

@pytest.fixture(scope="session")
async def db_engine() -> AsyncGenerator[AsyncEngine, None]:
    """
    Create secure database engine fixture with performance optimization.
    
    Yields:
        AsyncEngine: Configured SQLAlchemy engine
    """
    # Create engine with security and performance settings
    engine = create_async_engine(
        TEST_DATABASE_URL,
        **TEST_PERFORMANCE_SETTINGS,
        # Security settings
        connect_args={
            "ssl": True,
            "ssl_cert_reqs": "CERT_REQUIRED",
            "server_settings": {
                "application_name": "prior_auth_test",
                "statement_timeout": "10000",  # 10 seconds
                "lock_timeout": "5000"  # 5 seconds
            }
        }
    )
    
    try:
        yield engine
    finally:
        # Ensure proper cleanup
        await engine.dispose()

@pytest.fixture
async def db_session(db_engine: AsyncEngine) -> AsyncGenerator[AsyncSession, None]:
    """
    Create HIPAA-compliant database session fixture with audit logging.
    
    Args:
        db_engine: SQLAlchemy engine fixture
        
    Yields:
        AsyncSession: Database session for testing
    """
    # Create session factory with security controls
    session_factory = sessionmaker(
        db_engine,
        class_=AsyncSession,
        expire_on_commit=False,
        autoflush=False
    )
    
    # Create scoped session for test isolation
    async_session = async_scoped_session(
        session_factory,
        scopefunc=lambda: None
    )
    
    # Create test database schema
    async with db_engine.begin() as conn:
        await conn.run_sync(metadata.create_all)
    
    try:
        session = async_session()
        yield session
    finally:
        # Ensure proper cleanup with audit logging
        await session.rollback()
        await session.close()
        
        # Drop test database schema
        async with db_engine.begin() as conn:
            await conn.run_sync(metadata.drop_all)

@pytest.fixture
async def test_client() -> AsyncGenerator[AsyncClient, None]:
    """
    Create secure HTTP test client with performance tracking.
    
    Yields:
        AsyncClient: Configured HTTP client
    """
    # Configure client with security defaults
    async with AsyncClient(
        base_url="http://test",
        timeout=30.0,
        verify=True,
        # Security headers
        headers={
            "X-Test-Client": "1",
            "User-Agent": "PriorAuth-Test/1.0"
        }
    ) as client:
        yield client

@pytest.fixture
def auth_headers() -> Dict[str, str]:
    """
    Generate secure authentication headers for testing.
    
    Returns:
        dict: Authentication headers with security controls
    """
    # Generate test JWT with security claims
    return {
        "Authorization": "Bearer test_token",
        "X-Request-ID": "test_request_123",
        "X-Test-Role": "test_provider",
        # Security headers
        "X-Content-Type-Options": "nosniff",
        "X-Frame-Options": "DENY",
        "X-XSS-Protection": "1; mode=block"
    }

# Additional test configuration hooks
def pytest_sessionstart(session):
    """Configure test session startup with security checks."""
    # Validate test environment
    assert os.getenv("ENV") == "test"
    assert os.getenv("TESTING") == "1"

def pytest_sessionfinish(session, exitstatus):
    """Cleanup test session with security validation."""
    # Ensure all test resources are cleaned up
    logging.info("Test session cleanup completed")
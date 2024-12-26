"""
Alembic migrations environment configuration for Prior Authorization Management System.
Implements secure database migrations with HIPAA compliance, proper transaction management,
and support for both async and sync contexts.

Version: 1.0.0
"""

import ssl
import logging
from logging.config import fileConfig

from alembic import context  # version: 1.12+
from sqlalchemy import engine_from_config, pool  # version: 2.0+
from sqlalchemy.engine import Connection
from sqlalchemy.ext.asyncio import AsyncEngine  # version: 2.0+

from db.base import Base  # Import SQLAlchemy declarative base
from config.database import DATABASE_SETTINGS  # Import secure database configuration

# Configure Alembic logging with HIPAA compliance
logger = logging.getLogger('alembic.migration')
fileConfig(context.config.config_file_name)

# Set metadata target for migrations
target_metadata = Base.metadata

# Construct database URL with credentials
SQLALCHEMY_DATABASE_URL = (
    f"postgresql://{DATABASE_SETTINGS['DB_USER']}:"
    f"{DATABASE_SETTINGS['DB_PASSWORD']}@"
    f"{DATABASE_SETTINGS['DB_HOST']}:"
    f"{DATABASE_SETTINGS['DB_PORT']}/"
    f"{DATABASE_SETTINGS['DB_NAME']}"
)

def get_ssl_context() -> ssl.SSLContext:
    """
    Creates SSL context for secure database connections during migrations.
    
    Returns:
        ssl.SSLContext: Configured SSL context
    """
    ssl_context = ssl.create_default_context(
        purpose=ssl.Purpose.SERVER_AUTH,
        cafile=DATABASE_SETTINGS['DB_SSL_CA']
    )
    ssl_context.verify_mode = ssl.CERT_REQUIRED
    ssl_context.check_hostname = True
    return ssl_context

def get_connection_args() -> dict:
    """
    Returns secure connection arguments for database engine.
    
    Returns:
        dict: Connection arguments including SSL configuration
    """
    return {
        "ssl": get_ssl_context(),
        "server_settings": {
            "application_name": "prior_auth_migrations",
            "statement_timeout": "300000",  # 5 minutes for migrations
            "lock_timeout": "60000",  # 1 minute lock timeout
            "idle_in_transaction_session_timeout": "300000"  # 5 minutes
        }
    }

def run_migrations_offline() -> None:
    """
    Run migrations in 'offline' mode for generating SQL scripts.
    
    This configures context with URL and generates SQL script
    with proper transaction handling and security measures.
    """
    context.configure(
        url=SQLALCHEMY_DATABASE_URL,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
        compare_type=True,
        compare_server_default=True,
        include_schemas=True,
        version_table_schema=target_metadata.schema,
        # Transaction configuration
        transaction_per_migration=True,
        transactional_ddl=True
    )

    with context.begin_transaction():
        try:
            logger.info("Starting offline migration generation")
            context.run_migrations()
            logger.info("Offline migration generation completed successfully")
        except Exception as e:
            logger.error(f"Offline migration failed: {str(e)}")
            raise

def run_migrations_online() -> None:
    """
    Run migrations in 'online' mode against the database.
    
    Implements secure connection handling, proper transaction management,
    and HIPAA-compliant logging.
    """
    config = context.config
    
    # Update alembic configuration with secure database URL
    config.set_main_option("sqlalchemy.url", SQLALCHEMY_DATABASE_URL)
    
    # Configure database engine with security settings
    connectable = engine_from_config(
        config.get_section(config.config_ini_section),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,  # Disable pooling for migrations
        connect_args=get_connection_args()
    )

    with connectable.connect() as connection:
        context.configure(
            connection=connection,
            target_metadata=target_metadata,
            compare_type=True,
            compare_server_default=True,
            include_schemas=True,
            version_table_schema=target_metadata.schema,
            # Transaction configuration
            transaction_per_migration=True,
            transactional_ddl=True
        )

        try:
            logger.info("Starting online migration")
            with context.begin_transaction():
                context.run_migrations()
            logger.info("Online migration completed successfully")
        except Exception as e:
            logger.error(f"Online migration failed: {str(e)}")
            raise
        finally:
            connection.close()

async def run_async_migrations() -> None:
    """
    Run migrations in async context for async database operations.
    
    Implements async connection handling with proper security measures
    and transaction management.
    """
    config = context.config
    
    # Update alembic configuration with secure database URL
    config.set_main_option("sqlalchemy.url", SQLALCHEMY_DATABASE_URL)
    
    # Configure async database engine with security settings
    connectable = engine_from_config(
        config.get_section(config.config_ini_section),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
        connect_args=get_connection_args(),
        future=True  # Enable SQLAlchemy 2.0 features
    )

    async with connectable.connect() as connection:
        await connection.run_sync(do_run_migrations)

def do_run_migrations(connection: Connection) -> None:
    """
    Execute migrations within a connection context.
    
    Args:
        connection: SQLAlchemy connection object
    """
    context.configure(
        connection=connection,
        target_metadata=target_metadata,
        compare_type=True,
        compare_server_default=True,
        include_schemas=True,
        version_table_schema=target_metadata.schema,
        transaction_per_migration=True,
        transactional_ddl=True
    )

    try:
        logger.info("Starting migration execution")
        with context.begin_transaction():
            context.run_migrations()
        logger.info("Migration execution completed successfully")
    except Exception as e:
        logger.error(f"Migration execution failed: {str(e)}")
        raise

if context.is_offline_mode():
    logger.info("Running migrations in offline mode")
    run_migrations_offline()
else:
    logger.info("Running migrations in online mode")
    run_migrations_online()
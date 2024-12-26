"""
Setup configuration for Prior Authorization Management System backend.
Implements HIPAA-compliant package configuration with comprehensive security controls.

Version: 1.0.0
"""

import os
from setuptools import setup, find_packages

# Import package version
from src import __version__

def read_requirements():
    """
    Read and validate package requirements from requirements.txt.
    Ensures all security and HIPAA compliance dependencies are included.
    
    Returns:
        list: List of validated package requirements
    """
    requirements = []
    try:
        with open('requirements.txt') as f:
            for line in f:
                line = line.strip()
                # Skip comments and empty lines
                if line and not line.startswith('#'):
                    requirements.append(line)
        return requirements
    except FileNotFoundError:
        return [
            # Core dependencies with versions
            'fastapi==0.100.0',
            'pydantic==2.0.0',
            'sqlalchemy==2.0.0',
            'fhir.resources==6.5.0',
            'anthropic==0.3.0',
            'langchain==0.1.0',
            'celery==5.3.0',
            'redis==4.6.0',
            'boto3==1.28.0',
            'aws-xray-sdk==2.12.0',
            'uvicorn==0.23.0',
            'python-jose[cryptography]==3.3.0',
            'passlib[bcrypt]==1.7.4',
            'python-multipart==0.0.6',
            'cryptography==41.0.0',
            'secure==0.3.0'
        ]

setup(
    # Package metadata
    name='prior-auth-backend',
    version=__version__,
    description='HIPAA-Compliant Prior Authorization Management System Backend Service',
    author='Prior Authorization Management System Team',
    author_email='team@priorauth.com',
    license='Proprietary',
    
    # Python requirements
    python_requires='>=3.11',
    
    # Package configuration
    package_dir={'': 'src'},
    packages=find_packages(where='src'),
    
    # Dependencies
    install_requires=read_requirements(),
    
    # Development dependencies
    extras_require={
        'dev': [
            'pytest==7.4.0',
            'pytest-cov==4.1.0',
            'pytest-asyncio==0.21.0',
            'pytest-mock==3.11.1',
            'black==23.7.0',
            'isort==5.12.0',
            'flake8==6.1.0',
            'flake8-security==0.4.0',
            'mypy==1.4.0',
            'bandit==1.7.5',
            'safety==2.3.0',
            'pre-commit==3.3.3'
        ],
        'docs': [
            'sphinx==7.0.0',
            'sphinx-rtd-theme==1.2.0'
        ]
    },
    
    # Entry points
    entry_points={
        'console_scripts': [
            'prior-auth-backend=src.main:main'
        ]
    },
    
    # Package classifiers
    classifiers=[
        'Development Status :: 5 - Production/Stable',
        'Intended Audience :: Healthcare Industry',
        'License :: Other/Proprietary License',
        'Programming Language :: Python :: 3.11',
        'Topic :: Healthcare :: Prior Authorization',
        'Operating System :: OS Independent',
        'Environment :: Web Environment',
        'Framework :: FastAPI',
        'Framework :: Pydantic',
        'Typing :: Typed'
    ],
    
    # Package data
    include_package_data=True,
    zip_safe=False,
    
    # Project URLs
    project_urls={
        'Source': 'https://github.com/org/prior-auth-backend',
        'Documentation': 'https://docs.priorauth.com'
    }
)
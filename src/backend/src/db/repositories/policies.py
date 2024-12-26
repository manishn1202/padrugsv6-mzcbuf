"""
Repository class for managing drug policies, criteria, and matching results in the database.
Implements HIPAA-compliant CRUD operations with comprehensive validation, security controls,
versioning, audit trails, and AI-assisted matching functionality.

Version: 1.0.0
"""

# Standard library imports
from datetime import datetime
from typing import Dict, List, Optional
from uuid import UUID

# SQLAlchemy 2.0+ imports
from sqlalchemy import select, and_, desc  # version: 2.0.0
from sqlalchemy.ext.asyncio import AsyncSession  # version: 2.0.0
from sqlalchemy.exc import IntegrityError  # version: 2.0.0

# Internal model imports
from db.models.policies import DrugPolicy, PolicyCriterion, PolicyMatchResult
from core.exceptions import PolicyNotFoundError, ValidationError
from core.logging import audit_logger
from core.cache import RedisCacheManager
from core.security import validate_hipaa_compliance

class PolicyRepository:
    """
    Enhanced repository class for managing drug policies and criteria with HIPAA compliance,
    versioning, and audit trails. Implements comprehensive validation and security controls.
    """

    def __init__(self, session: AsyncSession, cache_manager: RedisCacheManager):
        """Initialize policy repository with database session and cache manager."""
        self._session = session
        self._cache = cache_manager
        self._audit_logger = audit_logger

    async def get_policy_by_id(self, policy_id: UUID) -> Optional[DrugPolicy]:
        """
        Retrieve drug policy by ID with caching and audit logging.
        
        Args:
            policy_id: UUID of the policy to retrieve
            
        Returns:
            DrugPolicy if found, None otherwise
            
        Raises:
            PolicyNotFoundError: If policy doesn't exist or is deleted
        """
        # Check cache first
        cache_key = f"policy:{policy_id}"
        cached_policy = await self._cache.get(cache_key)
        if cached_policy:
            return cached_policy

        # Build optimized query with security filters
        query = (
            select(DrugPolicy)
            .where(
                and_(
                    DrugPolicy.policy_id == policy_id,
                    DrugPolicy.is_deleted == False,
                    DrugPolicy.active == True
                )
            )
            .options(
                selectinload(DrugPolicy.criteria),
                selectinload(DrugPolicy.match_results)
            )
        )

        # Execute query with performance monitoring
        try:
            result = await self._session.execute(query)
            policy = result.scalar_one_or_none()

            if policy:
                # Cache for future requests
                await self._cache.set(cache_key, policy, expire=300)
                return policy
            else:
                raise PolicyNotFoundError(f"Policy {policy_id} not found or inactive")

        except Exception as e:
            self._audit_logger.error(f"Error retrieving policy {policy_id}: {str(e)}")
            raise

    async def create_policy(self, policy_data: Dict, user_id: UUID) -> DrugPolicy:
        """
        Create new drug policy with versioning and HIPAA compliance validation.
        
        Args:
            policy_data: Dictionary containing policy details
            user_id: UUID of user creating the policy
            
        Returns:
            Created DrugPolicy instance
            
        Raises:
            ValidationError: If policy data fails validation
            IntegrityError: If database constraints are violated
        """
        # Validate policy data against HIPAA rules
        if not validate_hipaa_compliance(policy_data):
            raise ValidationError("Policy data fails HIPAA compliance validation")

        try:
            # Generate new version number
            latest_version = await self._get_latest_version(policy_data['drug_code'])
            new_version = self._increment_version(latest_version)

            # Create audit trail entry
            audit_data = {
                'action': 'create_policy',
                'user_id': user_id,
                'timestamp': datetime.utcnow(),
                'details': policy_data
            }

            # Create new policy instance
            policy = DrugPolicy(
                drug_code=policy_data['drug_code'],
                name=policy_data['name'],
                version=new_version,
                effective_date=policy_data['effective_date'],
                created_by=user_id
            )

            # Add criteria if provided
            if 'criteria' in policy_data:
                for criterion_data in policy_data['criteria']:
                    criterion = PolicyCriterion(
                        policy_id=policy.policy_id,
                        description=criterion_data['description'],
                        weight=criterion_data['weight'],
                        required=criterion_data['required'],
                        validation_rules=criterion_data['validation_rules'],
                        created_by=user_id
                    )
                    policy.criteria.append(criterion)

            # Save to database with retry logic
            try:
                self._session.add(policy)
                await self._session.commit()
            except IntegrityError:
                await self._session.rollback()
                raise ValidationError("Database integrity constraint violated")

            # Log audit trail
            self._audit_logger.info("Policy created", extra=audit_data)

            # Invalidate relevant caches
            await self._cache.delete_pattern(f"policy:*")

            return policy

        except Exception as e:
            await self._session.rollback()
            self._audit_logger.error(f"Error creating policy: {str(e)}")
            raise

    async def store_match_result(
        self, 
        policy_id: UUID, 
        request_id: UUID, 
        match_data: Dict
    ) -> PolicyMatchResult:
        """
        Store enhanced policy matching result with evidence mapping.
        
        Args:
            policy_id: UUID of the matched policy
            request_id: UUID of the PA request
            match_data: Dictionary containing match results and evidence
            
        Returns:
            Created PolicyMatchResult instance
            
        Raises:
            ValidationError: If match data is invalid
            PolicyNotFoundError: If referenced policy doesn't exist
        """
        # Validate match data
        if not self._validate_match_data(match_data):
            raise ValidationError("Invalid match data format")

        try:
            # Verify policy exists
            policy = await self.get_policy_by_id(policy_id)
            if not policy:
                raise PolicyNotFoundError(f"Policy {policy_id} not found")

            # Create match result instance
            match_result = PolicyMatchResult(
                policy_id=policy_id,
                request_id=request_id,
                confidence_score=match_data['confidence_score'],
                evidence_mapping=match_data['evidence_mapping'],
                missing_criteria=match_data.get('missing_criteria'),
                recommended_decision=match_data['recommended_decision'],
                created_by=match_data['user_id']
            )

            # Save to database
            self._session.add(match_result)
            await self._session.commit()

            # Log audit trail
            self._audit_logger.info(
                "Match result stored",
                extra={
                    'policy_id': policy_id,
                    'request_id': request_id,
                    'confidence': match_data['confidence_score'],
                    'decision': match_data['recommended_decision']
                }
            )

            return match_result

        except Exception as e:
            await self._session.rollback()
            self._audit_logger.error(f"Error storing match result: {str(e)}")
            raise

    async def _get_latest_version(self, drug_code: str) -> Optional[str]:
        """Get latest version number for a drug policy."""
        query = (
            select(DrugPolicy.version)
            .where(DrugPolicy.drug_code == drug_code)
            .order_by(desc(DrugPolicy.version))
            .limit(1)
        )
        result = await self._session.execute(query)
        return result.scalar_one_or_none()

    def _increment_version(self, current_version: Optional[str]) -> str:
        """Generate incremented version number."""
        if not current_version:
            return "1.0.0"
        major, minor, patch = current_version.split(".")
        return f"{major}.{minor}.{int(patch) + 1}"

    def _validate_match_data(self, match_data: Dict) -> bool:
        """Validate policy match result data."""
        required_fields = {
            'confidence_score', 'evidence_mapping',
            'recommended_decision', 'user_id'
        }
        
        if not all(field in match_data for field in required_fields):
            return False
            
        if not 0 <= match_data['confidence_score'] <= 1:
            return False
            
        if not isinstance(match_data['evidence_mapping'], dict):
            return False
            
        return True
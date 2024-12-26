"""
Unit tests for SQLAlchemy models in the Prior Authorization Management System.
Focuses on HIPAA compliance, security validation, and model integrity verification.

Version: 1.0.0
"""

import uuid
from datetime import datetime, timedelta
from typing import Dict

import pytest
from freezegun import freeze_time

from db.models.users import User
from db.models.prior_auth import PriorAuthRequest, PAStatus, PADecision
from db.models.clinical import ClinicalData, ClinicalEvidence, ClinicalDataType
from core.constants import UserRole
from core.security import get_password_hash, verify_password

# Test constants
TEST_USER_EMAIL = "test@example.com"
TEST_USER_PASSWORD = "Test123!@#$"
FROZEN_TIME = "2024-01-01T00:00:00Z"
MAX_LOGIN_ATTEMPTS = 3
PASSWORD_EXPIRY_DAYS = 90

@pytest.mark.unit
@freeze_time(FROZEN_TIME)
def test_user_security(test_db):
    """Test comprehensive user security features including password management and access control."""
    
    # Create test user with secure password
    user = User(
        email=TEST_USER_EMAIL,
        password=TEST_USER_PASSWORD,
        first_name="Test",
        last_name="User",
        role=UserRole.PROVIDER,
        organization="Test Org",
        npi_number="1234567890"
    )
    test_db.add(user)
    test_db.commit()

    # Test password hashing and verification
    assert user.hashed_password != TEST_USER_PASSWORD
    assert verify_password(TEST_USER_PASSWORD, user.hashed_password)
    assert not verify_password("WrongPassword123!", user.hashed_password)

    # Test failed login attempt tracking
    assert user.failed_login_attempts == 0
    for _ in range(MAX_LOGIN_ATTEMPTS - 1):
        is_locked = user.increment_failed_login()
        assert not is_locked
        assert user.is_active

    # Test account lockout on max attempts
    is_locked = user.increment_failed_login()
    assert is_locked
    assert not user.is_active
    assert user.failed_login_attempts == MAX_LOGIN_ATTEMPTS

    # Test login reset
    user.reset_failed_login()
    assert user.failed_login_attempts == 0
    assert user.last_login_at == datetime.utcnow()

    # Test password expiry
    assert not user.check_password_expiry(PASSWORD_EXPIRY_DAYS)
    with freeze_time(datetime.utcnow() + timedelta(days=PASSWORD_EXPIRY_DAYS + 1)):
        assert user.check_password_expiry(PASSWORD_EXPIRY_DAYS)

    # Test role validation
    with pytest.raises(ValueError):
        user.role = "INVALID_ROLE"

    # Test NPI validation
    with pytest.raises(ValueError):
        user.npi_number = "123"  # Invalid length

@pytest.mark.unit
@freeze_time(FROZEN_TIME)
def test_prior_auth_compliance(test_db):
    """Test PA request compliance with audit requirements and version control."""
    
    # Create test PA request
    provider_id = uuid.uuid4()
    patient_id = uuid.uuid4()
    drug_id = uuid.uuid4()
    user_id = uuid.uuid4()

    pa_request = PriorAuthRequest(
        provider_id=provider_id,
        patient_id=patient_id,
        drug_id=drug_id,
        user_id=user_id
    )
    test_db.add(pa_request)
    test_db.commit()

    # Test initial state
    assert pa_request.status == PAStatus.DRAFT
    assert pa_request.version == 1
    assert pa_request.created_at == datetime.utcnow()
    assert pa_request.contains_phi is True

    # Test request submission with audit trail
    success = pa_request.submit_request(user_id)
    assert success
    assert pa_request.status == PAStatus.SUBMITTED
    assert pa_request.version == 2
    assert pa_request.submitted_at == datetime.utcnow()
    assert pa_request.last_modified_by == user_id

    # Test decision update with audit trail
    pa_request.update_decision(
        decision=PADecision.APPROVED.value,
        user_id=user_id
    )
    assert pa_request.status == PAStatus.COMPLETED
    assert pa_request.decision == PADecision.APPROVED
    assert pa_request.version == 3
    assert pa_request.decision_at == datetime.utcnow()

    # Test status validation
    with pytest.raises(ValueError):
        pa_request.status = "INVALID_STATUS"

    # Test decision validation
    with pytest.raises(ValueError):
        pa_request.update_decision("INVALID_DECISION", user_id=user_id)

@pytest.mark.unit
def test_clinical_data_security(test_db):
    """Test HIPAA-compliant clinical data handling and encryption."""
    
    # Create test clinical data
    request_id = uuid.uuid4()
    user_id = uuid.uuid4()
    
    test_patient_data: Dict = {
        "diagnosis": "Test Condition",
        "icd10": "A123",
        "severity": "moderate"
    }

    test_provider_notes: Dict = {
        "assessment": "Test assessment",
        "plan": "Test treatment plan"
    }

    clinical_data = ClinicalData(
        request_id=request_id,
        data_type=ClinicalDataType.DIAGNOSIS.value,
        patient_data=test_patient_data,
        provider_notes=test_provider_notes,
        modified_by=user_id
    )
    test_db.add(clinical_data)
    test_db.commit()

    # Test data integrity
    assert clinical_data.patient_data == test_patient_data
    assert clinical_data.provider_notes == test_provider_notes
    assert clinical_data.contains_phi is True
    assert clinical_data.version == 1

    # Test data type validation
    with pytest.raises(ValueError):
        clinical_data.data_type = "INVALID_TYPE"

    # Test JSON data validation
    with pytest.raises(ValueError):
        clinical_data.patient_data = "invalid_json"

    # Test data update with version control
    new_patient_data = {
        "diagnosis": "Updated Condition",
        "icd10": "B456",
        "severity": "severe"
    }
    clinical_data.update_patient_data(new_patient_data, user_id)
    assert clinical_data.patient_data == new_patient_data
    assert clinical_data.version == 2
    assert clinical_data.modified_by == user_id

    # Test clinical evidence creation and validation
    evidence = ClinicalEvidence(
        clinical_data_id=clinical_data.id,
        criteria_id=uuid.uuid4(),
        confidence_score=0.85,
        evidence_mapping={
            "diagnosis_match": True,
            "severity_match": True
        },
        modified_by=user_id
    )
    test_db.add(evidence)
    test_db.commit()

    # Test confidence score validation
    with pytest.raises(ValueError):
        evidence.confidence_score = 1.5

    # Test evidence mapping validation
    with pytest.raises(ValueError):
        evidence.evidence_mapping = "invalid_mapping"

    assert evidence.is_active is True
    assert evidence.version == 1
    assert evidence.evaluated_at is not None
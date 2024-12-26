"""
Comprehensive unit test suite for Prior Authorization Management System service layer.
Tests authentication, clinical data processing, and AI-powered evidence analysis with HIPAA compliance.

Version: 1.0.0
"""

import uuid
import pytest
from datetime import datetime, timedelta
from unittest.mock import MagicMock, patch
from freezegun import freeze_time  # version: 1.2+

# Internal imports
from services.users import UserService
from services.clinical import ClinicalService
from core.exceptions import AuthorizationException, ValidationException
from core.security import SecurityContext
from ai.evidence_analyzer import EvidenceAnalyzer
from fhir.client import FHIRClient

# Test data constants
TEST_USER_DATA = {
    "email": "test@example.com",
    "password": "Test123!@#",
    "first_name": "Test",
    "last_name": "Provider",
    "role": "PROVIDER",
    "organization": "Test Hospital",
    "mfa_enabled": True,
    "mfa_secret": "BASE32SECRET3232"
}

TEST_CLINICAL_DATA = {
    "resourceType": "Bundle",
    "type": "collection",
    "entry": [{
        "resource": {
            "resourceType": "Patient",
            "id": str(uuid.uuid4()),
            "name": [{"family": "Smith", "given": ["John"]}],
            "birthDate": "1970-01-01"
        }
    }],
    "timestamp": datetime.utcnow().isoformat()
}

TEST_EVIDENCE_DATA = {
    "clinical_criteria": ["prior_therapy", "lab_results", "contraindications"],
    "confidence_threshold": 0.85,
    "required_matches": ["diagnosis", "failed_therapies"]
}

@pytest.mark.unit
class TestUserService:
    """Test suite for user management service functionality."""

    @pytest.fixture
    def mock_user_repo(self):
        """Mock user repository."""
        return MagicMock()

    @pytest.fixture
    def mock_audit_logger(self):
        """Mock audit logger."""
        return MagicMock()

    @pytest.fixture
    def mock_cache(self):
        """Mock Redis cache."""
        return MagicMock()

    @pytest.fixture
    def user_service(self, mock_user_repo, mock_audit_logger, mock_cache):
        """Initialize UserService with mocked dependencies."""
        return UserService(
            repository=mock_user_repo,
            audit_logger=mock_audit_logger,
            cache=mock_cache
        )

    @pytest.mark.asyncio
    async def test_authenticate_user_success(self, user_service):
        """Test successful user authentication with valid credentials and MFA."""
        # Setup test data
        user_id = uuid.uuid4()
        test_user = {**TEST_USER_DATA, "id": user_id}
        user_service._repository.get_by_email.return_value = test_user
        user_service._validate_mfa = MagicMock(return_value=True)

        # Test authentication
        result = await user_service.authenticate_user(
            email=TEST_USER_DATA["email"],
            password=TEST_USER_DATA["password"],
            mfa_code="123456"
        )

        # Verify results
        assert result["user"]["email"] == TEST_USER_DATA["email"]
        assert result["user"]["role"] == TEST_USER_DATA["role"]
        assert "access_token" in result
        assert "refresh_token" in result

        # Verify audit logging
        user_service._audit_logger.log_security_event.assert_called_once()

    @pytest.mark.asyncio
    async def test_authenticate_user_invalid_credentials(self, user_service):
        """Test authentication failure with invalid credentials."""
        user_service._repository.get_by_email.return_value = None

        with pytest.raises(AuthorizationException) as exc:
            await user_service.authenticate_user(
                email="invalid@example.com",
                password="wrong_password"
            )

        assert "Invalid credentials" in str(exc.value)
        assert user_service._audit_logger.log_security_event.called

    @pytest.mark.asyncio
    async def test_authenticate_user_mfa_required(self, user_service):
        """Test MFA requirement enforcement."""
        test_user = {**TEST_USER_DATA, "id": uuid.uuid4()}
        user_service._repository.get_by_email.return_value = test_user

        with pytest.raises(ValidationException) as exc:
            await user_service.authenticate_user(
                email=TEST_USER_DATA["email"],
                password=TEST_USER_DATA["password"]
            )

        assert "MFA code required" in str(exc.value)

    @pytest.mark.asyncio
    async def test_authenticate_user_rate_limit(self, user_service):
        """Test rate limiting for authentication attempts."""
        user_service._check_rate_limit = MagicMock(return_value=True)

        with pytest.raises(AuthorizationException) as exc:
            await user_service.authenticate_user(
                email=TEST_USER_DATA["email"],
                password=TEST_USER_DATA["password"],
                request_ip="127.0.0.1"
            )

        assert "Rate limit exceeded" in str(exc.value)

@pytest.mark.unit
class TestClinicalService:
    """Test suite for clinical data processing and evidence analysis."""

    @pytest.fixture
    def mock_clinical_repo(self):
        """Mock clinical repository."""
        return MagicMock()

    @pytest.fixture
    def mock_evidence_analyzer(self):
        """Mock evidence analyzer."""
        return MagicMock()

    @pytest.fixture
    def mock_fhir_client(self):
        """Mock FHIR client."""
        return MagicMock()

    @pytest.fixture
    def clinical_service(self, mock_clinical_repo, mock_evidence_analyzer, mock_fhir_client):
        """Initialize ClinicalService with mocked dependencies."""
        return ClinicalService(
            repository=mock_clinical_repo,
            evidence_analyzer=mock_evidence_analyzer,
            fhir_client=mock_fhir_client
        )

    @pytest.mark.asyncio
    async def test_create_clinical_record_success(self, clinical_service):
        """Test successful clinical record creation with FHIR data."""
        request_id = uuid.uuid4()
        
        # Setup mock responses
        clinical_service._fhir_client.validate_fhir_data.return_value = True
        clinical_service._evidence_analyzer.validate_evidence_quality.return_value = {
            "score": 0.9,
            "entity_scores": {"diagnosis": 0.95, "medications": 0.85}
        }

        # Create clinical record
        result = await clinical_service.create_clinical_record(
            request_id=request_id,
            data_type="patient_history",
            fhir_data=TEST_CLINICAL_DATA
        )

        # Verify results
        assert result["clinical_data_id"]
        assert result["evidence_analysis"]["score"] >= 0.85
        assert "created_at" in result

        # Verify repository calls
        clinical_service._repository.create_clinical_data.assert_called_once()
        clinical_service._repository.create_evidence.assert_called_once()

    @pytest.mark.asyncio
    async def test_create_clinical_record_invalid_fhir(self, clinical_service):
        """Test clinical record creation with invalid FHIR data."""
        request_id = uuid.uuid4()
        clinical_service._fhir_client.validate_fhir_data.return_value = False

        with pytest.raises(ValidationException) as exc:
            await clinical_service.create_clinical_record(
                request_id=request_id,
                data_type="patient_history",
                fhir_data={"invalid": "data"}
            )

        assert "Invalid FHIR data format" in str(exc.value)

    @pytest.mark.asyncio
    async def test_analyze_evidence_success(self, clinical_service):
        """Test successful evidence analysis with AI integration."""
        clinical_data_id = uuid.uuid4()
        
        # Setup mock data
        mock_clinical_data = {
            "id": clinical_data_id,
            "patient_data": TEST_CLINICAL_DATA,
            "data_type": "patient_history"
        }
        clinical_service._repository.get_clinical_data.return_value = mock_clinical_data
        
        # Setup mock analysis results
        mock_analysis = {
            "score": 0.92,
            "entity_scores": {
                "diagnosis": 0.95,
                "medications": 0.90,
                "lab_results": 0.88
            },
            "recommendation": "APPROVE"
        }
        clinical_service._evidence_analyzer.validate_evidence_quality.return_value = mock_analysis

        # Perform analysis
        result = await clinical_service.analyze_evidence(clinical_data_id)

        # Verify results
        assert result["score"] > 0.85
        assert "entity_scores" in result
        assert result["recommendation"] == "APPROVE"

        # Verify analyzer calls
        clinical_service._evidence_analyzer.validate_evidence_quality.assert_called_once()
        clinical_service._repository.create_evidence.assert_called_once()

    @pytest.mark.asyncio
    async def test_analyze_evidence_low_confidence(self, clinical_service):
        """Test evidence analysis with low confidence scores."""
        clinical_data_id = uuid.uuid4()
        
        # Setup mock data
        mock_clinical_data = {
            "id": clinical_data_id,
            "patient_data": TEST_CLINICAL_DATA,
            "data_type": "patient_history"
        }
        clinical_service._repository.get_clinical_data.return_value = mock_clinical_data
        
        # Setup low confidence analysis results
        mock_analysis = {
            "score": 0.65,
            "entity_scores": {
                "diagnosis": 0.70,
                "medications": 0.60
            },
            "recommendation": "REVIEW"
        }
        clinical_service._evidence_analyzer.validate_evidence_quality.return_value = mock_analysis

        # Perform analysis
        result = await clinical_service.analyze_evidence(clinical_data_id)

        # Verify results
        assert result["score"] < 0.85
        assert result["recommendation"] == "REVIEW"

    @pytest.mark.asyncio
    async def test_import_fhir_data_success(self, clinical_service):
        """Test successful FHIR data import."""
        request_id = uuid.uuid4()
        patient_id = str(uuid.uuid4())

        # Setup mock FHIR responses
        clinical_service._fhir_client.search_resources.return_value = [
            {"resourceType": "Patient", "id": patient_id}
        ]

        # Import FHIR data
        result = await clinical_service.import_fhir_data(
            request_id=request_id,
            patient_id=patient_id
        )

        # Verify results
        assert result["clinical_data_id"]
        assert "evidence_analysis" in result

        # Verify FHIR client calls
        clinical_service._fhir_client.search_resources.assert_called()
        clinical_service._repository.create_clinical_data.assert_called_once()
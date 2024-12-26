"""
Integration tests for AI components of Prior Authorization Management System.
Tests real interactions between components with HIPAA compliance validation.

Version: 1.0.0
"""

import pytest  # version: 7.3.1
import pytest_asyncio  # version: 0.21.0
from pytest_mock import MockerFixture  # version: 3.10.0
from pytest_benchmark.fixture import BenchmarkFixture  # version: 4.0.0
import json
from datetime import datetime, timedelta
from typing import Dict, List
from uuid import uuid4

from ai.claude_client import ClaudeClient
from ai.criteria_matcher import CriteriaMatcher
from ai.evidence_analyzer import EvidenceAnalyzer
from ai.models import ClinicalEvidence, PolicyCriteria, MatchResult
from core.security import SecurityContext
from core.exceptions import ValidationException
from core.logging import LOGGER

# Test constants
TEST_REQUEST_ID = str(uuid4())
MIN_PERFORMANCE_TARGET = 0.70  # 70% reduction in processing time
MIN_CONFIDENCE_SCORE = 0.75

@pytest.fixture
def security_context():
    """Fixture providing HIPAA-compliant security context."""
    with SecurityContext() as context:
        yield context

@pytest.fixture
async def claude_client(security_context):
    """Fixture providing configured Claude AI client."""
    client = ClaudeClient(
        api_key="test-key",
        base_url="https://api.anthropic.com/v1",
        timeout=30.0
    )
    return client

@pytest.fixture
async def evidence_analyzer(claude_client, security_context):
    """Fixture providing evidence analyzer instance."""
    return EvidenceAnalyzer(claude_client, security_context)

@pytest.fixture
async def criteria_matcher(claude_client, evidence_analyzer):
    """Fixture providing criteria matcher instance."""
    return CriteriaMatcher(claude_client, evidence_analyzer)

@pytest.fixture
def sample_clinical_evidence() -> List[ClinicalEvidence]:
    """Fixture providing test clinical evidence data."""
    return [
        ClinicalEvidence(
            source_type="EMR",
            source_id="test-emr-1",
            clinical_data={
                "diagnosis": "Type 2 Diabetes",
                "medications": ["Metformin", "Glipizide"],
                "lab_results": {
                    "HbA1c": 8.2,
                    "date": datetime.utcnow().isoformat()
                }
            },
            recorded_at=datetime.utcnow()
        ),
        ClinicalEvidence(
            source_type="DOCUMENT",
            source_id="test-doc-1",
            clinical_data={
                "treatment_history": "Failed first-line therapy",
                "contraindications": "None",
                "allergies": ["Penicillin"]
            },
            recorded_at=datetime.utcnow()
        )
    ]

@pytest.fixture
def sample_policy_criteria() -> List[PolicyCriteria]:
    """Fixture providing test policy criteria data."""
    return [
        PolicyCriteria(
            criteria_type="CLINICAL",
            description="HbA1c Requirements",
            requirements={
                "condition": "Type 2 Diabetes",
                "lab_value": {
                    "test": "HbA1c",
                    "min_value": 7.0
                }
            },
            mandatory=True
        ),
        PolicyCriteria(
            criteria_type="CLINICAL",
            description="Prior Treatment",
            requirements={
                "failed_therapy": "first-line",
                "duration": "3 months"
            },
            mandatory=True
        )
    ]

class TestClaudeClient:
    """Integration tests for Claude AI client functionality."""

    @pytest.mark.asyncio
    async def test_analyze_clinical_evidence(
        self,
        claude_client: ClaudeClient,
        sample_clinical_evidence: List[ClinicalEvidence],
        sample_policy_criteria: List[PolicyCriteria],
        benchmark: BenchmarkFixture
    ):
        """Test clinical evidence analysis with performance benchmarking."""
        evidence = sample_clinical_evidence[0]
        criteria = sample_policy_criteria[0]

        # Benchmark analysis performance
        result = await benchmark.pedantic(
            claude_client.analyze_clinical_evidence,
            args=(
                evidence.clinical_data,
                criteria.requirements,
                TEST_REQUEST_ID
            ),
            iterations=5,
            rounds=3
        )

        # Validate response structure
        assert isinstance(result, dict)
        assert "confidence_score" in result
        assert "matches" in result
        assert "recommendation" in result

        # Validate confidence scoring
        assert 0 <= result["confidence_score"] <= 1
        assert result["confidence_score"] >= MIN_CONFIDENCE_SCORE

        # Verify performance improvement
        baseline_time = 2.0  # seconds (baseline manual processing time)
        actual_time = benchmark.stats["mean"]
        improvement = (baseline_time - actual_time) / baseline_time
        assert improvement >= MIN_PERFORMANCE_TARGET

    @pytest.mark.asyncio
    async def test_extract_clinical_entities(
        self,
        claude_client: ClaudeClient,
        sample_clinical_evidence: List[ClinicalEvidence],
        security_context: SecurityContext,
        benchmark: BenchmarkFixture
    ):
        """Test clinical entity extraction with security validation."""
        evidence = sample_clinical_evidence[0]
        
        # Encrypt test data
        encrypted_data = security_context.encrypt(
            json.dumps(evidence.clinical_data).encode()
        )

        # Benchmark extraction performance
        result = await benchmark.pedantic(
            claude_client.extract_clinical_entities,
            args=(encrypted_data.decode(), TEST_REQUEST_ID),
            iterations=5,
            rounds=3
        )

        # Validate response structure
        assert isinstance(result, dict)
        assert "entities" in result
        assert "entity_count" in result
        assert "confidence_scores" in result

        # Verify extracted entities
        entities = result["entities"]
        assert "diagnosis" in entities
        assert "medications" in entities
        assert "lab_results" in entities

        # Validate confidence scores
        for score in result["confidence_scores"].values():
            assert 0 <= score <= 1
            assert score >= MIN_CONFIDENCE_SCORE

class TestCriteriaMatcher:
    """Integration tests for criteria matching system."""

    @pytest.mark.asyncio
    async def test_match_criteria_integration(
        self,
        criteria_matcher: CriteriaMatcher,
        sample_clinical_evidence: List[ClinicalEvidence],
        sample_policy_criteria: List[PolicyCriteria],
        benchmark: BenchmarkFixture
    ):
        """Test end-to-end criteria matching workflow."""
        # Benchmark matching performance
        result = await benchmark.pedantic(
            criteria_matcher.match_criteria,
            args=(
                uuid4(),
                sample_clinical_evidence,
                sample_policy_criteria
            ),
            iterations=3,
            rounds=2
        )

        # Validate match result
        assert isinstance(result, MatchResult)
        assert result.overall_confidence >= MIN_CONFIDENCE_SCORE
        assert len(result.criteria_scores) == len(sample_policy_criteria)
        assert not result.missing_criteria

        # Verify evidence mapping
        for criteria_id in result.evidence_mapping:
            assert len(result.evidence_mapping[criteria_id]) > 0

        # Validate performance
        baseline_time = 3.0  # seconds (baseline manual review time)
        actual_time = benchmark.stats["mean"]
        improvement = (baseline_time - actual_time) / baseline_time
        assert improvement >= MIN_PERFORMANCE_TARGET

    @pytest.mark.asyncio
    async def test_mandatory_criteria_validation(
        self,
        criteria_matcher: CriteriaMatcher,
        sample_clinical_evidence: List[ClinicalEvidence],
        sample_policy_criteria: List[PolicyCriteria]
    ):
        """Test mandatory criteria validation with incomplete evidence."""
        # Remove required lab results
        modified_evidence = sample_clinical_evidence.copy()
        modified_evidence[0].clinical_data.pop("lab_results")

        with pytest.raises(ValidationException) as exc_info:
            await criteria_matcher.match_criteria(
                uuid4(),
                modified_evidence,
                sample_policy_criteria
            )

        assert "mandatory criteria not met" in str(exc_info.value).lower()

def test_evidence_analyzer_integration(
    evidence_analyzer: EvidenceAnalyzer,
    sample_clinical_evidence: List[ClinicalEvidence],
    benchmark: BenchmarkFixture
):
    """Test evidence analysis with quality validation."""
    evidence = sample_clinical_evidence[0]

    # Benchmark analysis performance
    result = benchmark.pedantic(
        evidence_analyzer.validate_evidence_quality,
        args=(evidence,),
        iterations=5,
        rounds=3
    )

    # Validate quality assessment
    assert isinstance(result, dict)
    assert "score" in result
    assert "missing_entities" in result
    assert "entity_scores" in result
    assert "recommendation" in result

    # Verify quality scoring
    assert 0 <= result["score"] <= 1
    assert result["score"] >= MIN_CONFIDENCE_SCORE
    assert not result["missing_entities"]

    # Validate performance
    baseline_time = 1.0  # seconds (baseline manual quality check)
    actual_time = benchmark.stats["mean"]
    improvement = (baseline_time - actual_time) / baseline_time
    assert improvement >= MIN_PERFORMANCE_TARGET
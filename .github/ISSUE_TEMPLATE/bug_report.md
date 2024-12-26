---
name: Bug Report
about: Create a standardized bug report with security and HIPAA compliance assessment
title: '[BUG] '
labels: bug, needs-triage
assignees: ''
---

<!-- 
SECURITY & PHI/PII WARNING
- DO NOT include any Protected Health Information (PHI) or Personally Identifiable Information (PII)
- Remove all sensitive data from logs and screenshots
- Verify no credentials or secrets are exposed
-->

## Bug Description
### Summary
<!-- Provide a clear and concise description of the bug (minimum 50 characters) -->

### Component
<!-- Select the affected system component -->
- [ ] Provider Portal
- [ ] Payer Portal
- [ ] FHIR Integration
- [ ] AI Matching Service
- [ ] Document Management
- [ ] Security/Authentication
- [ ] Database/Storage
- [ ] API Gateway
- [ ] Monitoring/Logging
- [ ] Other: ____________

### Environment
<!-- Select where the bug was discovered -->
- [ ] Development
- [ ] Staging
- [ ] Production
- [ ] DR Site

## Security & Compliance Impact
### Security Classification
<!-- Select the security impact level -->
- [ ] Critical - Security Breach
- [ ] High - Potential Vulnerability
- [ ] Medium - Security Concern
- [ ] Low - Minimal Risk

### HIPAA Impact Analysis
<!-- Check all affected areas -->
#### PHI/PII Exposure Risk
- [ ] No PHI/PII exposure risk
- [ ] Potential indirect exposure
- [ ] Direct exposure risk
- [ ] Requires immediate containment

#### Access Control Impact
- [ ] Authentication affected
- [ ] Authorization affected
- [ ] Role-based access affected
- [ ] Audit logging affected

#### Audit Trail Impact
- [ ] No impact on audit trails
- [ ] Partial logging affected
- [ ] Complete logging failure
- [ ] Audit integrity compromised

#### Data Encryption Impact
- [ ] No encryption impact
- [ ] At-rest encryption affected
- [ ] In-transit encryption affected
- [ ] Key management affected

### Compliance Verification
<!-- Verify impact on HIPAA safeguards -->
#### Technical Safeguards
- [ ] Access Control
- [ ] Encryption/Decryption
- [ ] Audit Controls
- [ ] Integrity Controls
- [ ] Transmission Security

#### Administrative Safeguards
- [ ] Security Management
- [ ] Information Access Management
- [ ] Workforce Training
- [ ] Evaluation Standards

#### Physical Safeguards
- [ ] Facility Access
- [ ] Workstation Security
- [ ] Device/Media Controls

## Technical Details
### Stack Trace
```text
<!-- Paste the sanitized stack trace here -->
```

### Logs
```text
<!-- Paste sanitized relevant log entries here -->
```

### System State
- API Version: <!-- e.g., v1.2.3 -->
- Service Version: <!-- e.g., v2.0.1 -->
- Database Version: <!-- e.g., PostgreSQL 15.2 -->
- Load Conditions: <!-- e.g., Normal/Peak/Stress -->

## Impact Assessment
### Severity
<!-- Select one severity level -->
- [ ] P0 - Critical System Failure
- [ ] P1 - Major Feature Unavailable
- [ ] P2 - Feature Degradation
- [ ] P3 - Minor Issue

### Performance Impact
#### Response Time Impact
- [ ] None
- [ ] < 100ms increase
- [ ] 100ms - 1s increase
- [ ] > 1s increase

#### Resource Utilization
- [ ] Normal
- [ ] Elevated CPU
- [ ] Elevated Memory
- [ ] Elevated I/O
- [ ] Resource Exhaustion

#### Scalability Impact
- [ ] No impact
- [ ] Reduced scaling efficiency
- [ ] Scaling failures
- [ ] Complete scaling blockage

#### Availability Impact
- [ ] No impact
- [ ] Partial degradation
- [ ] Service interruption
- [ ] Complete outage

## Reproduction Steps
1. <!-- First step -->
2. <!-- Second step -->
3. <!-- Additional steps as needed -->

## Expected Behavior
<!-- Describe what should happen -->

## Actual Behavior
<!-- Describe what actually happens -->

## Additional Context
<!-- Add any other relevant context about the problem here -->

## Verification Checklist
- [ ] I have removed all PHI/PII from this report
- [ ] I have sanitized all logs and stack traces
- [ ] I have verified no credentials are exposed
- [ ] I have provided complete reproduction steps
- [ ] I have assessed security impact
- [ ] I have evaluated HIPAA compliance impact
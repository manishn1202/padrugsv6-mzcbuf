import React from 'react';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe, toHaveNoViolations } from 'jest-axe';
import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import ReviewForm from '../../../src/components/payer/ReviewForm';
import { PriorAuthRequest, PriorAuthStatus } from '../../../src/types/priorAuth';
import { ClinicalEvidence } from '../../../src/types/clinical';

// Add jest-axe matchers
expect.extend(toHaveNoViolations);

// Performance measurement decorator
const measurePerformance = (target: any, propertyKey: string, descriptor: PropertyDescriptor) => {
  const originalMethod = descriptor.value;
  descriptor.value = async function (...args: any[]) {
    const start = performance.now();
    const result = await originalMethod.apply(this, args);
    const end = performance.now();
    console.log(`${propertyKey} execution time: ${end - start}ms`);
    return result;
  };
  return descriptor;
};

// Test configuration
const AI_CONFIDENCE_THRESHOLDS = {
  HIGH: 90,
  MEDIUM: 70,
  LOW: 50,
};

// Helper function to create mock request data
const createMockRequest = (overrides: Partial<PriorAuthRequest> = {}): PriorAuthRequest => ({
  id: '123',
  provider_id: 'provider-123',
  status: PriorAuthStatus.IN_REVIEW,
  confidence_score: 85,
  evidence: {
    evidence_mapping: {
      'Failed previous therapy': {
        matched_text: ['Patient failed treatment with Drug A'],
        confidence: 95,
        source_location: 'clinical_notes'
      },
      'Current diagnosis': {
        matched_text: ['Confirmed diagnosis of condition X'],
        confidence: 75,
        source_location: 'diagnosis'
      }
    },
    clinical_data_id: 'clinical-123',
    criteria_id: 'criteria-123',
    evaluated_at: new Date(),
    model_version: '1.0.0'
  } as ClinicalEvidence,
  ...overrides
});

// Enhanced render helper with performance tracking
const renderReviewForm = async (props: Partial<PriorAuthRequest> = {}) => {
  const mockRequest = createMockRequest(props);
  const onSubmit = jest.fn();
  
  const renderStart = performance.now();
  const result = render(
    <ReviewForm
      request={mockRequest}
      onSubmit={onSubmit}
      isLoading={false}
      confidenceThresholds={AI_CONFIDENCE_THRESHOLDS}
    />
  );
  const renderEnd = performance.now();
  
  return {
    ...result,
    onSubmit,
    renderTime: renderEnd - renderStart,
    mockRequest
  };
};

describe('ReviewForm Component', () => {
  let consoleError: jest.SpyInstance;
  
  beforeEach(() => {
    consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleError.mockRestore();
  });

  describe('AI-Assisted Review Features', () => {
    it('should display confidence scores with appropriate visual indicators', async () => {
      const { mockRequest } = await renderReviewForm();
      
      // Check overall confidence score
      const scoreElement = screen.getByText(`${Math.round(mockRequest.confidence_score)}%`);
      expect(scoreElement).toBeInTheDocument();
      expect(scoreElement.parentElement).toHaveClass('bg-warning-100');

      // Check individual evidence matches
      Object.entries(mockRequest.evidence.evidence_mapping).forEach(([criteria, match]) => {
        const matchElement = screen.getByText(criteria);
        expect(matchElement).toBeInTheDocument();
        
        const confidenceScore = screen.getByText(`${Math.round(match.confidence)}%`);
        expect(confidenceScore).toBeInTheDocument();
      });
    });

    it('should highlight evidence based on confidence thresholds', async () => {
      await renderReviewForm();
      
      const evidenceElements = screen.getAllByRole('region');
      evidenceElements.forEach(element => {
        const confidence = parseInt(within(element).getByText(/%/).textContent!);
        
        if (confidence >= AI_CONFIDENCE_THRESHOLDS.HIGH) {
          expect(element).toHaveClass('bg-success-50');
        } else if (confidence >= AI_CONFIDENCE_THRESHOLDS.MEDIUM) {
          expect(element).toHaveClass('bg-warning-50');
        } else {
          expect(element).toHaveClass('bg-error-50');
        }
      });
    });
  });

  describe('Form Functionality', () => {
    it('should handle decision selection and submission', async () => {
      const { onSubmit } = await renderReviewForm();
      
      // Select decision
      const approveRadio = screen.getByLabelText('Approve');
      await userEvent.click(approveRadio);
      expect(approveRadio).toBeChecked();

      // Add notes
      const notesTextarea = screen.getByLabelText('Review Notes');
      await userEvent.type(notesTextarea, 'Approved based on clinical evidence');
      
      // Submit form
      const submitButton = screen.getByRole('button', { name: /submit review/i });
      await userEvent.click(submitButton);

      expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({
        decision: PriorAuthStatus.APPROVED,
        notes: 'Approved based on clinical evidence',
        confidenceScore: expect.any(Number)
      }));
    });

    it('should handle escalation to medical director', async () => {
      await renderReviewForm();
      
      const escalateCheckbox = screen.getByLabelText(/escalate to medical director/i);
      await userEvent.click(escalateCheckbox);
      
      // Check if escalation reason field appears
      const reasonTextarea = screen.getByLabelText('Escalation Reason');
      expect(reasonTextarea).toBeInTheDocument();
      
      await userEvent.type(reasonTextarea, 'Complex case requiring MD review');
      expect(reasonTextarea).toHaveValue('Complex case requiring MD review');
    });
  });

  describe('Accessibility', () => {
    it('should have no accessibility violations', async () => {
      const { container } = await renderReviewForm();
      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    it('should support keyboard navigation', async () => {
      await renderReviewForm();
      
      const form = screen.getByRole('form');
      expect(form).toHaveAttribute('aria-label', 'Prior Authorization Review Form');

      // Test keyboard navigation
      await userEvent.tab();
      expect(screen.getByLabelText('Approve')).toHaveFocus();
      
      await userEvent.tab();
      expect(screen.getByLabelText('Deny')).toHaveFocus();
      
      await userEvent.tab();
      expect(screen.getByLabelText('Request Additional Information')).toHaveFocus();
    });
  });

  describe('Performance', () => {
    it('should render within performance budget', async () => {
      const { renderTime } = await renderReviewForm();
      expect(renderTime).toBeLessThan(100); // 100ms budget
    });

    it('should handle large evidence sets efficiently', async () => {
      const largeEvidence = {
        evidence_mapping: Array.from({ length: 100 }, (_, i) => ({
          [`Criteria ${i}`]: {
            matched_text: [`Evidence ${i}`],
            confidence: Math.random() * 100,
            source_location: 'test'
          }
        })).reduce((acc, curr) => ({ ...acc, ...curr }), {})
      };

      const start = performance.now();
      await renderReviewForm({ evidence: largeEvidence as ClinicalEvidence });
      const end = performance.now();

      expect(end - start).toBeLessThan(200); // 200ms budget for large datasets
    });
  });

  describe('HIPAA Compliance', () => {
    it('should sanitize PHI in error messages', async () => {
      const { onSubmit } = await renderReviewForm();
      
      // Submit form without required fields
      const submitButton = screen.getByRole('button', { name: /submit review/i });
      await userEvent.click(submitButton);

      // Check error messages for PHI
      const errorMessages = screen.getAllByRole('alert');
      errorMessages.forEach(message => {
        expect(message.textContent).not.toMatch(/\b\d{3}-\d{2}-\d{4}\b/); // SSN pattern
        expect(message.textContent).not.toMatch(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i); // Email pattern
      });
    });

    it('should log appropriate audit events', async () => {
      const auditLogSpy = jest.spyOn(console, 'info').mockImplementation();
      const { onSubmit } = await renderReviewForm();

      // Perform sensitive actions
      await userEvent.click(screen.getByLabelText('Approve'));
      await userEvent.click(screen.getByRole('button', { name: /submit review/i }));

      expect(auditLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('AUDIT:'),
        expect.not.stringContaining('PHI')
      );
    });
  });
});
import React from 'react';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, describe, it, expect, beforeEach, beforeAll, afterEach } from 'vitest';
import { axe, toHaveNoViolations } from '@axe-core/react';
import { setupServer } from 'msw';
import { rest } from 'msw';
import { PriorAuthForm } from '../../../src/components/provider/PriorAuthForm';
import { PriorAuthStatus } from '../../../src/types/priorAuth';
import { DocumentType, EncryptionStatus } from '../../../src/types/documents';
import { API_ENDPOINTS } from '../../../src/config/api';

// Add jest-axe matchers
expect.extend(toHaveNoViolations);

// Mock services and dependencies
vi.mock('../../../src/lib/api/documents');
vi.mock('../../../src/lib/api/drugs');

// Test data
const mockValidFormData = {
  patient_data: {
    firstName: 'John',
    lastName: 'Doe',
    dob: '1990-01-01',
    mrn: 'MRN123456',
    phone: '555-555-5555',
    email: 'john.doe@email.com'
  },
  drug: {
    drug_code: 'DRUG123',
    drug_name: 'Abilify',
    quantity: 30,
    days_supply: 30,
    refills: 1
  },
  documents: [
    {
      id: 'doc1',
      filename: 'clinical_notes.pdf',
      document_type: DocumentType.CLINICAL_NOTES,
      encryption_status: EncryptionStatus.ENCRYPTED
    }
  ]
};

// MSW server setup for API mocking
const server = setupServer(
  // EMR integration endpoint
  rest.get(`${API_ENDPOINTS.CLINICAL.EVIDENCE}/:mrn`, (req, res, ctx) => {
    return res(
      ctx.json({
        patient_data: mockValidFormData.patient_data,
        clinical_data: {
          diagnosis: 'F41.9',
          medications: ['Drug1', 'Drug2']
        }
      })
    );
  }),

  // Drug formulary verification endpoint
  rest.get(`${API_ENDPOINTS.FORMULARY.DETAILS}/:drugId/coverage/:payerId`, (req, res, ctx) => {
    return res(
      ctx.json({
        covered: true,
        tier: 2,
        restrictions: {
          prior_auth_required: true
        }
      })
    );
  })
);

describe('PriorAuthForm', () => {
  // Test suite setup
  beforeAll(() => {
    server.listen();
  });

  afterEach(() => {
    server.resetHandlers();
    vi.clearAllMocks();
  });

  beforeEach(() => {
    // Reset form state before each test
    localStorage.clear();
  });

  // Accessibility Tests
  describe('Accessibility', () => {
    it('should have no accessibility violations', async () => {
      const { container } = render(
        <PriorAuthForm
          payerId="PAYER123"
          onSubmit={vi.fn()}
          onError={vi.fn()}
          onEncryptionStatus={vi.fn()}
        />
      );
      
      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    it('should have proper ARIA labels and roles', () => {
      render(
        <PriorAuthForm
          payerId="PAYER123"
          onSubmit={vi.fn()}
          onError={vi.fn()}
          onEncryptionStatus={vi.fn()}
        />
      );

      expect(screen.getByRole('form')).toBeInTheDocument();
      expect(screen.getByLabelText(/patient information/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/medication details/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/supporting documentation/i)).toBeInTheDocument();
    });

    it('should handle keyboard navigation correctly', async () => {
      render(
        <PriorAuthForm
          payerId="PAYER123"
          onSubmit={vi.fn()}
          onError={vi.fn()}
          onEncryptionStatus={vi.fn()}
        />
      );

      const firstInput = screen.getByLabelText(/first name/i);
      firstInput.focus();
      expect(document.activeElement).toBe(firstInput);

      // Tab through form fields
      await userEvent.tab();
      expect(document.activeElement).toHaveAttribute('name', 'lastName');
    });
  });

  // Form Validation Tests
  describe('Form Validation', () => {
    it('should validate required fields', async () => {
      const onSubmit = vi.fn();
      render(
        <PriorAuthForm
          payerId="PAYER123"
          onSubmit={onSubmit}
          onError={vi.fn()}
          onEncryptionStatus={vi.fn()}
        />
      );

      // Try to submit empty form
      fireEvent.click(screen.getByText(/submit request/i));

      await waitFor(() => {
        expect(screen.getByText(/patient information is required/i)).toBeInTheDocument();
        expect(screen.getByText(/drug selection is required/i)).toBeInTheDocument();
        expect(onSubmit).not.toHaveBeenCalled();
      });
    });

    it('should validate patient data format', async () => {
      render(
        <PriorAuthForm
          payerId="PAYER123"
          onSubmit={vi.fn()}
          onError={vi.fn()}
          onEncryptionStatus={vi.fn()}
        />
      );

      // Enter invalid phone number
      const phoneInput = screen.getByLabelText(/phone/i);
      await userEvent.type(phoneInput, '123');

      expect(screen.getByText(/please enter a valid phone number/i)).toBeInTheDocument();
    });
  });

  // EMR Integration Tests
  describe('EMR Integration', () => {
    it('should import patient data from EMR', async () => {
      const onEmrImport = vi.fn();
      render(
        <PriorAuthForm
          payerId="PAYER123"
          onSubmit={vi.fn()}
          onError={vi.fn()}
          onEncryptionStatus={vi.fn()}
          onEmrImport={onEmrImport}
        />
      );

      // Click EMR import button
      fireEvent.click(screen.getByText(/import from emr/i));

      await waitFor(() => {
        expect(screen.getByDisplayValue(mockValidFormData.patient_data.firstName)).toBeInTheDocument();
        expect(screen.getByDisplayValue(mockValidFormData.patient_data.lastName)).toBeInTheDocument();
        expect(onEmrImport).toHaveBeenCalledWith(true);
      });
    });
  });

  // Document Management Tests
  describe('Document Management', () => {
    it('should handle document uploads with encryption', async () => {
      const onEncryptionStatus = vi.fn();
      render(
        <PriorAuthForm
          payerId="PAYER123"
          onSubmit={vi.fn()}
          onError={vi.fn()}
          onEncryptionStatus={onEncryptionStatus}
        />
      );

      const file = new File(['test content'], 'test.pdf', { type: 'application/pdf' });
      const fileInput = screen.getByLabelText(/upload medical document/i);

      await userEvent.upload(fileInput, file);

      await waitFor(() => {
        expect(onEncryptionStatus).toHaveBeenCalledWith(true);
      });
    });
  });

  // Form Submission Tests
  describe('Form Submission', () => {
    it('should submit form with complete data', async () => {
      const onSubmit = vi.fn();
      render(
        <PriorAuthForm
          payerId="PAYER123"
          onSubmit={onSubmit}
          onError={vi.fn()}
          onEncryptionStatus={vi.fn()}
        />
      );

      // Fill form with valid data
      await userEvent.type(screen.getByLabelText(/first name/i), mockValidFormData.patient_data.firstName);
      await userEvent.type(screen.getByLabelText(/last name/i), mockValidFormData.patient_data.lastName);

      // Select drug
      const drugSelect = screen.getByLabelText(/medication/i);
      await userEvent.type(drugSelect, mockValidFormData.drug.drug_name);
      await userEvent.click(screen.getByText(mockValidFormData.drug.drug_name));

      // Submit form
      await userEvent.click(screen.getByText(/submit request/i));

      await waitFor(() => {
        expect(onSubmit).toHaveBeenCalledWith(
          expect.objectContaining({
            status: PriorAuthStatus.SUBMITTED,
            patient_data: expect.objectContaining(mockValidFormData.patient_data),
            drug: expect.objectContaining(mockValidFormData.drug)
          })
        );
      });
    });
  });

  // Error Handling Tests
  describe('Error Handling', () => {
    it('should handle API errors gracefully', async () => {
      const onError = vi.fn();
      server.use(
        rest.get(`${API_ENDPOINTS.CLINICAL.EVIDENCE}/:mrn`, (req, res, ctx) => {
          return res(ctx.status(500));
        })
      );

      render(
        <PriorAuthForm
          payerId="PAYER123"
          onSubmit={vi.fn()}
          onError={onError}
          onEncryptionStatus={vi.fn()}
        />
      );

      // Trigger EMR import
      fireEvent.click(screen.getByText(/import from emr/i));

      await waitFor(() => {
        expect(onError).toHaveBeenCalledWith(expect.any(Error));
      });
    });
  });
});
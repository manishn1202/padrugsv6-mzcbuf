import React, { useState, useCallback, useEffect, useRef } from 'react';
import debounce from 'lodash/debounce';
import { Select } from '../common/Select';
import { searchDrugs, verifyFormulary } from '../../lib/api/drugs';
import { DrugRequest } from '../../types/priorAuth';

// @version lodash@4.17.21
// @version react@18.2.0

/**
 * Props interface for DrugSelection component with enhanced error handling
 */
interface DrugSelectionProps {
  /** Currently selected drug details with FHIR compliance */
  value: DrugRequest;
  /** Handler for drug selection changes with validation */
  onChange: (drug: DrugRequest) => void;
  /** Insurance payer ID for formulary verification */
  payerId: string;
  /** Detailed error message with retry suggestions */
  error?: string;
}

/**
 * Interface for drug search results with enhanced type safety
 */
interface DrugSearchResult {
  value: string;
  label: string;
  code: string;
  strength: string;
  form: string;
  route: string;
}

/**
 * DrugSelection component for searching and selecting drugs with formulary verification
 * Implements caching, rate limiting, and HIPAA-compliant data handling
 */
export const DrugSelection: React.FC<DrugSelectionProps> = ({
  value,
  onChange,
  payerId,
  error: propError
}) => {
  // Component state
  const [searchResults, setSearchResults] = useState<DrugSearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | undefined>(propError);
  const [formularyStatus, setFormularyStatus] = useState<{
    covered: boolean;
    message?: string;
  }>();

  // Refs for tracking component state
  const searchTimeoutRef = useRef<NodeJS.Timeout>();
  const loadingTimeoutRef = useRef<NodeJS.Timeout>();

  // Clear timeouts on unmount
  useEffect(() => {
    return () => {
      if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
      if (loadingTimeoutRef.current) clearTimeout(loadingTimeoutRef.current);
    };
  }, []);

  /**
   * Debounced drug search handler with caching and rate limiting
   */
  const handleSearch = useCallback(
    debounce(async (query: string) => {
      if (query.length < 3) return;

      try {
        setLoading(true);
        setError(undefined);

        // Set loading timeout for UX feedback
        loadingTimeoutRef.current = setTimeout(() => {
          setLoading(false);
        }, 10000);

        const response = await searchDrugs(query, {
          page: 1,
          page_size: 10,
          sort_by: 'relevance',
          sort_direction: 'DESC'
        });

        // Transform API response to select options
        const options = response.items.map(drug => ({
          value: drug.id,
          label: `${drug.name} ${drug.strength} ${drug.form}`,
          code: drug.code,
          strength: drug.strength,
          form: drug.dosage_form,
          route: drug.route
        }));

        setSearchResults(options);
      } catch (err) {
        setError('Error searching drugs. Please try again.');
        console.error('Drug search error:', err);
      } finally {
        setLoading(false);
        if (loadingTimeoutRef.current) {
          clearTimeout(loadingTimeoutRef.current);
        }
      }
    }, 300),
    []
  );

  /**
   * Handles drug selection and formulary verification
   */
  const handleDrugSelect = useCallback(async (selectedDrug: DrugSearchResult) => {
    try {
      setLoading(true);
      setError(undefined);

      // Verify formulary coverage
      const formularyResponse = await verifyFormulary(selectedDrug.code, payerId);

      // Update formulary status
      setFormularyStatus({
        covered: formularyResponse.data.covered,
        message: formularyResponse.data.covered
          ? 'Drug is covered by insurance'
          : 'Drug is not covered - please check alternatives'
      });

      // Update drug selection with complete details
      onChange({
        drug_code: selectedDrug.code,
        drug_name: selectedDrug.label,
        quantity: value.quantity || 0,
        days_supply: value.days_supply || 0,
        refills: value.refills || 0,
        form: selectedDrug.form,
        strength: selectedDrug.strength,
        route: selectedDrug.route,
        medicationReference: {
          reference: `Medication/${selectedDrug.code}`,
          display: selectedDrug.label
        },
        dosageInstruction: []
      });

    } catch (err) {
      setError('Error verifying drug coverage. Please try again.');
      console.error('Formulary verification error:', err);
    } finally {
      setLoading(false);
    }
  }, [onChange, payerId, value]);

  /**
   * Handles quantity, days supply, and refills updates
   */
  const handleDetailsChange = useCallback((field: keyof DrugRequest, value: number) => {
    onChange({
      ...value,
      [field]: value
    });
  }, [onChange, value]);

  return (
    <div className="space-y-4">
      {/* Drug Search Select */}
      <div>
        <label 
          htmlFor="drug-select"
          className="block text-sm font-medium text-gray-700"
        >
          Medication
        </label>
        <Select
          id="drug-select"
          value={value.drug_code}
          onChange={(drugId: string) => {
            const selected = searchResults.find(d => d.value === drugId);
            if (selected) handleDrugSelect(selected);
          }}
          onSearch={handleSearch}
          options={searchResults}
          placeholder="Search for a medication..."
          loading={loading}
          error={error}
        />
        {formularyStatus && (
          <p className={`mt-1 text-sm ${formularyStatus.covered ? 'text-green-600' : 'text-red-600'}`}>
            {formularyStatus.message}
          </p>
        )}
      </div>

      {/* Quantity Input */}
      <div>
        <label 
          htmlFor="quantity"
          className="block text-sm font-medium text-gray-700"
        >
          Quantity
        </label>
        <input
          type="number"
          id="quantity"
          value={value.quantity}
          onChange={e => handleDetailsChange('quantity', parseInt(e.target.value))}
          min={0}
          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm"
        />
      </div>

      {/* Days Supply Input */}
      <div>
        <label 
          htmlFor="days-supply"
          className="block text-sm font-medium text-gray-700"
        >
          Days Supply
        </label>
        <input
          type="number"
          id="days-supply"
          value={value.days_supply}
          onChange={e => handleDetailsChange('days_supply', parseInt(e.target.value))}
          min={0}
          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm"
        />
      </div>

      {/* Refills Input */}
      <div>
        <label 
          htmlFor="refills"
          className="block text-sm font-medium text-gray-700"
        >
          Refills
        </label>
        <input
          type="number"
          id="refills"
          value={value.refills}
          onChange={e => handleDetailsChange('refills', parseInt(e.target.value))}
          min={0}
          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm"
        />
      </div>

      {/* Error Display */}
      {error && (
        <p className="mt-2 text-sm text-red-600" role="alert">
          {error}
        </p>
      )}
    </div>
  );
};
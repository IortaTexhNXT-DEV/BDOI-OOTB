// Simple test file to verify lead service functionality
import leadService from '../leadService';

// Mock fetch for testing
global.fetch = jest.fn();

describe('LeadService', () => {
  beforeEach(() => {
    fetch.mockClear();
  });

  test('createLead should make POST request to /api/leads', async () => {
    const mockResponse = {
      success: true,
      data: { id: 1, firstName: 'John', lastName: 'Doe' }
    };

    fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockResponse,
    });

    const leadData = {
      firstName: 'John',
      lastName: 'Doe',
      preferredName: 'Johnny',
      DOB: '1990-05-15',
      gender: 'Male',
      emailId: 'john.doe@email.com',
      contactNumber: '+1-555-0123',
      houseNo: '123',
      barangay: 'Barangay 1',
      country: 'Thailand',
      province: 'Metro Manila',
      city: 'Makati',
      zipCode: '1234',
      leadCategory: 'Premium',
      createdBy: 'admin'
    };

    const result = await leadService.createLead(leadData);

    expect(fetch).toHaveBeenCalledWith(
      'http://localhost:3000/api/leads',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          'Content-Type': 'application/json',
        }),
        body: JSON.stringify(leadData),
      })
    );

    expect(result.success).toBe(true);
    expect(result.data).toEqual(mockResponse);
  });

  test('createLead should handle API errors', async () => {
    fetch.mockResolvedValueOnce({
      ok: false,
      json: async () => ({ message: 'Validation failed' }),
    });

    const leadData = {
      firstName: 'John',
      lastName: 'Doe',
      // Missing required fields
    };

    const result = await leadService.createLead(leadData);

    expect(result.success).toBe(false);
    expect(result.error).toBe('Validation failed');
  });

  test('createLead should handle network errors', async () => {
    fetch.mockRejectedValueOnce(new Error('Network error'));

    const leadData = {
      firstName: 'John',
      lastName: 'Doe',
    };

    const result = await leadService.createLead(leadData);

    expect(result.success).toBe(false);
    expect(result.error).toBe('Network error');
  });
});

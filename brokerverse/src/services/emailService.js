import authService from './authService';
import { BASE_URL } from '../utility/constant';

/**
 * Email Service - Handles sending emails
 */
class EmailService {
  constructor() {
    this.baseURL = `${BASE_URL}/email`;
  }

  /**
   * Share quote via email
   * @param {string} to - Recipient email address
   * @param {Object} quotationData - Quotation data to share
   * @param {string} message - Optional custom message
   * @returns {Promise<Object>} Result
   */
  async shareQuote(to, quotationData, message = '') {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000);

      console.log('Sharing quote via email:', to);

      const response = await fetch(`${this.baseURL}/share-quote`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...authService.getAuthHeader()
        },
        body: JSON.stringify({ to, quotationData, message }),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to share quote via email');
      }

      const data = await response.json();
      console.log('Quote shared successfully:', data);

      return {
        success: true,
        data: data
      };
    } catch (error) {
      console.error('Share quote error:', error);
      return {
        success: false,
        error: error.name === 'AbortError' ? 'Request timeout. Please try again.' : (error.message || 'Failed to share quote')
      };
    }
  }

  /**
   * Share quote to insurance companies (one email per company, PDF attached)
   * @param {Object} params
   * @param {string} params.quotationId
   * @param {string[]} params.insuranceCompanies
   * @param {string} [params.productType]
   * @param {string} [params.quotationNumber]
   * @returns {Promise<Object>} Result
   */
  async shareQuoteToInsurers({
    quotationId,
    insuranceCompanies,
    productType,
    quotationNumber,
  }) {
    try {
      const controller = new AbortController();
      // PDF generation + multiple sends can take longer than a single email
      const timeoutId = setTimeout(() => controller.abort(), 60000);

      console.log('Sharing quote to insurers:', insuranceCompanies);

      const response = await fetch(`${this.baseURL}/share-quote-to-insurers`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...authService.getAuthHeader()
        },
        body: JSON.stringify({
          quotationId,
          insuranceCompanies,
          productType,
          quotationNumber,
        }),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(
          errorData.message || 'Failed to share quote to insurance companies'
        );
      }

      const data = await response.json();
      console.log('Quote shared to insurers successfully:', data);

      return {
        success: true,
        data,
        partial: Array.isArray(data?.data?.failed) && data.data.failed.length > 0,
      };
    } catch (error) {
      console.error('Share quote to insurers error:', error);
      return {
        success: false,
        error:
          error.name === 'AbortError'
            ? 'Request timeout. Please try again.'
            : error.message || 'Failed to share quote to insurance companies',
      };
    }
  }

  /**
   * Send custom email
   * @param {Object} emailData - Email data (to, subject, text/html)
   * @returns {Promise<Object>} Result
   */
  async sendEmail(emailData) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000);

      console.log('Sending email to:', emailData.to);

      const response = await fetch(`${this.baseURL}/send`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...authService.getAuthHeader()
        },
        body: JSON.stringify(emailData),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to send email');
      }

      const data = await response.json();
      console.log('Email sent successfully:', data);

      return {
        success: true,
        data: data
      };
    } catch (error) {
      console.error('Send email error:', error);
      return {
        success: false,
        error: error.name === 'AbortError' ? 'Request timeout. Please try again.' : (error.message || 'Failed to send email')
      };
    }
  }

  /**
   * Generate AI-powered email content
   * @param {Object} params - Generation parameters
   * @param {string} params.template - Template type (welcome, policy-renewal, custom)
   * @param {Object} params.context - Domain context (quote data, policy data, etc.)
   * @param {Object} params.recipient - Recipient information
   * @param {Object} params.brand - Brand tone customization
   * @returns {Promise<Object>} Result with generated content
   */
  async generateEmailContent({ template = 'custom', context = {}, recipient = {}, brand = {} }) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000); // Longer timeout for AI

      console.log('Generating AI email content...');

      const response = await fetch(`${this.baseURL}/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...authService.getAuthHeader()
        },
        body: JSON.stringify({ template, context, recipient, brand }),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to generate email content');
      }

      const data = await response.json();
      console.log('Email content generated successfully:', data);

      return {
        success: true,
        data: data.data // { subject, previewText, html, text }
      };
    } catch (error) {
      console.error('Generate email content error:', error);
      return {
        success: false,
        error: error.name === 'AbortError' ? 'Request timeout. AI is taking too long.' : (error.message || 'Failed to generate content')
      };
    }
  }
}

const emailService = new EmailService();
export default emailService;


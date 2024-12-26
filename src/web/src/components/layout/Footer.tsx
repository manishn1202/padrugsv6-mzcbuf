import React from 'react';
import { classNames } from '../../utils/format';

/**
 * Props interface for Footer component
 * @version 1.0.0
 */
interface FooterProps {
  /** Optional CSS class name for additional styling */
  className?: string;
}

/**
 * Footer component that provides consistent footer content across all pages
 * Implements responsive design and accessibility requirements
 * 
 * @version 1.0.0
 * @param {FooterProps} props - Component props
 * @returns {JSX.Element} Footer component
 */
const Footer: React.FC<FooterProps> = ({ className }) => {
  const currentYear = new Date().getFullYear();
  const appVersion = process.env.REACT_APP_VERSION || '1.0.0';

  return (
    <footer 
      className={classNames('footer', className)}
      role="contentinfo"
      aria-label="Site footer"
    >
      <div className="footer__content">
        <nav 
          className="footer__links"
          aria-label="Footer navigation"
        >
          <a 
            href="/privacy"
            className="footer__link"
            target="_blank"
            rel="noopener noreferrer"
          >
            Privacy Policy
          </a>
          <span className="footer__separator" aria-hidden="true">|</span>
          <a 
            href="/terms"
            className="footer__link"
            target="_blank"
            rel="noopener noreferrer"
          >
            Terms of Use
          </a>
          <span className="footer__separator" aria-hidden="true">|</span>
          <a 
            href="/accessibility"
            className="footer__link"
            target="_blank"
            rel="noopener noreferrer"
          >
            Accessibility
          </a>
          <span className="footer__separator" aria-hidden="true">|</span>
          <a 
            href="/support"
            className="footer__link"
            target="_blank"
            rel="noopener noreferrer"
          >
            Support
          </a>
        </nav>

        <div className="footer__info">
          <p 
            className="footer__compliance"
            aria-label="HIPAA compliance notice"
          >
            This system maintains HIPAA compliance for protected health information
          </p>
          
          <p className="footer__copyright">
            © {currentYear} Prior Authorization Management System. All rights reserved.
          </p>
          
          <p 
            className="footer__version"
            aria-label="Application version"
          >
            Version {appVersion}
          </p>
        </div>
      </div>

      <style jsx>{`
        .footer {
          width: 100%;
          padding: var(--spacing-md);
          background: var(--color-background-secondary);
          border-top: 1px solid var(--color-border);
          color: var(--color-text-secondary);
        }

        .footer__content {
          max-width: var(--max-width-desktop);
          margin: 0 auto;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: var(--spacing-md);
        }

        .footer__links {
          display: flex;
          align-items: center;
          gap: var(--spacing-md);
          flex-wrap: wrap;
          justify-content: center;
        }

        .footer__link {
          color: var(--color-primary);
          text-decoration: none;
          font-size: var(--font-size-sm);
          transition: color 0.2s ease;
        }

        .footer__link:hover,
        .footer__link:focus {
          color: var(--color-primary-dark);
          text-decoration: underline;
        }

        .footer__separator {
          color: var(--color-border);
          margin: 0 var(--spacing-sm);
        }

        .footer__info {
          text-align: center;
        }

        .footer__compliance {
          font-weight: 500;
          color: var(--color-text-primary);
          margin-bottom: var(--spacing-sm);
        }

        .footer__copyright {
          font-size: var(--font-size-sm);
          margin-bottom: var(--spacing-xs);
        }

        .footer__version {
          font-family: var(--font-family-mono);
          font-size: var(--font-size-xs);
          color: var(--color-text-tertiary);
        }

        /* Responsive styles */
        @media (max-width: 576px) {
          .footer {
            padding: var(--spacing-sm);
          }

          .footer__links {
            flex-direction: column;
            gap: var(--spacing-sm);
          }

          .footer__separator {
            display: none;
          }
        }

        @media (min-width: 577px) and (max-width: 992px) {
          .footer__content {
            gap: var(--spacing-sm);
          }

          .footer__links {
            gap: var(--spacing-sm);
          }
        }
      `}</style>
    </footer>
  );
};

export default Footer;
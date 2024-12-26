import React, { useEffect, useRef, useState, useCallback } from 'react';
import ReactDOM from 'react-dom';
import '../../styles/components.css';
import '../../styles/animations.css';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
  title?: string;
  size?: 'sm' | 'md' | 'lg';
  closeOnOverlayClick?: boolean;
  ariaLabel?: string;
  dataTestId?: string;
  preventBackgroundScroll?: boolean;
  role?: 'dialog' | 'alertdialog';
}

// Custom hook for managing focus trap within modal
const useModalFocus = (modalRef: React.RefObject<HTMLDivElement>, isOpen: boolean) => {
  const previousActiveElement = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (isOpen && modalRef.current) {
      // Store current active element
      previousActiveElement.current = document.activeElement as HTMLElement;

      // Get all focusable elements
      const focusableElements = modalRef.current.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      const firstFocusable = focusableElements[0];
      const lastFocusable = focusableElements[focusableElements.length - 1];

      // Focus first element
      firstFocusable?.focus();

      // Handle tab navigation
      const handleTabKey = (e: KeyboardEvent) => {
        if (e.key !== 'Tab') return;

        if (e.shiftKey) {
          if (document.activeElement === firstFocusable) {
            e.preventDefault();
            lastFocusable?.focus();
          }
        } else {
          if (document.activeElement === lastFocusable) {
            e.preventDefault();
            firstFocusable?.focus();
          }
        }
      };

      modalRef.current.addEventListener('keydown', handleTabKey);

      return () => {
        modalRef.current?.removeEventListener('keydown', handleTabKey);
        // Restore focus on cleanup
        previousActiveElement.current?.focus();
      };
    }
  }, [isOpen, modalRef]);
};

// Custom hook for managing document scroll lock
const useScrollLock = (isOpen: boolean, preventBackgroundScroll?: boolean) => {
  useEffect(() => {
    if (isOpen && preventBackgroundScroll) {
      const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;
      const originalPadding = window.getComputedStyle(document.body).getPropertyValue('padding-right');

      // Prevent body scroll
      document.body.style.overflow = 'hidden';
      document.body.style.paddingRight = `${scrollbarWidth}px`;

      return () => {
        document.body.style.overflow = '';
        document.body.style.paddingRight = originalPadding;
      };
    }
  }, [isOpen, preventBackgroundScroll]);
};

const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  children,
  title,
  size = 'md',
  closeOnOverlayClick = true,
  ariaLabel,
  dataTestId,
  preventBackgroundScroll = true,
  role = 'dialog'
}) => {
  const modalRef = useRef<HTMLDivElement>(null);
  const [animationState, setAnimationState] = useState<'entering' | 'entered' | 'exiting' | 'exited'>('exited');

  // Setup focus trap
  useModalFocus(modalRef, isOpen);

  // Setup scroll lock
  useScrollLock(isOpen, preventBackgroundScroll);

  // Handle escape key press
  const handleEscapeKey = useCallback((event: KeyboardEvent) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      onClose();
    }
  }, [onClose]);

  // Handle animation states
  useEffect(() => {
    if (isOpen) {
      setAnimationState('entering');
      const timer = setTimeout(() => setAnimationState('entered'), 300);
      return () => clearTimeout(timer);
    } else {
      setAnimationState('exiting');
      const timer = setTimeout(() => setAnimationState('exited'), 300);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  // Add/remove event listeners
  useEffect(() => {
    if (isOpen) {
      document.addEventListener('keydown', handleEscapeKey);
      return () => document.removeEventListener('keydown', handleEscapeKey);
    }
  }, [isOpen, handleEscapeKey]);

  // Don't render if not open and animation has completed
  if (!isOpen && animationState === 'exited') return null;

  const modalContent = (
    <div
      className={`modal ${animationState === 'entering' || animationState === 'entered' ? 'fade-in' : 'fade-out'}`}
      onClick={closeOnOverlayClick ? onClose : undefined}
      data-testid={dataTestId}
    >
      <div
        ref={modalRef}
        className={`modal__content modal__content--${size}`}
        role={role}
        aria-label={ariaLabel || title}
        aria-modal="true"
        onClick={e => e.stopPropagation()}
      >
        {title && (
          <h2 className="modal__title" id="modal-title">
            {title}
          </h2>
        )}
        <div className="modal__body">
          {children}
        </div>
        <button
          className="modal__close"
          onClick={onClose}
          aria-label="Close modal"
          type="button"
        >
          <span aria-hidden="true">&times;</span>
        </button>
      </div>
    </div>
  );

  // Render modal in portal
  return ReactDOM.createPortal(
    modalContent,
    document.body
  );
};

export default Modal;
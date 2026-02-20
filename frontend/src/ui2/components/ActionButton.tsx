/**
 * UI2 ActionButton Component
 * Icon-based action buttons for tables and toolbars
 */

import React from 'react';

export interface ActionButtonProps {
  icon: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  title?: string;
  testId?: string;
}

export function ActionButton({ icon, onClick, disabled, title, testId }: ActionButtonProps) {
  return (
    <button
      className="ui2-icon-btn"
      onClick={onClick}
      disabled={disabled}
      title={title}
      data-testid={testId}
      type="button"
    >
      {icon}
    </button>
  );
}

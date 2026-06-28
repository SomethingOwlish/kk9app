import * as React from 'react';

/**
 * Input — from @kk9/asgard@1.0.0.
 * @replaces input
 */
export interface InputProps {
  value?: string;
  onChange?: ChangeEventHandler<HTMLInputElement>;
  placeholder?: string;
  size?: "sm";
  type?: string;
}

export declare const Input: React.ComponentType<InputProps>;

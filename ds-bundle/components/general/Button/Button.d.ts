import * as React from 'react';

/**
 * Button — from @kk9/asgard@1.0.0.
 * @replaces button
 */
export interface ButtonProps {
  children: React.ReactNode;
  variant?: "danger" | "primary" | "ghost";
  size?: "sm";
  onClick?: MouseEventHandler<HTMLButtonElement>;
  disabled?: boolean;
  type?: "button" | "submit" | "reset";
}

export declare const Button: React.ComponentType<ButtonProps>;

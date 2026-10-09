import { forwardRef } from "react";
import { Icon, type IconName } from "../icons";

type Variant = "primary" | "secondary" | "ghost" | "danger";

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  icon?: IconName;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "secondary", icon, className, children, type = "button", ...rest },
  ref,
) {
  return (
    <button ref={ref} type={type} className={`btn btn-${variant} ${className ?? ""}`} {...rest}>
      {icon && <Icon name={icon} />}
      {children}
    </button>
  );
});

export interface IconButtonProps extends Omit<
  React.ButtonHTMLAttributes<HTMLButtonElement>,
  "children"
> {
  icon: IconName;
  /** Required: icon buttons have no visible text. */
  label: string;
  variant?: Variant;
  pressed?: boolean;
}

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
  { icon, label, variant = "ghost", pressed, className, type = "button", ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      aria-label={label}
      title={label}
      aria-pressed={pressed}
      className={`btn btn-icon btn-${variant} ${className ?? ""}`}
      {...rest}
    >
      <Icon name={icon} />
    </button>
  );
});

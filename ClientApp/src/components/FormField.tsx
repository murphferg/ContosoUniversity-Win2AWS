import { useId } from 'react';

export interface FormFieldProps {
  label: string;
  name: string;
  type?: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  errors?: string[];
  required?: boolean;
  maxLength?: number;
  min?: string | number;
  max?: string | number;
  placeholder?: string;
}

export function FormField({
  label,
  name,
  type = 'text',
  value,
  onChange,
  errors,
  required,
  maxLength,
  min,
  max,
  placeholder,
}: FormFieldProps) {
  const generatedId = useId();
  const inputId = `${name}-${generatedId}`;
  const errorId = `${name}-error-${generatedId}`;
  const hasErrors = errors != null && errors.length > 0;

  return (
    <div style={{ marginBottom: '1rem' }}>
      <label htmlFor={inputId} style={{ display: 'block', marginBottom: '0.25rem' }}>
        {label}
        {required && <span aria-hidden="true"> *</span>}
      </label>
      <input
        id={inputId}
        name={name}
        type={type}
        value={value}
        onChange={onChange}
        required={required}
        maxLength={maxLength}
        min={min}
        max={max}
        placeholder={placeholder}
        aria-invalid={hasErrors ? true : undefined}
        aria-describedby={hasErrors ? errorId : undefined}
        style={{
          display: 'block',
          width: '100%',
          padding: '0.375rem 0.75rem',
          border: hasErrors ? '2px solid #dc3545' : '1px solid #ced4da',
          borderRadius: '0.25rem',
        }}
      />
      {hasErrors && (
        <div id={errorId} role="alert" style={{ color: '#dc3545', fontSize: '0.875rem', marginTop: '0.25rem' }}>
          {errors.map((error, index) => (
            <p key={index} style={{ margin: 0 }}>
              {error}
            </p>
          ))}
        </div>
      )}
    </div>
  );
}

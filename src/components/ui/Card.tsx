import type { ReactNode } from 'react'

interface CardProps {
  children: ReactNode
  className?: string
  variant?: 'default' | 'glass' | 'elevated'
}

export function Card({
  children,
  className = '',
  variant = 'default',
}: CardProps) {
  const variantClasses = {
    default: 'spandan-surface',
    glass: 'spandan-glass',
    elevated: 'spandan-elevated',
  }

  return (
    <div
      className={`rounded-[var(--spandan-radius-md)] p-4 transition-shadow duration-200 ${variantClasses[variant]} ${className}`}
    >
      {children}
    </div>
  )
}

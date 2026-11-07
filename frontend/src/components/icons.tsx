import type { ReactNode } from 'react'

interface IconProps {
  size?: number
}

function SvgIcon({ size = 16, children }: IconProps & { children: ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {children}
    </svg>
  )
}

export function DashboardIcon({ size }: IconProps) {
  return (
    <SvgIcon size={size}>
      <rect x="3" y="3" width="7.5" height="7.5" rx="1.5" />
      <rect x="13.5" y="3" width="7.5" height="7.5" rx="1.5" />
      <rect x="3" y="13.5" width="7.5" height="7.5" rx="1.5" />
      <rect x="13.5" y="13.5" width="7.5" height="7.5" rx="1.5" />
    </SvgIcon>
  )
}

export function ProfitIcon({ size }: IconProps) {
  return (
    <SvgIcon size={size}>
      <path d="M4 19V5" />
      <path d="M4 19h16" />
      <path d="M7.5 15.5l3.5-4 3 2.5 4-6" />
    </SvgIcon>
  )
}

export function RevenueIcon({ size }: IconProps) {
  return (
    <SvgIcon size={size}>
      <circle cx="9" cy="9" r="5.2" />
      <path d="M13.5 13.5l5 5" />
      <path d="M9 6.6v4.8M7.4 8.2h3.2M7.4 9.8h3.2" />
    </SvgIcon>
  )
}

export function GrossIcon({ size }: IconProps) {
  return (
    <SvgIcon size={size}>
      <path d="M12 3a9 9 0 1 0 9 9h-9V3z" />
      <path d="M15 3.6A9 9 0 0 1 20.4 9H15V3.6z" />
    </SvgIcon>
  )
}

export function ExpenseIcon({ size }: IconProps) {
  return (
    <SvgIcon size={size}>
      <rect x="3" y="6" width="18" height="13" rx="2" />
      <path d="M3 10h18" />
      <path d="M16.5 14.5h1.5" />
    </SvgIcon>
  )
}

export function CustomerIcon({ size }: IconProps) {
  return (
    <SvgIcon size={size}>
      <circle cx="9" cy="8" r="3.4" />
      <path d="M3.5 20c0-3 2.5-5.2 5.5-5.2S14.5 17 14.5 20" />
      <circle cx="17" cy="9" r="2.6" />
      <path d="M15.6 14.6c2.6.2 4.4 2.2 4.4 5.4" />
    </SvgIcon>
  )
}

export function SummaryIcon({ size }: IconProps) {
  return (
    <SvgIcon size={size}>
      <rect x="5" y="4" width="14" height="17" rx="2" />
      <path d="M9 4.5V3h6v1.5" />
      <path d="M8.5 10h7M8.5 13.5h7M8.5 17h4" />
    </SvgIcon>
  )
}

export function SandboxIcon({ size }: IconProps) {
  return (
    <SvgIcon size={size}>
      <path d="M5 4v6M5 14v6M12 4v3M12 11v9M19 4v10M19 18v2" />
      <circle cx="5" cy="12" r="1.6" />
      <circle cx="12" cy="9" r="1.6" />
      <circle cx="19" cy="16" r="1.6" />
    </SvgIcon>
  )
}

export function ReportIcon({ size }: IconProps) {
  return (
    <SvgIcon size={size}>
      <path d="M6 3h8l4 4v14H6z" />
      <path d="M14 3v4h4" />
      <path d="M9 13h6M9 16.5h6" />
    </SvgIcon>
  )
}

export function DataIcon({ size }: IconProps) {
  return (
    <SvgIcon size={size}>
      <ellipse cx="12" cy="6" rx="7" ry="2.8" />
      <path d="M5 6v6c0 1.55 3.13 2.8 7 2.8s7-1.25 7-2.8V6" />
      <path d="M5 12v6c0 1.55 3.13 2.8 7 2.8s7-1.25 7-2.8v-6" />
    </SvgIcon>
  )
}

export function SparkleIcon({ size = 14 }: IconProps) {
  return (
    <SvgIcon size={size}>
      <path d="M12 3.5l1.7 4.6 4.6 1.7-4.6 1.7L12 16.1l-1.7-4.6-4.6-1.7 4.6-1.7L12 3.5z" />
      <path d="M18.5 15.5l.8 2.2 2.2.8-2.2.8-.8 2.2-.8-2.2-2.2-.8 2.2-.8.8-2.2z" />
    </SvgIcon>
  )
}

export function ChevronRightIcon({ size = 14 }: IconProps) {
  return (
    <SvgIcon size={size}>
      <path d="M9 5l7 7-7 7" />
    </SvgIcon>
  )
}

export function ArrowLeftIcon({ size = 14 }: IconProps) {
  return (
    <SvgIcon size={size}>
      <path d="M15 5l-7 7 7 7" />
    </SvgIcon>
  )
}

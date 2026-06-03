import React from 'react'

interface IconProps {
  readonly size?: number
}

function getIconStyle(size: number): React.CSSProperties {
  return {
    width: size,
    height: size
  }
}

export function MoreHorizontalIcon({
  size = 20
}: IconProps): React.JSX.Element {
  return (
    <svg
      aria-hidden="true"
      className="icon"
      fill="none"
      viewBox="0 0 24 24"
      style={getIconStyle(size)}
    >
      <circle cx="5" cy="12" r="1.35" fill="currentColor" />
      <circle cx="12" cy="12" r="1.35" fill="currentColor" />
      <circle cx="19" cy="12" r="1.35" fill="currentColor" />
    </svg>
  )
}

export function NoteIcon({ size = 20 }: IconProps): React.JSX.Element {
  return (
    <svg
      aria-hidden="true"
      className="icon"
      fill="none"
      viewBox="0 0 24 24"
      style={getIconStyle(size)}
    >
      <path
        d="M14.25 3.75H7.5a2 2 0 0 0-2 2v12.5a2 2 0 0 0 2 2h9a2 2 0 0 0 2-2V8m-4.25-4.25L18.5 8m-4.25-4.25V8h4.25M8.75 12h6.5m-6.5 3.5h6.5"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.5"
      />
    </svg>
  )
}

export function PlusIcon({ size = 20 }: IconProps): React.JSX.Element {
  return (
    <svg
      aria-hidden="true"
      className="icon"
      fill="none"
      viewBox="0 0 24 24"
      style={getIconStyle(size)}
    >
      <path
        d="M12 5.25v13.5M5.25 12h13.5"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="1.7"
      />
    </svg>
  )
}

export function PinIcon({ size = 20 }: IconProps): React.JSX.Element {
  return (
    <svg
      aria-hidden="true"
      className="icon"
      fill="none"
      viewBox="0 0 24 24"
      style={getIconStyle(size)}
    >
      <path
        d="m9.25 13.75-4.5 4.5m5.55-16.1 7.55 7.55m-5.7-5.85-4.8 4.8c-.55.55-.36 1.49.37 1.74l3.05 1.01 1.01 3.05c.25.73 1.19.92 1.74.37l4.8-4.8"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.5"
      />
    </svg>
  )
}

export function SearchIcon({ size = 20 }: IconProps): React.JSX.Element {
  return (
    <svg
      aria-hidden="true"
      className="icon"
      fill="none"
      viewBox="0 0 24 24"
      style={getIconStyle(size)}
    >
      <circle
        cx="10.75"
        cy="10.75"
        r="5.5"
        stroke="currentColor"
        strokeWidth="1.6"
      />
      <path
        d="m15 15 4 4"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="1.6"
      />
    </svg>
  )
}

export function TrashIcon({ size = 20 }: IconProps): React.JSX.Element {
  return (
    <svg
      aria-hidden="true"
      className="icon"
      fill="none"
      viewBox="0 0 24 24"
      style={getIconStyle(size)}
    >
      <path
        d="M8.5 8.75v8m3.5-8v8m3.5-8v8M5.5 6h13m-8.75 0V4.5h4.5V6m3 0-.65 13H7.4L6.75 6"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.5"
      />
    </svg>
  )
}

export function XIcon({ size = 20 }: IconProps): React.JSX.Element {
  return (
    <svg
      aria-hidden="true"
      className="icon"
      fill="none"
      viewBox="0 0 24 24"
      style={getIconStyle(size)}
    >
      <path
        d="m6.75 6.75 10.5 10.5M17.25 6.75 6.75 17.25"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="1.7"
      />
    </svg>
  )
}

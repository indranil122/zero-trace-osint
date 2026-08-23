export default function LegalFooter({ onOpen }) {
  const links = [
    ['privacy', 'Privacy'],
    ['terms', 'Terms'],
    ['gdpr', 'GDPR'],
    ['ccpa', 'CCPA'],
    ['data', 'Data'],
    ['ip', 'IP Check'],
    ['tm', 'Trademark'],
  ]
  return (
    <div className="flex flex-wrap items-center justify-center gap-1 text-xs">
      {links.map(([id, label]) => (
        <button
          key={id}
          type="button"
          onClick={() => onOpen(id)}
          className="rounded-full px-2 py-1 text-muted-foreground hover:bg-muted hover:text-foreground transition"
        >
          {label}
        </button>
      ))}
      <span className="mx-1 text-muted-foreground/40">·</span>
      <span className="text-muted-foreground">© 2026 Zero-Trace · MIT</span>
    </div>
  )
}

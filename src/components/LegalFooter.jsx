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
        <a
          key={id}
          href={`#${id}`}
          onClick={(e) => {
            e.preventDefault()
            try { window.location.hash = id } catch {}
            onOpen(id)
          }}
          className="rounded-full px-2 py-1 text-muted-foreground hover:bg-muted hover:text-foreground transition"
        >
          {label}
        </a>
      ))}
      <span className="mx-1 text-muted-foreground/40">·</span>
      <span className="text-muted-foreground">© 2026 VeilTrace · MIT</span>
    </div>
  )
}

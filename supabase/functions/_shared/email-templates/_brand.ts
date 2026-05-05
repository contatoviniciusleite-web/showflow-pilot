// Stage brand styling for auth emails — dark theme with green accent.
// User explicitly requested dark email design for Stage / ShowFlow.
export const brand = {
  bg: '#0a0a0a',
  surface: '#111111',
  card: '#1a1a1a',
  border: '#222222',
  green: '#00C853',
  text: '#ffffff',
  muted: '#a0a0a0',
  black: '#000000',
}

export const styles = {
  main: {
    backgroundColor: brand.bg,
    fontFamily:
      'system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
    margin: 0,
    padding: 0,
  },
  outer: {
    backgroundColor: brand.bg,
    padding: '0',
    width: '100%',
  },
  container: {
    backgroundColor: brand.bg,
    maxWidth: '600px',
    margin: '0 auto',
    padding: '0',
  },
  header: {
    backgroundColor: brand.surface,
    padding: '32px 24px 20px',
    textAlign: 'center' as const,
    borderBottom: `2px solid ${brand.green}`,
  },
  logo: {
    color: brand.text,
    fontSize: '28px',
    fontWeight: 700 as const,
    margin: '0 0 6px',
    letterSpacing: '-0.5px',
  },
  logoNote: {
    color: brand.green,
    margin: '0 0 4px',
    fontSize: '20px',
  },
  tagline: {
    color: brand.muted,
    fontSize: '13px',
    margin: 0,
  },
  body: {
    backgroundColor: brand.bg,
    padding: '40px',
  },
  h1: {
    color: brand.text,
    fontSize: '24px',
    fontWeight: 700 as const,
    margin: '0 0 24px',
  },
  text: {
    color: brand.text,
    fontSize: '15px',
    lineHeight: '1.6',
    margin: '0 0 20px',
  },
  textMuted: {
    color: brand.muted,
    fontSize: '13px',
    lineHeight: '1.6',
    margin: '20px 0 0',
    textAlign: 'center' as const,
  },
  buttonWrap: {
    textAlign: 'center' as const,
    padding: '12px 0 8px',
  },
  button: {
    backgroundColor: brand.green,
    color: brand.black,
    fontSize: '15px',
    fontWeight: 700 as const,
    borderRadius: '8px',
    padding: '14px 32px',
    textDecoration: 'none',
    display: 'inline-block',
  },
  cardsRow: {
    padding: '32px 0 8px',
  },
  card: {
    backgroundColor: brand.card,
    border: `1px solid ${brand.border}`,
    borderRadius: '8px',
    padding: '16px 12px',
    textAlign: 'center' as const,
  },
  cardIcon: {
    fontSize: '22px',
    margin: '0 0 6px',
  },
  cardText: {
    color: brand.text,
    fontSize: '12px',
    margin: 0,
    lineHeight: '1.4',
  },
  link: {
    color: brand.green,
    textDecoration: 'underline',
  },
  code: {
    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
    fontSize: '28px',
    fontWeight: 700 as const,
    color: brand.green,
    backgroundColor: brand.card,
    border: `1px solid ${brand.border}`,
    borderRadius: '8px',
    padding: '16px 24px',
    textAlign: 'center' as const,
    letterSpacing: '4px',
    margin: '0 0 24px',
  },
  footer: {
    backgroundColor: brand.surface,
    borderTop: `2px solid ${brand.green}`,
    padding: '24px',
    textAlign: 'center' as const,
  },
  footerTitle: {
    color: brand.text,
    fontSize: '13px',
    margin: '0 0 4px',
  },
  footerNote: {
    color: brand.muted,
    fontSize: '11px',
    margin: 0,
  },
}

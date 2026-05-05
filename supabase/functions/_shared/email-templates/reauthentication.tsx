/// <reference types="npm:@types/react@18.3.1" />

import * as React from 'npm:react@18.3.1'

import {
  Body,
  Container,
  Head,
  Heading,
  Html,
  Preview,
  Section,
  Text,
} from 'npm:@react-email/components@0.0.22'
import { styles } from './_brand.ts'

interface ReauthenticationEmailProps {
  token: string
}

export const ReauthenticationEmail = ({ token }: ReauthenticationEmailProps) => (
  <Html lang="pt-BR" dir="ltr">
    <Head />
    <Preview>Seu código de verificação Stage</Preview>
    <Body style={styles.main}>
      <Container style={styles.container}>
        <Section style={styles.header}>
          <Text style={styles.logoNote}>🎵</Text>
          <Heading as="h1" style={styles.logo}>Stage</Heading>
          <Text style={styles.tagline}>Gestão para produtoras musicais</Text>
        </Section>
        <Section style={styles.body}>
          <Heading as="h2" style={styles.h1}>Confirme sua identidade</Heading>
          <Text style={styles.text}>
            Use o código abaixo para confirmar sua identidade no <strong>Stage</strong>:
          </Text>
          <Text style={styles.code}>{token}</Text>
          <Text style={styles.textMuted}>
            Este código expira em breve. Se você não solicitou, ignore este e-mail.
          </Text>
        </Section>
        <Section style={styles.footer}>
          <Text style={styles.footerTitle}>Stage — Gestão para produtoras musicais</Text>
          <Text style={styles.footerNote}>© 2026 Todos os direitos reservados</Text>
        </Section>
      </Container>
    </Body>
  </Html>
)

export default ReauthenticationEmail

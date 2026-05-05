/// <reference types="npm:@types/react@18.3.1" />

import * as React from 'npm:react@18.3.1'

import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Html,
  Preview,
  Section,
  Text,
} from 'npm:@react-email/components@0.0.22'
import { styles } from './_brand.ts'

interface RecoveryEmailProps {
  siteName: string
  confirmationUrl: string
}

export const RecoveryEmail = ({ confirmationUrl }: RecoveryEmailProps) => (
  <Html lang="pt-BR" dir="ltr">
    <Head />
    <Preview>Redefinir sua senha do Stage</Preview>
    <Body style={styles.main}>
      <Container style={styles.container}>
        <Section style={styles.header}>
          <Text style={styles.logoNote}>🎵</Text>
          <Heading as="h1" style={styles.logo}>Stage</Heading>
          <Text style={styles.tagline}>Gestão para produtoras musicais</Text>
        </Section>
        <Section style={styles.body}>
          <Heading as="h2" style={styles.h1}>Redefinir sua senha</Heading>
          <Text style={styles.text}>
            Recebemos uma solicitação para redefinir sua senha no <strong>Stage</strong>.
            Clique no botão abaixo para escolher uma nova senha.
          </Text>
          <Section style={styles.buttonWrap}>
            <Button style={styles.button} href={confirmationUrl}>
              Redefinir senha
            </Button>
          </Section>
          <Text style={styles.textMuted}>
            Se você não solicitou esta alteração, ignore este e-mail. Sua senha
            permanecerá a mesma.
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

export default RecoveryEmail

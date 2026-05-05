/// <reference types="npm:@types/react@18.3.1" />

import * as React from 'npm:react@18.3.1'

import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Html,
  Link,
  Preview,
  Section,
  Text,
} from 'npm:@react-email/components@0.0.22'
import { styles } from './_brand.ts'

interface EmailChangeEmailProps {
  siteName: string
  oldEmail: string
  email: string
  newEmail: string
  confirmationUrl: string
}

export const EmailChangeEmail = ({
  oldEmail,
  newEmail,
  confirmationUrl,
}: EmailChangeEmailProps) => (
  <Html lang="pt-BR" dir="ltr">
    <Head />
    <Preview>Confirme a alteração do seu e-mail no Stage</Preview>
    <Body style={styles.main}>
      <Container style={styles.container}>
        <Section style={styles.header}>
          <Text style={styles.logoNote}>🎵</Text>
          <Heading as="h1" style={styles.logo}>Stage</Heading>
          <Text style={styles.tagline}>Gestão para produtoras musicais</Text>
        </Section>
        <Section style={styles.body}>
          <Heading as="h2" style={styles.h1}>Confirme a alteração de e-mail</Heading>
          <Text style={styles.text}>
            Você solicitou alterar seu e-mail no <strong>Stage</strong> de{' '}
            <Link href={`mailto:${oldEmail}`} style={styles.link}>{oldEmail}</Link>{' '}
            para{' '}
            <Link href={`mailto:${newEmail}`} style={styles.link}>{newEmail}</Link>.
          </Text>
          <Section style={styles.buttonWrap}>
            <Button style={styles.button} href={confirmationUrl}>
              Confirmar alteração
            </Button>
          </Section>
          <Text style={styles.textMuted}>
            Se você não solicitou esta alteração, proteja sua conta imediatamente.
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

export default EmailChangeEmail

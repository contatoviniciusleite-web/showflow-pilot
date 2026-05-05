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

interface SignupEmailProps {
  siteName: string
  siteUrl: string
  recipient: string
  confirmationUrl: string
}

export const SignupEmail = ({ confirmationUrl }: SignupEmailProps) => (
  <Html lang="pt-BR" dir="ltr">
    <Head />
    <Preview>Confirme seu e-mail no Stage</Preview>
    <Body style={styles.main}>
      <Container style={styles.container}>
        <Section style={styles.header}>
          <Text style={styles.logoNote}>🎵</Text>
          <Heading as="h1" style={styles.logo}>Stage</Heading>
          <Text style={styles.tagline}>Gestão para produtoras musicais</Text>
        </Section>
        <Section style={styles.body}>
          <Heading as="h2" style={styles.h1}>Confirme seu e-mail</Heading>
          <Text style={styles.text}>
            Obrigado por se cadastrar no <strong>Stage</strong>. Confirme seu
            endereço de e-mail clicando no botão abaixo.
          </Text>
          <Section style={styles.buttonWrap}>
            <Button style={styles.button} href={confirmationUrl}>
              Confirmar e-mail
            </Button>
          </Section>
          <Text style={styles.textMuted}>
            Se você não criou esta conta, ignore este e-mail com segurança.
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

export default SignupEmail

/// <reference types="npm:@types/react@18.3.1" />

import * as React from 'npm:react@18.3.1'

import {
  Body,
  Button,
  Column,
  Container,
  Head,
  Heading,
  Html,
  Preview,
  Row,
  Section,
  Text,
} from 'npm:@react-email/components@0.0.22'
import { styles } from './_brand.ts'

interface InviteEmailProps {
  siteName: string
  siteUrl: string
  recipient?: string
  confirmationUrl: string
}

export const InviteEmail = ({
  siteName,
  recipient,
  confirmationUrl,
}: InviteEmailProps) => (
  <Html lang="pt-BR" dir="ltr">
    <Head />
    <Preview>Você foi convidado para o {siteName}</Preview>
    <Body style={styles.main}>
      <Container style={styles.container}>
        <Section style={styles.header}>
          <Text style={styles.logoNote}>🎵</Text>
          <Heading as="h1" style={styles.logo}>Stage</Heading>
          <Text style={styles.tagline}>Gestão para produtoras musicais</Text>
        </Section>

        <Section style={styles.body}>
          <Heading as="h2" style={styles.h1}>
            Olá{recipient ? `, ${recipient}` : ''}!
          </Heading>
          <Text style={styles.text}>
            Você foi convidado para acessar o <strong>Stage</strong>, a
            plataforma de gestão para produtoras musicais.
          </Text>
          <Text style={styles.text}>
            Clique no botão abaixo para criar sua senha e acessar a plataforma.
            Este link é válido por 24 horas.
          </Text>

          <Section style={styles.buttonWrap}>
            <Button style={styles.button} href={confirmationUrl}>
              Aceitar convite e criar senha
            </Button>
          </Section>

          <Text style={styles.textMuted}>
            Se você não reconhece este convite, ignore este e-mail com segurança.
          </Text>

          <Section style={styles.cardsRow}>
            <Row>
              <Column style={{ paddingRight: '6px', width: '33.33%' }}>
                <Section style={styles.card}>
                  <Text style={styles.cardIcon}>🎵</Text>
                  <Text style={styles.cardText}>Agenda completa de shows</Text>
                </Section>
              </Column>
              <Column style={{ paddingLeft: '3px', paddingRight: '3px', width: '33.33%' }}>
                <Section style={styles.card}>
                  <Text style={styles.cardIcon}>💰</Text>
                  <Text style={styles.cardText}>Controle financeiro</Text>
                </Section>
              </Column>
              <Column style={{ paddingLeft: '6px', width: '33.33%' }}>
                <Section style={styles.card}>
                  <Text style={styles.cardIcon}>📋</Text>
                  <Text style={styles.cardText}>Minutas e contratos</Text>
                </Section>
              </Column>
            </Row>
          </Section>
        </Section>

        <Section style={styles.footer}>
          <Text style={styles.footerTitle}>
            Stage — Gestão para produtoras musicais
          </Text>
          <Text style={styles.footerNote}>
            © 2026 Todos os direitos reservados
          </Text>
        </Section>
      </Container>
    </Body>
  </Html>
)

export default InviteEmail

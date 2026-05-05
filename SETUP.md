# Configuração do Stage

## Configurar Auth Email Hook

Para que o sistema utilize os templates personalizados de e-mail
(convite, recuperação de senha, magic link, etc.) é necessário
registrar o webhook `auth-email-hook` no Supabase.

1. Acesse o painel do Supabase
2. Vá em **Authentication → Hooks**
3. Clique em **Add hook**
4. Selecione: **Send email**
5. Em **Hook URL**, informe:

   ```
   https://[seu-projeto].supabase.co/functions/v1/auth-email-hook
   ```

6. Clique em **Save**
7. O sistema passa a usar os templates personalizados do Stage
   automaticamente.

> Em ambientes Lovable Cloud, esta etapa é orquestrada
> automaticamente após a verificação de DNS do domínio
> `notify.showflow.com.br` em **Cloud → Emails**.

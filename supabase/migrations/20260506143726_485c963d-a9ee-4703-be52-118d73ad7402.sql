CREATE POLICY "Inserir ordens de pagamento (gerente/diretor/financeiro)"
ON public.payment_orders
FOR INSERT
TO authenticated
WITH CHECK (
  has_role(auth.uid(), 'financeiro'::app_role)
  OR has_role(auth.uid(), 'diretor'::app_role)
  OR has_role(auth.uid(), 'gerente'::app_role)
);

CREATE POLICY "Excluir ordens pendentes/agendadas (gerente/diretor/financeiro)"
ON public.payment_orders
FOR DELETE
TO authenticated
USING (
  status IN ('pendente','agendado')
  AND (
    has_role(auth.uid(), 'financeiro'::app_role)
    OR has_role(auth.uid(), 'diretor'::app_role)
    OR has_role(auth.uid(), 'gerente'::app_role)
  )
);
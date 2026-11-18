-- Ambiente de TESTE (ellos-teste): conhecimentos INVENTADOS da Base de conhecimento, só para a tela ter o que mostrar.
delete from public.knowledge_articles;
insert into public.knowledge_articles (title, category, content, created_by_email) values
  ('Preparo para ressonância magnética', 'Imagem', E'Jejum de 4 horas quando o exame for com contraste.\nAvisar o paciente para retirar objetos metálicos.\nPerguntar sobre marca-passo, implantes e clipes de aneurisma antes de agendar.\nSe houver qualquer dúvida, transferir para a fila RM.', 'teste@exemplo.com'),
  ('Coleta domiciliar: como agendar', 'Laboratório', E'Agendar com 24 horas de antecedência.\nConfirmar o endereço completo e um telefone de contato.\nExplicar o preparo do exame (jejum, horário) antes de encerrar o atendimento.', 'teste@exemplo.com'),
  ('Quando transferir para Falar com Atendente', null, 'Transferir somente quando o assunto não for exame, orçamento ou resultado. Registrar o motivo na tabulação.', 'teste@exemplo.com');

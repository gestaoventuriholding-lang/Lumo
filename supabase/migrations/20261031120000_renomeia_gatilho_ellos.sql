-- Ellos (antes Lumo): renomeia o gatilho que torna a Amanda administradora ao criar a conta.
alter trigger lumo_grant_admin_on_signup on auth.users rename to ellos_grant_admin_on_signup;

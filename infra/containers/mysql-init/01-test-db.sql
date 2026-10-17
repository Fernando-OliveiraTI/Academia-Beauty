-- Executado só na primeira criação do volume. Banco isolado para os testes da API.
CREATE DATABASE IF NOT EXISTS academia_test CHARACTER SET utf8mb4;
GRANT ALL ON academia_test.* TO 'academia'@'%';
FLUSH PRIVILEGES;

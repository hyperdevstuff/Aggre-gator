-- Runs once, on first initialisation of the postgres volume.
-- POSTGRES_DB already creates `aggregator`; this adds the isolated test database.
CREATE DATABASE aggregator_test OWNER postgres;
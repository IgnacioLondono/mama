# Tejidos de Mamá

Cuaderno privado de amigurumis con **MySQL**, listo para Portainer en Linux.

## Local (con MySQL)

```bash
# 1) Arranca MySQL (Docker)
docker compose up -d mysql

# 2) Copia entorno
cp .env.example .env

# 3) App
npm install
npm run dev
```

Web: http://localhost:5173 · API: http://localhost:3001

## Portainer (stack desde Git)

1. Sube este repo a GitHub (ya está pensado para eso).
2. En Portainer → **Stacks** → **Add stack** → pestaña **Repository**.
3. URL: `https://github.com/IgnacioLondono/mama.git`
4. Compose path: `docker-compose.yml`
5. Activa el build de la imagen (usa el `Dockerfile` de la raíz).
6. Variables de entorno del stack:

```
MYSQL_ROOT_PASSWORD=elige-una-fuerte
MYSQL_DATABASE=tejidos
MYSQL_USER=tejidos
MYSQL_PASSWORD=elige-otra
APP_PASSWORD=clave-para-entrar
```

La app queda en el puerto **8088** (o pon un proxy/nginx delante).

Los PDFs quedan en el volumen `tejidos_uploads` y la base en `tejidos_mysql`.

Alternativa: **Web editor** y pegar el contenido de `docker-compose.yml`.

## Vista previa de PDF

En la estantería de patrones, si hay PDF o foto, se muestra una miniatura de la primera página.

## Ayuda con IA

En la mesa de trabajo (pestaña **Ayuda**) o en el detalle del patrón.

Lee el PDF (texto) + lo anotado del patrón y da tips.

**Opción A — OpenAI** (en Portainer / `.env`):

```
OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-4o-mini
```

**Opción B — Ollama** (privado en tu nube):

```
OLLAMA_BASE_URL=http://ollama:11434
OLLAMA_MODEL=llama3.2
```

Si el PDF es solo imagen escaneada y no hay texto, avisa y usa el patrón anotado.

## Respaldos

- MySQL: volumen `tejidos_mysql`
- Archivos: volumen `tejidos_uploads`

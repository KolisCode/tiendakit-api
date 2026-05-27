<p align="center">
  <img src="https://raw.githubusercontent.com/KolisCode/lotesRB/master/screenshots/readme-banner.png" alt="KolisCode Banner" width="100%"/>
</p>

# TiendaKit — API

![NestJS](https://img.shields.io/badge/NestJS-11-E0234E?logo=nestjs&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-15-4169E1?logo=postgresql&logoColor=white)
![Prisma](https://img.shields.io/badge/Prisma-7-2D3748?logo=prisma&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white)
![MercadoPago](https://img.shields.io/badge/MercadoPago-SDK-009EE3?logo=mercadopago&logoColor=white)

> Backend del e-commerce TiendaKit. **Frontend:** [tiendakit-frontend](https://github.com/KolisCode/tiendakit-frontend)

REST API para una tienda online genérica con catálogo de productos, checkout real con MercadoPago y panel admin completo.

## Stack

- **NestJS 11** — módulos, guards, pipes, throttler
- **Prisma 7** — ORM con adaptador PostgreSQL nativo
- **PostgreSQL** — base de datos relacional
- **MercadoPago SDK v3** — preferencias de pago y webhooks
- **JWT + Passport** — autenticación del panel admin
- **Multer** — upload de imágenes de productos
- **bcrypt** — hash seguro de contraseñas

## Requisitos

- Node.js 20+
- PostgreSQL corriendo

## Instalación

```bash
npm install
```

## Variables de entorno

Crear `.env` en la raíz:

```env
DATABASE_URL="postgresql://dev:dev1234@localhost:5432/tiendakit?schema=public"
JWT_SECRET="secreto-aleatorio-minimo-32-chars"
PORT=3002
CORS_ORIGINS="http://localhost:3000"
MP_ACCESS_TOKEN="TEST-xxxx-tu-access-token-de-mercadopago"
SEED_ADMIN_EMAIL="admin@tiendakit.com"
SEED_ADMIN_NOMBRE="Administrador"
SEED_ADMIN_PASSWORD="contraseña-segura"
```

> Obtén tu `MP_ACCESS_TOKEN` en [mercadopago.com/developers](https://mercadopago.com.co/developers).

## Base de datos

```bash
npx prisma migrate dev
npm run seed
```

## Desarrollo

```bash
npm run start:dev    # http://localhost:3002/api
```

---

## Estructura

```
src/
├── main.ts                # Bootstrap: helmet, CORS, ValidationPipe
├── prisma/                # PrismaService con @prisma/adapter-pg
├── auth/                  # POST /api/auth/login — JWT, bcrypt, timing-safe
├── productos/             # CRUD /api/productos — filtros categoría y precio
├── categorias/            # CRUD /api/categorias
├── ordenes/               # Crear orden → preferencia MP → webhook
└── upload/                # POST /api/upload/imagen — multer, JWT
```

---

## Flujo MercadoPago

1. Cliente POST `/api/ordenes` con datos del comprador e items
2. API crea la `Orden` en BD y genera una Preferencia en MercadoPago
3. Respuesta incluye `initPoint` — la URL de pago de MP
4. Cliente es redirigido a MercadoPago
5. MP llama al webhook `/api/ordenes/webhook` al completarse
6. API actualiza estado de la orden y descuenta stock

---

## Endpoints principales

| Método | Ruta | Auth | Descripción |
|--------|------|------|-------------|
| `GET` | `/api/productos` | No | Lista con filtros `?categoria=&minPrecio=&maxPrecio=` |
| `GET` | `/api/productos/:slug` | No | Detalle de producto |
| `GET` | `/api/categorias` | No | Lista categorías |
| `POST` | `/api/ordenes` | No | Crear orden → `{ orden, initPoint }` |
| `POST` | `/api/ordenes/webhook` | No | Webhook MercadoPago |
| `POST` | `/api/auth/login` | — | Login admin → `{ access_token }` |
| `POST` | `/api/productos` | JWT | Crear producto |
| `PUT` | `/api/productos/:id` | JWT | Actualizar producto |
| `DELETE` | `/api/productos/:id` | JWT | Eliminar producto |
| `GET` | `/api/ordenes` | JWT | Listar órdenes |
| `PATCH` | `/api/ordenes/:id/estado` | JWT | Cambiar estado |
| `POST` | `/api/upload/imagen` | JWT | Subir imagen |

import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import * as bcrypt from 'bcrypt';

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter } as any);

async function main() {
  const hash = await bcrypt.hash(process.env.SEED_ADMIN_PASSWORD ?? 'Admin1234!', 12);
  await prisma.admin.upsert({
    where: { email: process.env.SEED_ADMIN_EMAIL ?? 'admin@tiendakit.com' },
    update: {},
    create: {
      email: process.env.SEED_ADMIN_EMAIL ?? 'admin@tiendakit.com',
      nombre: process.env.SEED_ADMIN_NOMBRE ?? 'Administrador',
      password: hash,
    },
  });

  const ropa = await prisma.categoria.upsert({
    where: { slug: 'ropa' },
    update: {},
    create: { nombre: 'Ropa', slug: 'ropa' },
  });

  const accesorios = await prisma.categoria.upsert({
    where: { slug: 'accesorios' },
    update: {},
    create: { nombre: 'Accesorios', slug: 'accesorios' },
  });

  const productos = [
    { nombre: 'Camiseta Premium', slug: 'camiseta-premium', precio: 45000, stock: 50, categoriaId: ropa.id, descripcion: 'Camiseta 100% algodón, corte moderno.' },
    { nombre: 'Jean Slim Fit', slug: 'jean-slim-fit', precio: 89000, stock: 30, categoriaId: ropa.id, descripcion: 'Jean de alta calidad, entallado.' },
    { nombre: 'Buzo Oversize', slug: 'buzo-oversize', precio: 65000, stock: 20, categoriaId: ropa.id, descripcion: 'Buzo cómodo de tendencia.' },
    { nombre: 'Gorra Snapback', slug: 'gorra-snapback', precio: 35000, stock: 40, categoriaId: accesorios.id, descripcion: 'Gorra ajustable snapback.' },
    { nombre: 'Bolso Tote', slug: 'bolso-tote', precio: 55000, stock: 25, categoriaId: accesorios.id, descripcion: 'Bolso de lona resistente.' },
  ];

  for (const p of productos) {
    await prisma.producto.upsert({
      where: { slug: p.slug },
      update: {},
      create: p,
    });
  }

  console.log('Seed completado');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
